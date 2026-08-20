import { Test } from '@nestjs/testing';
import { RemoteCommandState, RemoteCommandType } from '@prisma/client';

import {
  REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
  RemoteCommandConfirmationService,
} from './remote-command-confirmation.service';
import { RemoteCommandService } from './remote-command.service';
import { PrismaService } from '../../prisma/prisma.service';

const TEST_WINDOW_MS = 200;

function commandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    organizationId: 'org-1',
    chargingStationId: 'cs1',
    connectorId: 'connector-1',
    chargingSessionId: null,
    commandType: RemoteCommandType.REMOTE_START,
    state: RemoteCommandState.ACCEPTED,
    requestedAt: new Date(Date.now() - 1000),
    ...overrides,
  };
}

describe('RemoteCommandConfirmationService (WO-ARGOS-064)', () => {
  let service: RemoteCommandConfirmationService;
  let prisma: {
    remoteCommand: { findFirst: jest.Mock; findUnique: jest.Mock };
    chargingSession: { findFirst: jest.Mock; findUnique: jest.Mock };
  };
  let remoteCommands: { confirmCommand: jest.Mock; markUnconfirmed: jest.Mock };

  beforeEach(async () => {
    prisma = {
      remoteCommand: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
      },
      chargingSession: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    remoteCommands = {
      confirmCommand: jest.fn().mockResolvedValue({}),
      markUnconfirmed: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RemoteCommandConfirmationService,
        { provide: PrismaService, useValue: prisma },
        { provide: RemoteCommandService, useValue: remoteCommands },
        {
          provide: REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
          useValue: TEST_WINDOW_MS,
        },
      ],
    }).compile();

    service = moduleRef.get(RemoteCommandConfirmationService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('onStartTransactionObserved', () => {
    it('confirms the matching ACCEPTED REMOTE_START command for the exact connector', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(commandRow());

      await service.onStartTransactionObserved('cs1', 'connector-1', {
        id: 'session-99',
      } as never);

      expect(remoteCommands.confirmCommand).toHaveBeenCalledWith(
        'cmd-1',
        'session-99',
      );
    });

    it('is a no-op when no ACCEPTED REMOTE_START command exists for the connector (the organic case)', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(null);

      await service.onStartTransactionObserved('cs1', 'connector-1', {
        id: 'session-99',
      } as never);

      expect(remoteCommands.confirmCommand).not.toHaveBeenCalled();
    });
  });

  describe('onStopTransactionObserved', () => {
    it('confirms the matching ACCEPTED REMOTE_STOP command for the exact session', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(
        commandRow({
          commandType: RemoteCommandType.REMOTE_STOP,
          connectorId: null,
          chargingSessionId: 'session-1',
        }),
      );

      await service.onStopTransactionObserved('session-1');

      expect(remoteCommands.confirmCommand).toHaveBeenCalledWith(
        'cmd-1',
        undefined,
      );
    });

    it('is a no-op when no ACCEPTED REMOTE_STOP command targets this session', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(null);
      await service.onStopTransactionObserved('session-1');
      expect(remoteCommands.confirmCommand).not.toHaveBeenCalled();
    });
  });

  describe('registerAccepted — immediate check (WO-063 §13 natural-completion race)', () => {
    it('RemoteStart: confirms immediately if a matching ACTIVE session already exists on the connector', async () => {
      const command = commandRow();
      prisma.chargingSession.findFirst.mockResolvedValue({
        id: 'session-already-there',
        status: 'ACTIVE',
      });

      service.registerAccepted(command as never);
      await Promise.resolve();
      await Promise.resolve();

      expect(remoteCommands.confirmCommand).toHaveBeenCalledWith(
        'cmd-1',
        'session-already-there',
      );
    });

    it('RemoteStop: confirms immediately if the target session is already COMPLETED', async () => {
      const command = commandRow({
        commandType: RemoteCommandType.REMOTE_STOP,
        connectorId: null,
        chargingSessionId: 'session-1',
      });
      prisma.chargingSession.findUnique.mockResolvedValue({
        id: 'session-1',
        status: 'COMPLETED',
      });

      service.registerAccepted(command as never);
      await Promise.resolve();
      await Promise.resolve();

      expect(remoteCommands.confirmCommand).toHaveBeenCalledWith(
        'cmd-1',
        undefined,
      );
    });

    it('does nothing for a command that is not ACCEPTED', () => {
      service.registerAccepted(
        commandRow({ state: RemoteCommandState.SENT }) as never,
      );
      expect(remoteCommands.confirmCommand).not.toHaveBeenCalled();
      expect(remoteCommands.markUnconfirmed).not.toHaveBeenCalled();
    });
  });

  describe('confirmation window expiry', () => {
    it('marks UNCONFIRMED after the window elapses with nothing observed', async () => {
      jest.useFakeTimers();
      prisma.remoteCommand.findUnique.mockResolvedValue(commandRow());

      service.registerAccepted(commandRow() as never);
      await jest.advanceTimersByTimeAsync(TEST_WINDOW_MS + 10);

      expect(remoteCommands.markUnconfirmed).toHaveBeenCalledWith(
        'cmd-1',
        expect.stringContaining('ventana de confirmación'),
      );
    });

    it('does not mark UNCONFIRMED if the command was already resolved before the window elapsed (race won by the observed event)', async () => {
      jest.useFakeTimers();
      // By the time the timer fires, confirmCommand already ran and the row
      // is no longer ACCEPTED — the DB re-check inside expire() must catch
      // this and skip.
      prisma.remoteCommand.findUnique.mockResolvedValue(
        commandRow({ state: RemoteCommandState.CONFIRMED }),
      );

      service.registerAccepted(commandRow() as never);
      await jest.advanceTimersByTimeAsync(TEST_WINDOW_MS + 10);

      expect(remoteCommands.markUnconfirmed).not.toHaveBeenCalled();
    });
  });

  describe('race safety', () => {
    it('confirm() swallows an already-resolved transition error rather than throwing', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(commandRow());
      remoteCommands.confirmCommand.mockRejectedValue(
        new Error(
          'Cannot transition a RemoteCommand from CONFIRMED to CONFIRMED',
        ),
      );

      await expect(
        service.onStartTransactionObserved('cs1', 'connector-1', {
          id: 'session-99',
        } as never),
      ).resolves.toBeUndefined();
    });
  });
});
