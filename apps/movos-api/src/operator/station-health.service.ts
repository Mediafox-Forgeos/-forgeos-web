import { Injectable } from '@nestjs/common';
import type { ConnectivityStatus, ConnectorStatus } from '@prisma/client';
import type {
  ApiConnectivitySummary,
  ApiConnectorStatusCounts,
  ApiOccupancySummary,
  ApiOfflineStation,
  ApiSiteHealthSummary,
  ApiStationHealth,
  ApiStationHealthSummary,
  StationHealthStatus,
} from '@mediafox/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import { computeEvseOperationalStatus } from '../evses/evse-operational-status';
import { SESSION_IN_PROGRESS_STATUSES } from '../evses/evses.service';

// Deliberately the minimal field set computeHealth() actually reads, not
// the full Prisma Evse/Connector shape — callers (including tests) only
// need to provide connectivityStatus + each connector's status/active-session
// evidence, not every column.
//
// WO-ARGOS-057 — no more raw `evse.status === 'FAULTED'` here. Station
// "degraded" is now reconciled with WO-056's Operational Status: an EVSE's
// requiresAttention (computed by the same evse-operational-status.ts every
// other surface uses) is what makes its parent station degraded. This is
// the OBSERVED-evidence-only signal WO-056 already validated — Evse.status
// (ADMINISTRATIVE) is never read here, matching the three-layer separation
// (Administrative / Protocol-Observed / Operational) WO-056 established.
type StationWithTopology = {
  id: string;
  connectivityStatus: ConnectivityStatus;
  evses: {
    connectors: { status: ConnectorStatus; hasActiveSession: boolean }[];
  }[];
};

// Shared Prisma include for computeHealth()'s evidence — mirrors
// EVSE_WITH_NAMES_INCLUDE's connectors/chargingSessions shape in
// evses.service.ts exactly, so "does this connector have an active
// session" means the same thing everywhere in the codebase.
const TOPOLOGY_INCLUDE = {
  evses: {
    select: {
      connectors: {
        select: {
          status: true,
          chargingSessions: {
            where: { status: SESSION_IN_PROGRESS_STATUSES },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  },
} as const;

type StationTopologyRow = {
  connectivityStatus: ConnectivityStatus;
  id: string;
  evses: {
    connectors: {
      status: ConnectorStatus;
      chargingSessions: { id: string }[];
    }[];
  }[];
};

function toStationWithTopology(
  station: StationTopologyRow,
): StationWithTopology {
  return {
    id: station.id,
    connectivityStatus: station.connectivityStatus,
    evses: station.evses.map((evse) => ({
      connectors: evse.connectors.map((connector) => ({
        status: connector.status,
        hasActiveSession: connector.chargingSessions.length > 0,
      })),
    })),
  };
}

const EMPTY_CONNECTOR_COUNTS: ApiConnectorStatusCounts = {
  AVAILABLE: 0,
  CHARGING: 0,
  OCCUPIED: 0,
  RESERVED: 0,
  UNAVAILABLE: 0,
  FAULTED: 0,
  OFFLINE: 0,
};

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022). Pure read-only
 * aggregation over ChargingStation/Evse/Connector — never writes to any of
 * them. StationHealth is a computed view, not a stored fact, per
 * docs/domain/CAP-X_STATION_HEALTH.md.
 *
 * Sprint 1 implements 4 of the architecture's 5 health states
 * (`healthy`/`degraded`/`offline`/`unknown`) and 2 of its 4 named degraded
 * triggers (a faulted connector/EVSE; connectivity precedence). The
 * `maintenance` state and the open-Alert/high-failure-rate degraded
 * triggers all depend on the Alert/Incident/MaintenanceTicket schema
 * Sprint 2 introduces — deliberately not built here, per WO-ARGOS-022's
 * explicit restriction against implementing alerts/incidents/maintenance.
 * See docs/implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md.
 *
 * Every query below filters to ChargingStationStatus.ACTIVE — a station
 * still in DRAFT, or INACTIVE/ARCHIVED, is not part of live fleet
 * operations and would misleadingly read as "offline"/"unknown" if
 * included, when the honest fact is simply that it isn't in service yet.
 */
@Injectable()
export class StationHealthService {
  constructor(private readonly prisma: PrismaService) {}

  computeHealth(station: StationWithTopology): ApiStationHealth {
    if (station.connectivityStatus === 'OFFLINE') {
      return {
        stationId: station.id,
        status: 'offline',
        reason: 'Estación sin conexión verificada.',
      };
    }

    if (station.connectivityStatus === 'UNKNOWN') {
      return {
        stationId: station.id,
        status: 'unknown',
        reason: 'Sin evidencia de conectividad reciente.',
      };
    }

    // ONLINE from here — reuse evse-operational-status.ts's derivation
    // per EVSE rather than duplicating fault logic. requiresAttention
    // already covers both a FAULTED connector and a ChargingSession that
    // disagrees with its own connector's status (see evse-operational-
    // status.ts) — a strict superset of what this service checked before.
    const totalEvses = station.evses.length;
    const evsesRequiringAttention = station.evses.filter(
      (evse) =>
        computeEvseOperationalStatus({
          connectivityStatus: station.connectivityStatus,
          connectors: evse.connectors,
        }).requiresAttention,
    ).length;

    if (evsesRequiringAttention > 0) {
      const reason =
        totalEvses > 0
          ? `${evsesRequiringAttention} de ${totalEvses} cargadores requieren atención.`
          : 'Uno o más cargadores requieren atención.';
      return { stationId: station.id, status: 'degraded', reason };
    }

    return {
      stationId: station.id,
      status: 'healthy',
      reason: 'Operando con normalidad.',
    };
  }

  async summarizeFleet(
    organizationId: string,
    siteId?: string,
  ): Promise<ApiStationHealthSummary> {
    const stations = await this.prisma.chargingStation.findMany({
      where: {
        status: 'ACTIVE',
        site: { organizationId, ...(siteId ? { id: siteId } : {}) },
      },
      include: TOPOLOGY_INCLUDE,
    });

    const counts: Record<StationHealthStatus, number> = {
      healthy: 0,
      degraded: 0,
      offline: 0,
      unknown: 0,
    };
    for (const station of stations) {
      counts[this.computeHealth(toStationWithTopology(station)).status] += 1;
    }

    return {
      organizationId,
      siteId: siteId ?? null,
      totalStations: stations.length,
      ...counts,
    };
  }

  async summarizeConnectivity(
    organizationId: string,
    siteId?: string,
  ): Promise<ApiConnectivitySummary> {
    const stations = await this.prisma.chargingStation.findMany({
      where: {
        status: 'ACTIVE',
        site: { organizationId, ...(siteId ? { id: siteId } : {}) },
      },
      select: { connectivityStatus: true },
    });

    let online = 0;
    let offline = 0;
    let unknown = 0;
    for (const station of stations) {
      if (station.connectivityStatus === 'ONLINE') online += 1;
      else if (station.connectivityStatus === 'OFFLINE') offline += 1;
      else unknown += 1;
    }

    return {
      organizationId,
      siteId: siteId ?? null,
      totalStations: stations.length,
      online,
      offline,
      unknown,
    };
  }

  async summarizeBySite(
    organizationId: string,
  ): Promise<ApiSiteHealthSummary[]> {
    const sites = await this.prisma.site.findMany({
      where: { organizationId },
      include: {
        chargingStations: {
          where: { status: 'ACTIVE' },
          include: TOPOLOGY_INCLUDE,
        },
      },
      orderBy: { name: 'asc' },
    });

    return sites.map((site) => {
      const counts: Record<StationHealthStatus, number> = {
        healthy: 0,
        degraded: 0,
        offline: 0,
        unknown: 0,
      };
      for (const station of site.chargingStations) {
        counts[this.computeHealth(toStationWithTopology(station)).status] += 1;
      }

      const worstStatus: StationHealthStatus =
        site.chargingStations.length === 0
          ? 'unknown'
          : counts.offline > 0
            ? 'offline'
            : counts.unknown > 0
              ? 'unknown'
              : counts.degraded > 0
                ? 'degraded'
                : 'healthy';

      return {
        siteId: site.id,
        siteName: site.name,
        latitude: site.latitude,
        longitude: site.longitude,
        totalStations: site.chargingStations.length,
        worstStatus,
        ...counts,
      };
    });
  }

  async getOccupancy(
    organizationId: string,
    siteId?: string,
  ): Promise<ApiOccupancySummary> {
    const connectors = await this.prisma.connector.findMany({
      where: {
        evse: {
          chargingStation: {
            status: 'ACTIVE',
            site: { organizationId, ...(siteId ? { id: siteId } : {}) },
          },
        },
      },
      select: { status: true },
    });

    const connectorStatusCounts: ApiConnectorStatusCounts = {
      ...EMPTY_CONNECTOR_COUNTS,
    };
    for (const connector of connectors) {
      connectorStatusCounts[
        connector.status as keyof ApiConnectorStatusCounts
      ] += 1;
    }

    const occupiedCount =
      connectorStatusCounts.CHARGING + connectorStatusCounts.OCCUPIED;
    // Eligible = connectors that could plausibly be in use right now —
    // excludes UNAVAILABLE/OFFLINE/FAULTED, which are not part of the
    // "how full is my site" question. See docs/product/OPERATOR_KPIS.md
    // KPI 9 (Occupancy Rate).
    const eligibleCount =
      connectorStatusCounts.AVAILABLE +
      connectorStatusCounts.CHARGING +
      connectorStatusCounts.OCCUPIED +
      connectorStatusCounts.RESERVED;

    return {
      organizationId,
      siteId: siteId ?? null,
      totalConnectors: connectors.length,
      connectorStatusCounts,
      occupiedCount,
      eligibleCount,
      occupancyRate: eligibleCount > 0 ? occupiedCount / eligibleCount : null,
    };
  }

  /**
   * WO-ARGOS-051 — Operations Console station attention. The actual list
   * behind summarizeConnectivity's `offline` count, for a panel that needs
   * to link out to real stations, not just show a number. Filters on the
   * verified `connectivityStatus === 'OFFLINE'` value only — UNKNOWN is
   * never treated as, or folded into, offline.
   */
  async listOfflineStations(
    organizationId: string,
    siteId?: string,
  ): Promise<ApiOfflineStation[]> {
    const stations = await this.prisma.chargingStation.findMany({
      where: {
        status: 'ACTIVE',
        connectivityStatus: 'OFFLINE',
        site: { organizationId, ...(siteId ? { id: siteId } : {}) },
      },
      select: {
        id: true,
        name: true,
        lastDisconnectedAt: true,
        site: { select: { id: true, name: true } },
      },
      orderBy: { lastDisconnectedAt: 'desc' },
    });

    return stations.map((station) => ({
      stationId: station.id,
      stationName: station.name,
      siteId: station.site.id,
      siteName: station.site.name,
      lastDisconnectedAt: station.lastDisconnectedAt?.toISOString() ?? null,
    }));
  }
}
