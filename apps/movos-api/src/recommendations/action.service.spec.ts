import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { ActionService } from './action.service';
import { RecommendationService } from './recommendation.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  action: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  membership: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    action: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    membership: { findFirst: jest.fn() },
  };
}

const LIVE_RECOMMENDATION = {
  type: 'ENERGY_ANOMALY' as const,
  title: 'Anomalía de energía',
  severity: 'HIGH' as const,
  explanation: 'explicación',
  evidence: ['dato 1', 'dato 2'],
  recommendedAction: 'acción sugerida',
  stationId: 'station-1',
  stationName: 'Station 1',
  generatedAt: new Date().toISOString(),
};

function actionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'action-1',
    organizationId: 'org-1',
    chargingStationId: 'station-1',
    recommendationType: 'ENERGY_ANOMALY',
    title: LIVE_RECOMMENDATION.title,
    severity: LIVE_RECOMMENDATION.severity,
    explanation: LIVE_RECOMMENDATION.explanation,
    evidence: LIVE_RECOMMENDATION.evidence,
    recommendedAction: LIVE_RECOMMENDATION.recommendedAction,
    status: 'OPEN',
    assignedToUserId: null,
    snoozedUntil: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
    chargingStation: { name: 'Station 1' },
    assignedTo: null,
    ...overrides,
  };
}

describe('ActionService', () => {
  let service: ActionService;
  let prisma: PrismaMock;
  let recommendations: { getAll: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    recommendations = {
      getAll: jest.fn().mockResolvedValue([LIVE_RECOMMENDATION]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ActionService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecommendationService, useValue: recommendations },
      ],
    }).compile();
    service = moduleRef.get(ActionService);
  });

  describe('findRelevant', () => {
    it('returns null when no Action exists', async () => {
      prisma.action.findFirst.mockResolvedValue(null);
      expect(
        await service.findRelevant('org-1', 'station-1', 'ENERGY_ANOMALY'),
      ).toBeNull();
    });

    it('returns a non-terminal Action regardless of age', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({
          status: 'ACKNOWLEDGED',
          updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60_000),
        }),
      );
      const result = await service.findRelevant(
        'org-1',
        'station-1',
        'ENERGY_ANOMALY',
      );
      expect(result?.status).toBe('ACKNOWLEDGED');
    });

    it('returns a terminal Action still inside its cooldown window', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({
          status: 'RESOLVED',
          resolvedAt: new Date(Date.now() - 5 * 60_000),
        }),
      );
      const result = await service.findRelevant(
        'org-1',
        'station-1',
        'ENERGY_ANOMALY',
      );
      expect(result?.status).toBe('RESOLVED');
    });

    it('returns null for a terminal Action past its cooldown window', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({
          status: 'DISMISSED',
          resolvedAt: new Date(Date.now() - 2 * 60 * 60_000),
        }),
      );
      expect(
        await service.findRelevant('org-1', 'station-1', 'ENERGY_ANOMALY'),
      ).toBeNull();
    });
  });

  describe('create', () => {
    it('snapshots the live recommendation and applies the first transition', async () => {
      prisma.action.findFirst.mockResolvedValue(null); // no existing relevant action
      prisma.action.create.mockResolvedValue(actionRow({ status: 'OPEN' }));
      prisma.action.update.mockResolvedValue(
        actionRow({ status: 'ACKNOWLEDGED' }),
      );

      const result = await service.create('org-1', {
        recommendationType: 'ENERGY_ANOMALY',
        stationId: 'station-1',
        transition: 'acknowledge',
      });

      expect(prisma.action.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: LIVE_RECOMMENDATION.title,
            evidence: LIVE_RECOMMENDATION.evidence,
            status: 'OPEN',
          }),
        }),
      );
      expect(result.status).toBe('ACKNOWLEDGED');
    });

    it('throws NotFoundException when the recommendation is no longer live', async () => {
      prisma.action.findFirst.mockResolvedValue(null);
      await expect(
        service.create('org-1', {
          recommendationType: 'IDLE_CONNECTOR', // not in the mocked live list
          stationId: 'station-1',
          transition: 'acknowledge',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.action.create).not.toHaveBeenCalled();
    });

    it('reuses an existing non-terminal Action instead of creating a duplicate', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'ACKNOWLEDGED' }),
      );
      prisma.action.update.mockResolvedValue(
        actionRow({ status: 'ASSIGNED', assignedToUserId: 'user-2' }),
      );
      prisma.membership.findFirst.mockResolvedValue({
        id: 'm1',
        status: 'ACTIVE',
      });

      const result = await service.create('org-1', {
        recommendationType: 'ENERGY_ANOMALY',
        stationId: 'station-1',
        transition: 'assign',
        assignedToUserId: 'user-2',
      });

      expect(prisma.action.create).not.toHaveBeenCalled();
      expect(result.status).toBe('ASSIGNED');
    });
  });

  describe('transition', () => {
    it('throws NotFoundException for an action in another organization', async () => {
      prisma.action.findFirst.mockResolvedValue(null);
      await expect(
        service.transition('org-1', 'action-1', { transition: 'acknowledge' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an invalid transition for the current state', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'RESOLVED' }),
      );
      await expect(
        service.transition('org-1', 'action-1', { transition: 'acknowledge' }),
      ).rejects.toThrow(ConflictException);
    });

    it('requires notes to resolve', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'ACKNOWLEDGED' }),
      );
      await expect(
        service.transition('org-1', 'action-1', { transition: 'resolve' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires notes to dismiss', async () => {
      prisma.action.findFirst.mockResolvedValue(actionRow({ status: 'OPEN' }));
      await expect(
        service.transition('org-1', 'action-1', { transition: 'dismiss' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves with notes and sets resolvedAt', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'ASSIGNED' }),
      );
      prisma.action.update.mockResolvedValue(
        actionRow({
          status: 'RESOLVED',
          notes: 'arreglado',
          resolvedAt: new Date(),
        }),
      );
      const result = await service.transition('org-1', 'action-1', {
        transition: 'resolve',
        notes: 'arreglado',
      });
      expect(result.status).toBe('RESOLVED');
      expect(prisma.action.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESOLVED',
            notes: 'arreglado',
          }),
        }),
      );
    });

    it('requires assignedToUserId to assign', async () => {
      prisma.action.findFirst.mockResolvedValue(actionRow({ status: 'OPEN' }));
      await expect(
        service.transition('org-1', 'action-1', { transition: 'assign' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects assigning to a user without an active membership', async () => {
      prisma.action.findFirst.mockResolvedValue(actionRow({ status: 'OPEN' }));
      prisma.membership.findFirst.mockResolvedValue(null);
      await expect(
        service.transition('org-1', 'action-1', {
          transition: 'assign',
          assignedToUserId: 'user-9',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('snoozing an OPEN action also acknowledges it', async () => {
      prisma.action.findFirst.mockResolvedValue(actionRow({ status: 'OPEN' }));
      prisma.action.update.mockResolvedValue(
        actionRow({
          status: 'ACKNOWLEDGED',
          snoozedUntil: new Date(Date.now() + 60 * 60_000),
        }),
      );
      const result = await service.transition('org-1', 'action-1', {
        transition: 'snooze',
        snoozeMinutes: 60,
      });
      expect(result.status).toBe('ACKNOWLEDGED');
      expect(prisma.action.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACKNOWLEDGED' }),
        }),
      );
    });

    it('rejects a snooze duration outside 1 minute to 7 days', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'ACKNOWLEDGED' }),
      );
      await expect(
        service.transition('org-1', 'action-1', {
          transition: 'snooze',
          snoozeMinutes: 999999,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cannot transition further from a terminal state', async () => {
      prisma.action.findFirst.mockResolvedValue(
        actionRow({ status: 'DISMISSED' }),
      );
      await expect(
        service.transition('org-1', 'action-1', {
          transition: 'resolve',
          notes: 'x',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('filters by status when provided', async () => {
      prisma.action.findMany.mockResolvedValue([]);
      await service.list('org-1', 'ASSIGNED');
      expect(prisma.action.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'ASSIGNED' },
        }),
      );
    });
  });
});
