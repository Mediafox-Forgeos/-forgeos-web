import { Injectable } from '@nestjs/common';
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

// Deliberately the minimal field set computeHealth() actually reads, not
// the full Prisma Evse/Connector shape — callers (including tests) only
// need to provide id/status, not every column.
type StationWithTopology = {
  id: string;
  connectivityStatus: string;
  evses: {
    status: string;
    connectors: { status: string }[];
  }[];
};

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

    const connectors = station.evses.flatMap((evse) =>
      evse.connectors.map((connector) => ({
        connector,
        evseFaulted: evse.status === 'FAULTED',
      })),
    );
    const totalConnectors = connectors.length;
    const faultedConnectors = connectors.filter(
      ({ connector, evseFaulted }) =>
        connector.status === 'FAULTED' || evseFaulted,
    ).length;

    if (faultedConnectors > 0) {
      const reason =
        totalConnectors > 0
          ? `${faultedConnectors} de ${totalConnectors} conectores en falla.`
          : 'Uno o más EVSE en falla.';
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
      include: { evses: { include: { connectors: true } } },
    });

    const counts: Record<StationHealthStatus, number> = {
      healthy: 0,
      degraded: 0,
      offline: 0,
      unknown: 0,
    };
    for (const station of stations) {
      counts[this.computeHealth(station).status] += 1;
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
          include: { evses: { include: { connectors: true } } },
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
        counts[this.computeHealth(station).status] += 1;
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
