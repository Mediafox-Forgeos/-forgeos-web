import { Test } from '@nestjs/testing';
import type { ConnectivityStatus, ConnectorStatus } from '@prisma/client';

import { StationHealthService } from './station-health.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  chargingStation: { findMany: jest.Mock };
  site: { findMany: jest.Mock };
  connector: { findMany: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingStation: { findMany: jest.fn() },
    site: { findMany: jest.fn() },
    connector: { findMany: jest.fn() },
  };
}

// WO-ARGOS-057 — station() builds the shape computeHealth() itself takes
// (StationWithTopology: connectors already carry a resolved
// `hasActiveSession` boolean). summarizeFleet/summarizeBySite instead go
// through Prisma, whose raw rows carry a `chargingSessions` relation array
// (see TOPOLOGY_INCLUDE/toStationWithTopology in the service) — toPrismaRow
// converts one into the other so those tests mock exactly what Prisma would
// actually return.
function station(overrides: {
  id?: string;
  connectivityStatus?: ConnectivityStatus;
  evses?: Array<{
    connectors?: Array<{
      status?: ConnectorStatus;
      hasActiveSession?: boolean;
    }>;
  }>;
}) {
  return {
    id: overrides.id ?? 'station-1',
    connectivityStatus: overrides.connectivityStatus ?? 'ONLINE',
    evses: (overrides.evses ?? []).map((evse, i) => ({
      id: `evse-${i}`,
      connectors: (evse.connectors ?? []).map((connector, j) => ({
        id: `connector-${i}-${j}`,
        status: connector.status ?? 'AVAILABLE',
        hasActiveSession: connector.hasActiveSession ?? false,
      })),
    })),
  };
}

function toPrismaRow(s: ReturnType<typeof station>) {
  return {
    id: s.id,
    connectivityStatus: s.connectivityStatus,
    evses: s.evses.map((evse) => ({
      connectors: evse.connectors.map((connector) => ({
        status: connector.status,
        chargingSessions: connector.hasActiveSession
          ? [{ id: `${connector.id}-session` }]
          : [],
      })),
    })),
  };
}

describe('StationHealthService', () => {
  let service: StationHealthService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        StationHealthService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(StationHealthService);
  });

  describe('computeHealth — precedence', () => {
    it('is offline when connectivity is OFFLINE, regardless of connector state', () => {
      const s = station({
        connectivityStatus: 'OFFLINE',
        evses: [{ connectors: [{ status: 'FAULTED' }] }],
      });
      expect(service.computeHealth(s).status).toBe('offline');
    });

    it('is unknown when connectivity is UNKNOWN, even with a faulted connector', () => {
      const s = station({
        connectivityStatus: 'UNKNOWN',
        evses: [{ connectors: [{ status: 'FAULTED' }] }],
      });
      expect(service.computeHealth(s).status).toBe('unknown');
    });

    it('offline outranks unknown — OFFLINE is checked first', () => {
      // connectivityStatus can only be one value at a time in practice, but
      // this confirms the precedence order is offline-first, not
      // unknown-first, per docs/domain/CAP-X_STATION_HEALTH.md.
      const s = station({ connectivityStatus: 'OFFLINE' });
      expect(service.computeHealth(s).status).toBe('offline');
    });

    it('is healthy when ONLINE with zero connectors (freshly created station)', () => {
      const s = station({ connectivityStatus: 'ONLINE', evses: [] });
      expect(service.computeHealth(s).status).toBe('healthy');
    });
  });

  // WO-ARGOS-057 — StationHealth reconciliation with WO-056 Operational
  // Status: "degraded" must be driven exclusively by
  // computeEvseOperationalStatus()'s requiresAttention, the same OBSERVED
  // evidence every other surface (GET /evses, EVSE detail) already uses —
  // never by the administrative Evse.status field.
  describe('computeHealth — reconciled with WO-056 Operational Status', () => {
    it('is degraded when ONLINE with a single faulted connector among several', () => {
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [
          { connectors: [{ status: 'FAULTED' }, { status: 'AVAILABLE' }] },
        ],
      });
      const result = service.computeHealth(s);
      expect(result.status).toBe('degraded');
      expect(result.reason).toContain('1 de 1');
    });

    it('is degraded, not offline, when ALL connectors are faulted but connectivity is ONLINE', () => {
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [{ connectors: [{ status: 'FAULTED' }, { status: 'FAULTED' }] }],
      });
      expect(service.computeHealth(s).status).toBe('degraded');
    });

    it('is degraded when a ChargingSession is active on a connector whose raw status disagrees (ACTIVE_SESSION_CONNECTOR_NOT_IN_USE)', () => {
      // The scenario evse-operational-status.ts exists to catch: real
      // session evidence outranks a stale connector status. Station-level
      // health must inherit this, not just the plain FAULTED case.
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [
          {
            connectors: [
              { status: 'AVAILABLE', hasActiveSession: true },
              { status: 'AVAILABLE' },
            ],
          },
        ],
      });
      expect(service.computeHealth(s).status).toBe('degraded');
    });

    it('is healthy when ONLINE with a connector plainly UNAVAILABLE next to an AVAILABLE one (no fault, no session mismatch)', () => {
      // Mirrors the exact WO-056 Digital Twin validation scenario
      // (Connector 1 AVAILABLE, Connector 2 UNAVAILABLE -> AVAILABLE, not
      // degraded) — a plain out-of-service connector must not itself read
      // as a station health problem.
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [
          { connectors: [{ status: 'AVAILABLE' }, { status: 'UNAVAILABLE' }] },
        ],
      });
      expect(service.computeHealth(s).status).toBe('healthy');
    });

    it('is healthy when ONLINE with no faulted connector and no session mismatch', () => {
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [
          { connectors: [{ status: 'AVAILABLE' }, { status: 'CHARGING' }] },
        ],
      });
      expect(service.computeHealth(s).status).toBe('healthy');
    });

    it('counts across multiple EVSEs, not just the first', () => {
      const s = station({
        connectivityStatus: 'ONLINE',
        evses: [
          { connectors: [{ status: 'AVAILABLE' }] },
          { connectors: [{ status: 'FAULTED' }] },
          { connectors: [{ status: 'AVAILABLE' }] },
        ],
      });
      const result = service.computeHealth(s);
      expect(result.status).toBe('degraded');
      expect(result.reason).toContain('1 de 3');
    });
  });

  describe('summarizeFleet', () => {
    it('tallies computed health across only ACTIVE stations, scoped to the organization', async () => {
      prisma.chargingStation.findMany.mockResolvedValue(
        [
          station({ id: 's1', connectivityStatus: 'ONLINE' }),
          station({ id: 's2', connectivityStatus: 'OFFLINE' }),
          station({
            id: 's3',
            connectivityStatus: 'ONLINE',
            evses: [{ connectors: [{ status: 'FAULTED' }] }],
          }),
        ].map(toPrismaRow),
      );

      const summary = await service.summarizeFleet('org-1');

      expect(prisma.chargingStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'ACTIVE', site: { organizationId: 'org-1' } },
        }),
      );
      expect(summary).toEqual({
        organizationId: 'org-1',
        siteId: null,
        totalStations: 3,
        healthy: 1,
        degraded: 1,
        offline: 1,
        unknown: 0,
      });
    });

    it('applies the siteId filter when provided', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([]);
      await service.summarizeFleet('org-1', 'site-9');
      expect(prisma.chargingStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: 'ACTIVE',
            site: { organizationId: 'org-1', id: 'site-9' },
          },
        }),
      );
    });
  });

  describe('summarizeConnectivity', () => {
    it('counts stations by connectivity status', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { connectivityStatus: 'ONLINE' },
        { connectivityStatus: 'ONLINE' },
        { connectivityStatus: 'OFFLINE' },
        { connectivityStatus: 'UNKNOWN' },
      ]);

      const summary = await service.summarizeConnectivity('org-1');
      expect(summary).toEqual({
        organizationId: 'org-1',
        siteId: null,
        totalStations: 4,
        online: 2,
        offline: 1,
        unknown: 1,
      });
    });
  });

  describe('summarizeBySite', () => {
    it('computes worstStatus using offline > unknown > degraded > healthy precedence', async () => {
      prisma.site.findMany.mockResolvedValue([
        {
          id: 'site-1',
          name: 'Site One',
          latitude: 4.6,
          longitude: -74.1,
          chargingStations: [
            station({ id: 's1', connectivityStatus: 'ONLINE' }),
            station({ id: 's2', connectivityStatus: 'OFFLINE' }),
          ].map(toPrismaRow),
        },
        {
          id: 'site-2',
          name: 'Site Two (no active stations)',
          latitude: 4.7,
          longitude: -74.2,
          chargingStations: [],
        },
      ]);

      const summaries = await service.summarizeBySite('org-1');

      expect(summaries[0]).toMatchObject({
        siteId: 'site-1',
        worstStatus: 'offline',
        totalStations: 2,
      });
      expect(summaries[1]).toMatchObject({
        siteId: 'site-2',
        worstStatus: 'unknown',
        totalStations: 0,
      });
    });
  });

  describe('getOccupancy', () => {
    it('computes occupancy rate over eligible connectors only', async () => {
      prisma.connector.findMany.mockResolvedValue([
        { status: 'CHARGING' },
        { status: 'OCCUPIED' },
        { status: 'AVAILABLE' },
        { status: 'AVAILABLE' },
        { status: 'FAULTED' },
        { status: 'OFFLINE' },
      ]);

      const summary = await service.getOccupancy('org-1');

      expect(summary.totalConnectors).toBe(6);
      expect(summary.occupiedCount).toBe(2);
      // eligible = AVAILABLE(2) + CHARGING(1) + OCCUPIED(1) + RESERVED(0) = 4
      expect(summary.eligibleCount).toBe(4);
      expect(summary.occupancyRate).toBe(0.5);
    });

    it('returns a null rate, not a divide-by-zero, when no connectors are eligible', async () => {
      prisma.connector.findMany.mockResolvedValue([
        { status: 'FAULTED' },
        { status: 'OFFLINE' },
      ]);

      const summary = await service.getOccupancy('org-1');
      expect(summary.occupancyRate).toBeNull();
    });
  });

  // WO-ARGOS-051 — Operations Console station attention. Explicit boundary
  // case required by the approved implementation spec: UNKNOWN must never
  // be presented as, or folded into, OFFLINE.
  describe('listOfflineStations', () => {
    it('queries only verified OFFLINE connectivity, never UNKNOWN', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([]);

      await service.listOfflineStations('org-1');

      expect(prisma.chargingStation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
            connectivityStatus: 'OFFLINE',
          }),
        }),
      );
    });

    it('maps only what the verified-OFFLINE query returns, unmodified', async () => {
      // The WHERE clause (asserted above) is what actually keeps UNKNOWN
      // stations out — this confirms the service does no further
      // reclassification of whatever Prisma hands back.
      prisma.chargingStation.findMany.mockResolvedValue([
        {
          id: 'station-1',
          name: 'Station A',
          lastDisconnectedAt: new Date('2026-08-15T10:00:00.000Z'),
          site: { id: 'site-1', name: 'Site 1' },
        },
      ]);

      const result = await service.listOfflineStations('org-1');

      expect(result).toEqual([
        {
          stationId: 'station-1',
          stationName: 'Station A',
          siteId: 'site-1',
          siteName: 'Site 1',
          lastDisconnectedAt: '2026-08-15T10:00:00.000Z',
        },
      ]);
    });
  });
});
