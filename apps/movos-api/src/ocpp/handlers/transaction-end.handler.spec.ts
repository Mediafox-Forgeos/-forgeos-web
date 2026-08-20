import { Test } from '@nestjs/testing';

import { TransactionEndHandler } from './transaction-end.handler';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { RemoteCommandConfirmationService } from '../remote-commands/remote-command-confirmation.service';
import { PrismaService } from '../../prisma/prisma.service';

const station = { id: 'cs1' } as import('@prisma/client').ChargingStation;

describe('TransactionEndHandler', () => {
  let handler: TransactionEndHandler;
  let prisma: { chargingSession: { findFirst: jest.Mock } };
  let sessionLifecycle: { stopSession: jest.Mock };
  let remoteCommandConfirmation: { onStopTransactionObserved: jest.Mock };

  beforeEach(async () => {
    prisma = { chargingSession: { findFirst: jest.fn() } };
    sessionLifecycle = { stopSession: jest.fn().mockResolvedValue({}) };
    remoteCommandConfirmation = {
      onStopTransactionObserved: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionEndHandler,
        { provide: PrismaService, useValue: prisma },
        { provide: SessionLifecycleService, useValue: sessionLifecycle },
        {
          provide: RemoteCommandConfirmationService,
          useValue: remoteCommandConfirmation,
        },
      ],
    }).compile();

    handler = moduleRef.get(TransactionEndHandler);
  });

  it('stops the matching session, mapping the OCPP reason to a termination reason', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({
      id: 'session-1',
      status: 'ACTIVE',
    });

    const result = await handler.handle(
      {
        type: 'TransactionEnd',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        meterStop: 2500,
        reason: 'EVDisconnected',
        timestamp: '2026-07-31T01:00:00.000Z',
      },
      station,
    );

    expect(sessionLifecycle.stopSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        meterStop: 2500,
        reason: 'CABLE_DISCONNECTED',
      }),
    );
    expect(result).toEqual({ status: 'Accepted' });
    expect(
      remoteCommandConfirmation.onStopTransactionObserved,
    ).toHaveBeenCalledWith('session-1');
  });

  it('rejects gracefully when the transactionRef matches no session', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue(null);

    const result = await handler.handle(
      {
        type: 'TransactionEnd',
        stationIdentity: 'movos-abc123',
        transactionRef: '999999',
        meterStop: 2500,
        timestamp: '2026-07-31T01:00:00.000Z',
      },
      station,
    );

    expect(sessionLifecycle.stopSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'Rejected' });
  });

  it('is idempotent for an already-COMPLETED session — a session cannot finish twice', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({
      id: 'session-1',
      status: 'COMPLETED',
    });

    const result = await handler.handle(
      {
        type: 'TransactionEnd',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        meterStop: 2500,
        timestamp: '2026-07-31T01:00:00.000Z',
      },
      station,
    );

    expect(sessionLifecycle.stopSession).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'Accepted' });
  });

  it('treats an absent reason as NORMAL_COMPLETION', async () => {
    prisma.chargingSession.findFirst.mockResolvedValue({
      id: 'session-1',
      status: 'ACTIVE',
    });

    await handler.handle(
      {
        type: 'TransactionEnd',
        stationIdentity: 'movos-abc123',
        transactionRef: '42',
        meterStop: 2500,
        timestamp: '2026-07-31T01:00:00.000Z',
      },
      station,
    );

    expect(sessionLifecycle.stopSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ reason: 'NORMAL_COMPLETION' }),
    );
  });
});
