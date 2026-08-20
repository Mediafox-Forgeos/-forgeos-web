import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RemoteCommandState, RemoteCommandType } from '@prisma/client';

import { RemoteCommandService } from './remote-command.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { PendingCallRegistryService } from '../outbound/pending-call-registry.service';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from '../protocol/ocpp201/ocpp201-adapter';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const STATION_ID = 'station-1';
const CONNECTOR_ID = 'connector-1';
const SESSION_ID = 'session-1';
const CREDENTIAL_ID = 'credential-1';
const ACTOR = 'user-1';
const OCPP_IDENTITY = 'movos-abc123';

function station(
  overrides: Partial<{ id: string; ocppIdentity: string | null }> = {},
) {
  return { id: STATION_ID, ocppIdentity: OCPP_IDENTITY, ...overrides };
}

function connector(
  overrides: Partial<{ id: string; externalId: string; status: string }> = {},
) {
  return {
    id: CONNECTOR_ID,
    externalId: '1',
    status: 'AVAILABLE',
    ...overrides,
  };
}

function session(
  overrides: Partial<{
    id: string;
    connectorId: string;
    chargingStationId: string;
    protocolTransactionId: string;
    status: string;
  }> = {},
) {
  return {
    id: SESSION_ID,
    connectorId: CONNECTOR_ID,
    chargingStationId: STATION_ID,
    protocolTransactionId: '55526',
    status: 'ACTIVE',
    ...overrides,
  };
}

function credential(
  overrides: Partial<{
    id: string;
    externalIdentifier: string;
    status: string;
  }> = {},
) {
  return {
    id: CREDENTIAL_ID,
    externalIdentifier: 'RFID-XYZ',
    status: 'ACTIVE',
    ...overrides,
  };
}

function remoteCommandRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmd-1',
    organizationId: ORG,
    chargingStationId: STATION_ID,
    connectorId: CONNECTOR_ID,
    chargingSessionId: null,
    commandType: RemoteCommandType.REMOTE_START,
    state: RemoteCommandState.REQUESTED,
    requestedByUserId: ACTOR,
    requestPayload: null,
    responsePayload: null,
    protocolMessageId: null,
    rejectionReason: null,
    requestedAt: new Date(),
    sentAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe('RemoteCommandService (WO-ARGOS-059)', () => {
  let service: RemoteCommandService;
  let prisma: {
    chargingStation: { findFirst: jest.Mock };
    connector: { findFirst: jest.Mock; findUnique: jest.Mock };
    chargingSession: { findFirst: jest.Mock };
    authorizationCredential: { findFirst: jest.Mock };
    remoteCommand: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };
  let sessionLifecycle: { findNonTerminalSessionForConnector: jest.Mock };
  let connectionRegistry: { get: jest.Mock; send: jest.Mock };
  let currentCommandState: RemoteCommandState;

  beforeEach(async () => {
    currentCommandState = RemoteCommandState.REQUESTED;

    prisma = {
      chargingStation: { findFirst: jest.fn().mockResolvedValue(station()) },
      connector: {
        findFirst: jest.fn().mockResolvedValue(connector()),
        findUnique: jest.fn().mockResolvedValue(connector()),
      },
      chargingSession: { findFirst: jest.fn().mockResolvedValue(session()) },
      authorizationCredential: {
        findFirst: jest.fn().mockResolvedValue(credential()),
      },
      remoteCommand: {
        findFirst: jest.fn().mockResolvedValue(null), // no conflicting command by default
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => {
          const row = remoteCommandRow(data);
          currentCommandState = row.state;
          return Promise.resolve(row);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          currentCommandState = data.state ?? currentCommandState;
          return Promise.resolve(
            remoteCommandRow({ ...data, state: currentCommandState }),
          );
        }),
        findUnique: jest.fn(),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    sessionLifecycle = {
      findNonTerminalSessionForConnector: jest.fn().mockResolvedValue(null),
    };
    connectionRegistry = {
      get: jest.fn().mockReturnValue({
        ocppIdentity: OCPP_IDENTITY,
        chargingStationId: STATION_ID,
        protocolVersion: 'OCPP1_6J',
      }),
      send: jest.fn().mockReturnValue(true),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RemoteCommandService,
        PendingCallRegistryService, // real — cheap, deterministic
        Ocpp16Adapter, // real — exercises the actual protocol seam
        Ocpp201Adapter,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: SessionLifecycleService, useValue: sessionLifecycle },
        { provide: ConnectionRegistryService, useValue: connectionRegistry },
      ],
    }).compile();

    service = moduleRef.get(RemoteCommandService);
  });

  /** requestCommand() awaits several already-resolved mocked-Prisma
   * promises (station/connector/credential lookups, the conflict check,
   * the create, the audit write) before it ever calls
   * connectionRegistry.send() — each real `await` is its own microtask
   * tick. Flushes exactly as many ticks as needed rather than a fixed
   * guess, so this doesn't become flaky if a lookup is added/removed. */
  async function waitUntilSent(): Promise<void> {
    for (
      let i = 0;
      i < 20 && connectionRegistry.send.mock.calls.length === 0;
      i += 1
    ) {
      await Promise.resolve();
    }
  }

  /** Resolves the pending CALL the service just sent, as if the Digital
   * Twin (or a real charger) responded. Reads the messageId the router
   * would have correlated on, straight off the frame `send()` was called
   * with. */
  async function respondWith(payload: Record<string, unknown>): Promise<void> {
    await waitUntilSent();
    const pendingCalls = (
      service as unknown as { pendingCalls: PendingCallRegistryService }
    ).pendingCalls;
    const [, frame] = connectionRegistry.send.mock.calls[0] as [
      string,
      { raw: [number, string, string, Record<string, unknown>] },
    ];
    const [, messageId] = frame.raw;
    pendingCalls.resolve(messageId, { kind: 'CALLRESULT', payload });
  }

  describe('RemoteStart — happy path', () => {
    it('reaches ACCEPTED when the charger responds Accepted, and never touches Connector/EVSE/session status', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });

      await respondWith({ status: 'Accepted' });

      const result = await promise;
      expect(result.state).toBe(RemoteCommandState.ACCEPTED);

      // The whole point of WO-056/058: this service must never write to
      // any domain entity's status. No such method exists on the mocked
      // Prisma client, so any attempt would throw — nothing did.
      expect(prisma.connector).not.toHaveProperty('update');
    });

    it('sends a real RemoteStartTransaction.req with the connector externalId and the credential idTag', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });
      await respondWith({ status: 'Accepted' });
      await promise;

      const [, frame] = connectionRegistry.send.mock.calls[0] as [
        string,
        { raw: [number, string, string, Record<string, unknown>] },
      ];
      expect(frame.raw[2]).toBe('RemoteStartTransaction');
      expect(frame.raw[3]).toEqual({ connectorId: 1, idTag: 'RFID-XYZ' });
    });
  });

  describe('protocol acceptance vs rejection — never inferred as physical outcome', () => {
    it('reaches REJECTED when the charger responds Rejected (protocol-level, not a throw)', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });
      await respondWith({ status: 'Rejected' });

      const result = await promise;
      expect(result.state).toBe(RemoteCommandState.REJECTED);
    });

    it('reaches REJECTED on a CALLERROR', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });
      await waitUntilSent();

      const pendingCalls = (
        service as unknown as { pendingCalls: PendingCallRegistryService }
      ).pendingCalls;
      const [, frame] = connectionRegistry.send.mock.calls[0] as [
        string,
        { raw: [number, string, string, Record<string, unknown>] },
      ];
      pendingCalls.resolve(frame.raw[1], {
        kind: 'CALLERROR',
        errorCode: 'InternalError',
        errorDescription: 'boom',
        details: {},
      });

      const result = await promise;
      expect(result.state).toBe(RemoteCommandState.REJECTED);
    });
  });

  describe('timeout', () => {
    it('reaches TIMED_OUT deterministically when no response arrives', async () => {
      jest.useFakeTimers();
      try {
        const promise = service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        });

        await jest.advanceTimersByTimeAsync(30_000);
        const result = await promise;
        expect(result.state).toBe(RemoteCommandState.TIMED_OUT);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('disconnect behavior (WO-058 decision)', () => {
    it('fails immediately (REJECTED) when the station is not connected, without ever attempting to send', async () => {
      connectionRegistry.get.mockReturnValue(undefined);

      const result = await service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });

      expect(result.state).toBe(RemoteCommandState.REJECTED);
      expect(connectionRegistry.send).not.toHaveBeenCalled();
    });
  });

  describe('multi-tenant security (WO-058 Decision: verify ownership before resolving the connection)', () => {
    it('rejects a station outside the caller organization before ever creating a RemoteCommand or touching the connection registry', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null); // the org-scoped query found nothing

      await expect(
        service.requestCommand({
          organizationId: OTHER_ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
      expect(connectionRegistry.get).not.toHaveBeenCalled();
    });

    it('rejects a connector outside the caller organization the same way', async () => {
      prisma.connector.findFirst.mockResolvedValue(null);

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
    });
  });

  describe('concurrency guard (scope item 8)', () => {
    it('rejects a new command deterministically when one is already in flight for the same target', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(
        remoteCommandRow({ state: RemoteCommandState.SENT }),
      );

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
      expect(connectionRegistry.send).not.toHaveBeenCalled();
    });
  });

  describe('input validation', () => {
    it('rejects RemoteStart with no connectorId', async () => {
      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects RemoteStart with no authorizationCredentialId — WO-058: no synthetic credential', async () => {
      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects RemoteStop with no chargingSessionId', async () => {
      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          commandType: RemoteCommandType.REMOTE_STOP,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an inactive authorization credential', async () => {
      prisma.authorizationCredential.findFirst.mockResolvedValue(
        credential({ status: 'REVOKED' }),
      );

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // WO-ARGOS-064 §5 — RemoteStart-specific backend preconditions.
    it('rejects RemoteStart when the connector is not AVAILABLE', async () => {
      prisma.connector.findFirst.mockResolvedValue(
        connector({ status: 'CHARGING' }),
      );

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
    });

    it('rejects RemoteStart when a non-terminal ChargingSession already occupies the connector', async () => {
      sessionLifecycle.findNonTerminalSessionForConnector.mockResolvedValue({
        id: 'existing-session',
        status: 'OFFLINE',
      });

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
    });

    it('rejects an expired authorization credential', async () => {
      prisma.authorizationCredential.findFirst.mockResolvedValue(
        credential({ expiresAt: new Date(Date.now() - 60_000) } as never),
      );

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a credential identifier that exceeds the OCPP 1.6J idTag length limit', async () => {
      prisma.authorizationCredential.findFirst.mockResolvedValue(
        credential({ externalIdentifier: 'X'.repeat(21) }),
      );

      await expect(
        service.requestCommand({
          organizationId: ORG,
          actorUserId: ACTOR,
          chargingStationId: STATION_ID,
          connectorId: CONNECTOR_ID,
          authorizationCredentialId: CREDENTIAL_ID,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('RemoteStop', () => {
    it('builds RemoteStopTransaction.req from the session protocolTransactionId', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        chargingSessionId: SESSION_ID,
        commandType: RemoteCommandType.REMOTE_STOP,
      });
      await respondWith({ status: 'Accepted' });
      await promise;

      const [, frame] = connectionRegistry.send.mock.calls[0] as [
        string,
        { raw: [number, string, string, Record<string, unknown>] },
      ];
      expect(frame.raw[2]).toBe('RemoteStopTransaction');
      expect(frame.raw[3]).toEqual({ transactionId: 55526 });
    });

    // WO-ARGOS-064 §11 — a RemoteStop must never be sent for a session
    // that's already terminal (or not yet real).
    it.each(['COMPLETED', 'FAILED', 'CANCELLED'])(
      'rejects RemoteStop for a %s (already-terminal) session',
      async (status) => {
        prisma.chargingSession.findFirst.mockResolvedValue(session({ status }));

        await expect(
          service.requestCommand({
            organizationId: ORG,
            actorUserId: ACTOR,
            chargingStationId: STATION_ID,
            chargingSessionId: SESSION_ID,
            commandType: RemoteCommandType.REMOTE_STOP,
          }),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.remoteCommand.create).not.toHaveBeenCalled();
      },
    );

    it('accepts RemoteStop for an OFFLINE session (logically active, per WO-063)', async () => {
      prisma.chargingSession.findFirst.mockResolvedValue(
        session({ status: 'OFFLINE' }),
      );
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        chargingSessionId: SESSION_ID,
        commandType: RemoteCommandType.REMOTE_STOP,
      });
      await respondWith({ status: 'Accepted' });
      const result = await promise;
      expect(result.state).toBe(RemoteCommandState.ACCEPTED);
    });
  });

  describe('capability gap (Reset/UnlockConnector/ChangeAvailability not yet implemented)', () => {
    it('rejects RESET the same way an offline station would — never a 500', async () => {
      const result = await service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        commandType: RemoteCommandType.RESET,
      });
      expect(result.state).toBe(RemoteCommandState.REJECTED);
    });
  });

  describe('audit trail', () => {
    it('records an AuditEvent for REQUESTED, SENT, and the terminal resolution, preserving actorUserId/organizationId', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });
      await respondWith({ status: 'Accepted' });
      await promise;

      const actions = audit.record.mock.calls.map(([input]) => input.action);
      expect(actions).toEqual([
        'REMOTE_COMMAND_REQUESTED',
        'REMOTE_COMMAND_SENT',
        'REMOTE_COMMAND_ACCEPTED',
      ]);
      for (const [input] of audit.record.mock.calls) {
        expect(input.organizationId).toBe(ORG);
        expect(input.actorUserId).toBe(ACTOR);
        expect(input.subjectType).toBe('RemoteCommand');
      }
    });
  });

  describe('acceptedAt (WO-ARGOS-064 confirmation-window clock)', () => {
    it('is set when the command reaches ACCEPTED', async () => {
      const promise = service.requestCommand({
        organizationId: ORG,
        actorUserId: ACTOR,
        chargingStationId: STATION_ID,
        connectorId: CONNECTOR_ID,
        authorizationCredentialId: CREDENTIAL_ID,
        commandType: RemoteCommandType.REMOTE_START,
      });
      await respondWith({ status: 'Accepted' });
      const result = await promise;

      expect(prisma.remoteCommand.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ acceptedAt: expect.any(Date) }),
        }),
      );
      expect(result.state).toBe(RemoteCommandState.ACCEPTED);
    });
  });

  describe('connector-only / session-only targeting (WO-ARGOS-064 API surface)', () => {
    it('requestRemoteStart resolves chargingStationId from the connector and delegates to requestCommand', async () => {
      prisma.connector.findFirst.mockResolvedValue({
        ...connector(),
        evse: { chargingStationId: STATION_ID },
      });

      const promise = service.requestRemoteStart(
        ORG,
        ACTOR,
        CONNECTOR_ID,
        CREDENTIAL_ID,
      );
      await respondWith({ status: 'Accepted' });
      const result = await promise;

      expect(result.chargingStationId).toBe(STATION_ID);
      expect(result.connectorId).toBe(CONNECTOR_ID);
    });

    it('requestRemoteStart throws NotFoundException for a connector outside the caller organization', async () => {
      prisma.connector.findFirst.mockResolvedValue(null);
      await expect(
        service.requestRemoteStart(
          OTHER_ORG,
          ACTOR,
          CONNECTOR_ID,
          CREDENTIAL_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('requestRemoteStop resolves chargingStationId from the session and delegates to requestCommand', async () => {
      const promise = service.requestRemoteStop(ORG, ACTOR, SESSION_ID);
      await respondWith({ status: 'Accepted' });
      const result = await promise;

      expect(result.chargingStationId).toBe(STATION_ID);
      // The RemoteCommand row's persisted chargingSessionId — asserted on
      // the create() call's data, since this spec's update() mock (used by
      // finalize() to reach ACCEPTED) only echoes back the fields that
      // specific update touched, not the full row create() originally
      // wrote — a test-double limitation, not production behavior.
      expect(prisma.remoteCommand.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ chargingSessionId: SESSION_ID }),
        }),
      );
    });

    it('requestRemoteStop throws NotFoundException for a session outside the caller organization', async () => {
      prisma.chargingSession.findFirst.mockResolvedValue(null);
      await expect(
        service.requestRemoteStop(OTHER_ORG, ACTOR, SESSION_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('command history reads (WO-ARGOS-064 §15)', () => {
    it('listCommandsForConnector verifies ownership before reading', async () => {
      prisma.remoteCommand.findMany.mockResolvedValue([remoteCommandRow()]);

      const result = await service.listCommandsForConnector(ORG, CONNECTOR_ID);
      expect(result).toHaveLength(1);
    });

    it('listCommandsForConnector throws NotFoundException for a foreign connector, never reading RemoteCommand rows', async () => {
      prisma.connector.findFirst.mockResolvedValue(null);

      await expect(
        service.listCommandsForConnector(OTHER_ORG, CONNECTOR_ID),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.remoteCommand.findMany).not.toHaveBeenCalled();
    });

    it('listCommandsForSession verifies ownership before reading', async () => {
      prisma.remoteCommand.findMany.mockResolvedValue([remoteCommandRow()]);

      const result = await service.listCommandsForSession(ORG, SESSION_ID);
      expect(result).toHaveLength(1);
    });

    it('getCommandById scopes by organizationId', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(
        remoteCommandRow({ id: 'cmd-42' }),
      );

      const result = await service.getCommandById(ORG, 'cmd-42');
      expect(result.id).toBe('cmd-42');
    });

    it('getCommandById throws NotFoundException for a foreign command id', async () => {
      prisma.remoteCommand.findFirst.mockResolvedValue(null);

      await expect(service.getCommandById(OTHER_ORG, 'cmd-42')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generic confirm/unconfirm (reserved for future domain wiring, WO-058 state model)', () => {
    it('confirmCommand transitions ACCEPTED -> CONFIRMED', async () => {
      prisma.remoteCommand.findUnique.mockResolvedValue(
        remoteCommandRow({ state: RemoteCommandState.ACCEPTED }),
      );
      const result = await service.confirmCommand('cmd-1');
      expect(result.state).toBe(RemoteCommandState.CONFIRMED);
    });

    it('markUnconfirmed transitions ACCEPTED -> UNCONFIRMED with a reason', async () => {
      prisma.remoteCommand.findUnique.mockResolvedValue(
        remoteCommandRow({ state: RemoteCommandState.ACCEPTED }),
      );
      const result = await service.markUnconfirmed(
        'cmd-1',
        'No se observó StartTransaction dentro de la ventana esperada.',
      );
      expect(result.state).toBe(RemoteCommandState.UNCONFIRMED);
    });

    it('confirmCommand on an already-terminal command throws rather than silently overwriting state', async () => {
      prisma.remoteCommand.findUnique.mockResolvedValue(
        remoteCommandRow({ state: RemoteCommandState.REJECTED }),
      );
      await expect(service.confirmCommand('cmd-1')).rejects.toThrow(
        'Cannot transition a RemoteCommand from REJECTED to CONFIRMED',
      );
    });
  });
});
