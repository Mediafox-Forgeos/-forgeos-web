import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';

import {
  ALLOWED_TRANSITIONS,
  SessionLifecycleService,
} from './session-lifecycle.service';
import { InvalidSessionTransitionError } from './session-lifecycle.errors';
import { TransactionIdGeneratorService } from './transaction-id-generator.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  chargingSession: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingSession: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    organizationId: 'org-1',
    siteId: 'site-1',
    chargingStationId: 'cs1',
    evseId: 'evse-1',
    connectorId: 'connector-1',
    authorizationCredentialId: 'cred-1',
    protocolVersion: 'OCPP1_6J',
    protocolTransactionId: '100',
    status: 'ACTIVE',
    terminationReason: null,
    meterStart: 1000,
    meterStop: null,
    energyWh: 0,
    startedAt: new Date('2026-07-31T00:00:00.000Z'),
    endedAt: null,
    ...overrides,
  };
}

describe('SessionLifecycleService', () => {
  let service: SessionLifecycleService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.chargingSession.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'session-new', ...data }),
    );
    prisma.chargingSession.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...baseSession(), id: where.id, ...data }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        TransactionIdGeneratorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(SessionLifecycleService);
  });

  describe('the transition table itself', () => {
    it('proves the 1.6J happy-path walk is valid hop by hop', () => {
      expect(ALLOWED_TRANSITIONS.PENDING).toContain('AUTHORIZED');
      expect(ALLOWED_TRANSITIONS.AUTHORIZED).toContain('STARTING');
      expect(ALLOWED_TRANSITIONS.STARTING).toContain('ACTIVE');
    });

    it('has no outgoing transitions from any terminal status', () => {
      expect(ALLOWED_TRANSITIONS.COMPLETED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.FAILED).toEqual([]);
      expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
    });
  });

  describe('createSession', () => {
    it('creates a new ACTIVE session with a generated protocolTransactionId', async () => {
      prisma.chargingSession.findFirst.mockResolvedValue(null);

      const session = await service.createSession({
        organizationId: 'org-1',
        siteId: 'site-1',
        chargingStationId: 'cs1',
        evseId: 'evse-1',
        connectorId: 'connector-1',
        authorizationCredentialId: 'cred-1',
        protocolVersion: 'OCPP1_6J',
        meterStart: 1000,
        startedAt: new Date('2026-07-31T00:00:00.000Z'),
      });

      expect(session.status).toBe('ACTIVE');
      expect(session.meterStart).toBe(1000);
      expect(session.energyWh).toBe(0);
      expect(typeof session.protocolTransactionId).toBe('string');
      expect(session.protocolTransactionId.length).toBeGreaterThan(0);
    });

    it('is idempotent by connector: returns the existing non-terminal session instead of creating a duplicate', async () => {
      const existing = baseSession({ id: 'session-existing' });
      prisma.chargingSession.findFirst.mockResolvedValue(existing);

      const result = await service.createSession({
        organizationId: 'org-1',
        siteId: 'site-1',
        chargingStationId: 'cs1',
        evseId: 'evse-1',
        connectorId: 'connector-1',
        authorizationCredentialId: 'cred-1',
        protocolVersion: 'OCPP1_6J',
        meterStart: 1000,
        startedAt: new Date(),
      });

      expect(result.id).toBe('session-existing');
      expect(prisma.chargingSession.create).not.toHaveBeenCalled();
    });
  });

  describe('activateSession / suspendSession / resumeSession', () => {
    it('activates a STARTING session to ACTIVE', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'STARTING' }),
      );
      const result = await service.activateSession('session-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('rejects activating a PENDING session directly to ACTIVE', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'PENDING' }),
      );
      await expect(service.activateSession('session-1')).rejects.toBeInstanceOf(
        InvalidSessionTransitionError,
      );
    });

    it('suspends an ACTIVE session to SUSPENDED by default', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE' }),
      );
      const result = await service.suspendSession('session-1');
      expect(result.status).toBe('SUSPENDED');
    });

    it('suspends an ACTIVE session to OFFLINE when explicitly requested', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE' }),
      );
      const result = await service.suspendSession('session-1', 'OFFLINE');
      expect(result.status).toBe('OFFLINE');
    });

    it('resumes an OFFLINE session back to ACTIVE', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'OFFLINE' }),
      );
      const result = await service.resumeSession('session-1');
      expect(result.status).toBe('ACTIVE');
    });

    it('resumes a SUSPENDED session back to ACTIVE', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'SUSPENDED' }),
      );
      const result = await service.resumeSession('session-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('stopSession', () => {
    it('completes an ACTIVE session, finalizing meterStop/energyWh/endedAt', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE', meterStart: 1000 }),
      );

      const result = await service.stopSession('session-1', {
        meterStop: 2500,
        reason: 'NORMAL_COMPLETION',
      });

      expect(prisma.chargingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            meterStop: 2500,
            energyWh: 1500,
            terminationReason: 'NORMAL_COMPLETION',
          }),
        }),
      );
      expect(result.status).toBe('COMPLETED');
    });

    it('floors energyWh at 0 rather than persisting a negative value', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE', meterStart: 2000 }),
      );

      await service.stopSession('session-1', {
        meterStop: 1500, // less than meterStart — a corrupt/out-of-order report
        reason: 'UNKNOWN',
      });

      expect(prisma.chargingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ energyWh: 0 }),
        }),
      );
    });

    it('refuses to stop an already-COMPLETED session — a session cannot finish twice', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'COMPLETED', endedAt: new Date() }),
      );

      await expect(
        service.stopSession('session-1', {
          meterStop: 2500,
          reason: 'NORMAL_COMPLETION',
        }),
      ).rejects.toBeInstanceOf(InvalidSessionTransitionError);
      expect(prisma.chargingSession.update).not.toHaveBeenCalled();
    });

    it('stops an OFFLINE session directly (ACTIVE and OFFLINE both allow STOPPING)', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'OFFLINE', meterStart: 1000 }),
      );
      const result = await service.stopSession('session-1', {
        meterStop: 1800,
        reason: 'NETWORK_FAILURE',
      });
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('failSession', () => {
    it('fails an ACTIVE session', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE' }),
      );
      const result = await service.failSession('session-1', 'FAULT');
      expect(result.status).toBe('FAILED');
    });

    it('refuses to fail an already-terminal session', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'FAILED' }),
      );
      await expect(
        service.failSession('session-1', 'FAULT'),
      ).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    });
  });

  describe('cancelSession', () => {
    it('cancels a PENDING session with the default USER_CANCELLED reason', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'PENDING' }),
      );
      const result = await service.cancelSession('session-1');
      expect(result.status).toBe('CANCELLED');
      expect(prisma.chargingSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            terminationReason: 'USER_CANCELLED',
          }),
        }),
      );
    });

    it('cancels an ACTIVE session too, per the WO Phase 4 "Handle: ACTIVE -> CANCELLED" rule', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE' }),
      );
      const result = await service.cancelSession('session-1');
      expect(result.status).toBe('CANCELLED');
    });
  });

  describe('updateEnergy', () => {
    it('updates energyWh on a non-terminal session', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'ACTIVE', energyWh: 500 }),
      );
      const result = await service.updateEnergy('session-1', 750);
      expect(result.energyWh).toBe(750);
    });

    it('refuses to update energy on a terminal session', async () => {
      prisma.chargingSession.findUnique.mockResolvedValue(
        baseSession({ status: 'COMPLETED' }),
      );
      await expect(
        service.updateEnergy('session-1', 750),
      ).rejects.toBeInstanceOf(InvalidSessionTransitionError);
    });
  });

  it('throws NotFoundException for a transition on a non-existent session', async () => {
    prisma.chargingSession.findUnique.mockResolvedValue(null);
    await expect(service.activateSession('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
