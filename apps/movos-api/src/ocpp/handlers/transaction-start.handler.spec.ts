import { Test } from '@nestjs/testing';

import { TransactionStartHandler } from './transaction-start.handler';
import { AuthorizationAttemptsService } from '../../authorization/authorization-attempts.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { RemoteCommandConfirmationService } from '../remote-commands/remote-command-confirmation.service';
import { PrismaService } from '../../prisma/prisma.service';

const station = {
  id: 'cs1',
  siteId: 'site-1',
} as import('@prisma/client').ChargingStation;

const baseEvent = {
  type: 'TransactionStart' as const,
  stationIdentity: 'movos-abc123',
  connectorExternalId: '1',
  idTag: 'ABC123',
  meterStart: 1000,
  timestamp: '2026-07-31T00:00:00.000Z',
  protocolVersion: 'OCPP1_6J' as const,
};

describe('TransactionStartHandler', () => {
  let handler: TransactionStartHandler;
  let prisma: {
    site: { findUniqueOrThrow: jest.Mock };
    connector: { findFirst: jest.Mock };
  };
  let attempts: { recordAttempt: jest.Mock };
  let sessionLifecycle: { createSession: jest.Mock };
  let remoteCommandConfirmation: { onStartTransactionObserved: jest.Mock };

  beforeEach(async () => {
    prisma = {
      site: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ organizationId: 'org-1' }),
      },
      connector: { findFirst: jest.fn() },
    };
    attempts = { recordAttempt: jest.fn() };
    sessionLifecycle = { createSession: jest.fn() };
    remoteCommandConfirmation = {
      onStartTransactionObserved: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionStartHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthorizationAttemptsService, useValue: attempts },
        { provide: SessionLifecycleService, useValue: sessionLifecycle },
        {
          provide: RemoteCommandConfirmationService,
          useValue: remoteCommandConfirmation,
        },
      ],
    }).compile();

    handler = moduleRef.get(TransactionStartHandler);
  });

  it('creates a session when the connector resolves and the attempt is ACCEPTED', async () => {
    prisma.connector.findFirst.mockResolvedValue({
      id: 'connector-1',
      evseId: 'evse-1',
    });
    attempts.recordAttempt.mockResolvedValue({
      attempt: { result: 'ACCEPTED', authorizationCredentialId: 'cred-1' },
      credential: { id: 'cred-1' },
    });
    sessionLifecycle.createSession.mockResolvedValue({
      id: 'session-1',
      protocolTransactionId: '42',
    });

    const result = await handler.handle(baseEvent, station);

    expect(sessionLifecycle.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        chargingStationId: 'cs1',
        evseId: 'evse-1',
        connectorId: 'connector-1',
        authorizationCredentialId: 'cred-1',
        meterStart: 1000,
      }),
    );
    expect(result).toEqual({
      status: 'Accepted',
      payload: {
        idTagStatus: 'Accepted',
        protocolTransactionId: '42',
        sessionId: 'session-1',
      },
    });
    // WO-ARGOS-064 — every real StartTransaction notifies the confirmation
    // layer, connector-scoped; a no-op internally when no RemoteCommand is
    // waiting, but the handler must always call it.
    expect(
      remoteCommandConfirmation.onStartTransactionObserved,
    ).toHaveBeenCalledWith('cs1', 'connector-1', {
      id: 'session-1',
      protocolTransactionId: '42',
    });
  });

  it('never creates a session when the authorization attempt is rejected — DEC-014/rejected-never-creates-session', async () => {
    prisma.connector.findFirst.mockResolvedValue({
      id: 'connector-1',
      evseId: 'evse-1',
    });
    attempts.recordAttempt.mockResolvedValue({
      attempt: { result: 'UNKNOWN', authorizationCredentialId: null },
      credential: null,
    });

    const result = await handler.handle(baseEvent, station);

    expect(sessionLifecycle.createSession).not.toHaveBeenCalled();
    expect(result.status).toBe('Rejected');
  });

  it('never creates a session when the target connector cannot be resolved, but still records the attempt', async () => {
    prisma.connector.findFirst.mockResolvedValue(null);
    attempts.recordAttempt.mockResolvedValue({
      attempt: { result: 'ACCEPTED', authorizationCredentialId: 'cred-1' },
      credential: { id: 'cred-1' },
    });

    const result = await handler.handle(baseEvent, station);

    expect(sessionLifecycle.createSession).not.toHaveBeenCalled();
    expect(attempts.recordAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ presentedIdentifier: 'ABC123' }),
    );
    expect(result.status).toBe('Rejected');
  });
});
