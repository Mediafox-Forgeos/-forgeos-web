import { Test } from '@nestjs/testing';

import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  chargingSession: { findMany: jest.Mock; groupBy: jest.Mock };
  authorizationAttempt: { findMany: jest.Mock };
  chargingStation: { findMany: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingSession: { findMany: jest.fn(), groupBy: jest.fn() },
    authorizationAttempt: { findMany: jest.fn() },
    chargingStation: { findMany: jest.fn() },
  };
}

describe('RecommendationService', () => {
  let service: RecommendationService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RecommendationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(RecommendationService);
  });

  describe('getEnergyAnomaly', () => {
    const stale = new Date(Date.now() - 10 * 60_000); // 10 min ago

    it('fires when a session delivers well under its connector rated power', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connector: { maxPowerKw: 150 },
          chargingStation: { id: 's1', name: 'Station 1' },
          meterValues: [
            { powerW: 40000, timestamp: new Date() },
            { powerW: 42000, timestamp: new Date() },
          ],
          startedAt: stale,
        },
      ]);

      const result = await service.getEnergyAnomaly('org-1');
      expect(result?.type).toBe('ENERGY_ANOMALY');
      expect(result?.severity).toBe('high'); // 41000/150000 ≈ 27% < 30%
      expect(result?.stationName).toBe('Station 1');
    });

    it('does not fire when power is close to rated capacity', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connector: { maxPowerKw: 150 },
          chargingStation: { id: 's1', name: 'Station 1' },
          meterValues: [
            { powerW: 145000, timestamp: new Date() },
            { powerW: 148000, timestamp: new Date() },
          ],
          startedAt: stale,
        },
      ]);
      expect(await service.getEnergyAnomaly('org-1')).toBeNull();
    });

    it('does not fire for a session running less than 5 minutes (ramp-up)', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connector: { maxPowerKw: 150 },
          chargingStation: { id: 's1', name: 'Station 1' },
          meterValues: [
            { powerW: 10000, timestamp: new Date() },
            { powerW: 12000, timestamp: new Date() },
          ],
          startedAt: new Date(),
        },
      ]);
      expect(await service.getEnergyAnomaly('org-1')).toBeNull();
    });

    it('does not fire with fewer than 2 meter readings', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connector: { maxPowerKw: 150 },
          chargingStation: { id: 's1', name: 'Station 1' },
          meterValues: [{ powerW: 10000, timestamp: new Date() }],
          startedAt: stale,
        },
      ]);
      expect(await service.getEnergyAnomaly('org-1')).toBeNull();
    });
  });

  describe('getAuthFailureSpike', () => {
    it('fires when a station has a high rejection share over the window', async () => {
      prisma.authorizationAttempt.findMany.mockResolvedValue([
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'ACCEPTED' },
      ]);
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);

      const result = await service.getAuthFailureSpike('org-1');
      expect(result?.type).toBe('AUTH_FAILURE_SPIKE');
      expect(result?.severity).toBe('high'); // 4/5 = 80%
    });

    it('does not fire below the minimum attempt count', async () => {
      prisma.authorizationAttempt.findMany.mockResolvedValue([
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'REJECTED' },
      ]);
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);
      expect(await service.getAuthFailureSpike('org-1')).toBeNull();
    });

    it('does not fire when rejection share is within normal range', async () => {
      prisma.authorizationAttempt.findMany.mockResolvedValue([
        { chargingStationId: 's1', result: 'REJECTED' },
        { chargingStationId: 's1', result: 'ACCEPTED' },
        { chargingStationId: 's1', result: 'ACCEPTED' },
        { chargingStationId: 's1', result: 'ACCEPTED' },
      ]);
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);
      expect(await service.getAuthFailureSpike('org-1')).toBeNull();
    });
  });

  describe('getIdleConnector', () => {
    it('fires when the most recent session on a connector ended >15 min ago and the connector never returned to AVAILABLE', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connectorId: 'c1',
          connector: { status: 'OCCUPIED' },
          chargingStation: { id: 's1', name: 'Station 1' },
          endedAt: new Date(Date.now() - 90 * 60_000),
        },
      ]);
      const result = await service.getIdleConnector('org-1');
      expect(result?.type).toBe('IDLE_CONNECTOR');
      expect(result?.severity).toBe('high'); // >60 min
    });

    it('does not fire when the connector already returned to AVAILABLE', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connectorId: 'c1',
          connector: { status: 'AVAILABLE' },
          chargingStation: { id: 's1', name: 'Station 1' },
          endedAt: new Date(Date.now() - 90 * 60_000),
        },
      ]);
      expect(await service.getIdleConnector('org-1')).toBeNull();
    });

    it('does not fire within the 15-minute grace window', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connectorId: 'c1',
          connector: { status: 'OCCUPIED' },
          chargingStation: { id: 's1', name: 'Station 1' },
          endedAt: new Date(Date.now() - 5 * 60_000),
        },
      ]);
      expect(await service.getIdleConnector('org-1')).toBeNull();
    });

    it('only considers the most recent session per connector', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([
        {
          connectorId: 'c1',
          connector: { status: 'AVAILABLE' },
          chargingStation: { id: 's1', name: 'Station 1' },
          endedAt: new Date(Date.now() - 5 * 60_000), // most recent — fine
        },
        {
          connectorId: 'c1',
          connector: { status: 'AVAILABLE' },
          chargingStation: { id: 's1', name: 'Station 1' },
          endedAt: new Date(Date.now() - 200 * 60_000), // stale, should be ignored
        },
      ]);
      expect(await service.getIdleConnector('org-1')).toBeNull();
    });
  });

  describe('getComparativeUnderperformance', () => {
    it('fires when a station delivers far less energy than its site peers', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1', siteId: 'site-1' },
        { id: 's2', name: 'Station 2', siteId: 'site-1' },
      ]);
      prisma.chargingSession.groupBy.mockResolvedValue([
        { chargingStationId: 's1', _sum: { energyWh: 1000 } },
        { chargingStationId: 's2', _sum: { energyWh: 10000 } },
      ]);

      const result = await service.getComparativeUnderperformance('org-1');
      expect(result?.type).toBe('COMPARATIVE_UNDERPERFORMANCE');
      expect(result?.stationName).toBe('Station 1');
    });

    it('does not fire when there is only one station at a site', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1', siteId: 'site-1' },
      ]);
      prisma.chargingSession.groupBy.mockResolvedValue([
        { chargingStationId: 's1', _sum: { energyWh: 1000 } },
      ]);
      expect(await service.getComparativeUnderperformance('org-1')).toBeNull();
    });

    it('does not fire when stations are comparable', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1', siteId: 'site-1' },
        { id: 's2', name: 'Station 2', siteId: 'site-1' },
      ]);
      prisma.chargingSession.groupBy.mockResolvedValue([
        { chargingStationId: 's1', _sum: { energyWh: 9000 } },
        { chargingStationId: 's2', _sum: { energyWh: 10000 } },
      ]);
      expect(await service.getComparativeUnderperformance('org-1')).toBeNull();
    });
  });

  describe('getEfficiencyDrift', () => {
    function session(energyWh: number, minutes: number, startOffset: number) {
      const startedAt = new Date(Date.now() - startOffset * 60_000);
      const endedAt = new Date(startedAt.getTime() + minutes * 60_000);
      return { energyWh, startedAt, endedAt };
    }

    it('fires when recent sessions deliver energy meaningfully slower than older ones', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);
      // Older sessions: ~1000 Wh/min. Recent: ~600 Wh/min (40% drop).
      prisma.chargingSession.findMany.mockResolvedValue([
        session(30000, 30, 10000),
        session(30000, 30, 9000),
        session(18000, 30, 2000),
        session(18000, 30, 1000),
      ]);

      const result = await service.getEfficiencyDrift('org-1');
      expect(result?.type).toBe('EFFICIENCY_DRIFT');
      expect(result?.severity).toBe('high'); // 40% drop > 30%
    });

    it('does not fire with fewer than 4 completed sessions', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);
      prisma.chargingSession.findMany.mockResolvedValue([
        session(30000, 30, 3000),
        session(18000, 30, 1000),
      ]);
      expect(await service.getEfficiencyDrift('org-1')).toBeNull();
    });

    it('does not fire when the rate is stable', async () => {
      prisma.chargingStation.findMany.mockResolvedValue([
        { id: 's1', name: 'Station 1' },
      ]);
      prisma.chargingSession.findMany.mockResolvedValue([
        session(30000, 30, 4000),
        session(30000, 30, 3000),
        session(30000, 30, 2000),
        session(30000, 30, 1000),
      ]);
      expect(await service.getEfficiencyDrift('org-1')).toBeNull();
    });
  });

  describe('getAll', () => {
    it('returns at most 5 recommendations, filtering out nulls', async () => {
      prisma.chargingSession.findMany.mockResolvedValue([]);
      prisma.chargingSession.groupBy.mockResolvedValue([]);
      prisma.authorizationAttempt.findMany.mockResolvedValue([]);
      prisma.chargingStation.findMany.mockResolvedValue([]);

      const result = await service.getAll('org-1');
      expect(result).toEqual([]);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });
});
