import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RemoteCommandState, RemoteCommandType } from '@prisma/client';

import { OcppWebSocketServer } from '../transport/ocpp-websocket.server';
import { OcppAuthenticationService } from '../authentication/ocpp-authentication.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { ConnectivityCoordinator } from '../connectivity/connectivity-coordinator.service';
import { OcppMessageRouterService } from '../routing/ocpp-message-router.service';
import { PendingCallRegistryService } from '../outbound/pending-call-registry.service';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from '../protocol/ocpp201/ocpp201-adapter';
import { BootNotificationHandler } from '../handlers/boot-notification.handler';
import { HeartbeatHandler } from '../handlers/heartbeat.handler';
import { StatusNotificationHandler } from '../handlers/status-notification.handler';
import { AuthorizationHandler } from '../handlers/authorization.handler';
import { TransactionStartHandler } from '../handlers/transaction-start.handler';
import { TransactionUpdateHandler } from '../handlers/transaction-update.handler';
import { TransactionEndHandler } from '../handlers/transaction-end.handler';
import { OcppProtocolEventService } from '../persistence/ocpp-protocol-event.service';
import {
  REMOTE_COMMAND_RESPONSE_TIMEOUT_MS,
  RemoteCommandService,
} from './remote-command.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
// WO-ARGOS-059 — the real Digital Twin client, imported by this one
// integration spec (mirrors OCPP_SIMULATOR_GUIDE.md's "programmatic usage"
// pattern). apps/movos-api/tsconfig.build.json excludes simulator/ from the
// production build regardless of this import.
import { OcppSimulator } from '../../../simulator/ocpp-simulator';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const STATION_ID = 'station-1';
const OCPP_IDENTITY = 'movos-digitaltwin-059';
const CONNECTOR_ID = 'connector-1';
const CREDENTIAL_ID = 'credential-1';
const ACTOR = 'user-1';
// Real production default is 30s (see remote-command.service.ts) — this
// spec injects a short override so timeout/disconnect scenarios don't make
// the suite slow. See TEST_RESPONSE_TIMEOUT_MS below and its
// REMOTE_COMMAND_RESPONSE_TIMEOUT_MS injection.
const TEST_RESPONSE_TIMEOUT_MS = 300;

const station = { id: STATION_ID, ocppIdentity: OCPP_IDENTITY };
const connector = { id: CONNECTOR_ID, externalId: '1' };
const credential = {
  id: CREDENTIAL_ID,
  externalIdentifier: 'RFID-XYZ',
  status: 'ACTIVE',
};

/**
 * WO-ARGOS-059 scope item 10, "Foundation validation" — the complete
 * generic transport lifecycle against the real Digital Twin (simulator),
 * over a real WebSocket, not mocked transport:
 *
 *   MOVOS creates command -> outbound OCPP CALL -> Digital Twin receives
 *   CALL -> Digital Twin sends CALLRESULT/CALLERROR -> MOVOS correlates
 *   response -> RemoteCommand reaches expected protocol state -> AuditEvent
 *   exists.
 *
 * Only Prisma (ownership/lookup rows) and AuditService are mocked — every
 * other component (OcppWebSocketServer, OcppMessageRouterService,
 * PendingCallRegistryService, ConnectionRegistryService, both protocol
 * adapters, RemoteCommandService) is real, wired exactly as ocpp.module.ts
 * wires it, mirroring ocpp-websocket.server.spec.ts's own "real HTTP + real
 * WebSocket, mocked auth/router"-style precedent (here: mocked
 * auth/persistence, real everything else). Nothing here touches the real
 * production Digital Twin or any real infrastructure — this is a
 * throwaway local server + a local simulator instance for this test file
 * only.
 */
describe('RemoteCommand — Digital Twin foundation validation (WO-ARGOS-059)', () => {
  let httpServer: HttpServer;
  let port: number;
  let service: RemoteCommandService;
  let connectionRegistry: ConnectionRegistryService;
  let prisma: {
    chargingStation: { findFirst: jest.Mock };
    connector: { findFirst: jest.Mock; findUnique: jest.Mock };
    chargingSession: { findFirst: jest.Mock };
    authorizationCredential: { findFirst: jest.Mock };
    remoteCommand: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let audit: { record: jest.Mock };
  const twins: OcppSimulator[] = [];

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
      requestedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    let currentState = RemoteCommandState.REQUESTED;
    prisma = {
      chargingStation: { findFirst: jest.fn().mockResolvedValue(station) },
      connector: {
        findFirst: jest.fn().mockResolvedValue(connector),
        findUnique: jest.fn().mockResolvedValue(connector),
      },
      chargingSession: { findFirst: jest.fn().mockResolvedValue(null) },
      authorizationCredential: {
        findFirst: jest.fn().mockResolvedValue(credential),
      },
      remoteCommand: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => {
          currentState = data.state;
          return Promise.resolve(remoteCommandRow(data));
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          currentState = data.state ?? currentState;
          return Promise.resolve(
            remoteCommandRow({ ...data, state: currentState }),
          );
        }),
      },
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppWebSocketServer,
        OcppMessageRouterService,
        ConnectionRegistryService,
        PendingCallRegistryService,
        RemoteCommandService,
        Ocpp16Adapter,
        Ocpp201Adapter,
        {
          provide: REMOTE_COMMAND_RESPONSE_TIMEOUT_MS,
          useValue: TEST_RESPONSE_TIMEOUT_MS,
        },
        {
          provide: OcppAuthenticationService,
          useValue: {
            authenticate: jest.fn().mockResolvedValue({ ok: true, station }),
          },
        },
        {
          provide: ConnectivityCoordinator,
          useValue: {
            handleConnectionEstablished: jest.fn().mockResolvedValue(undefined),
            handleConnectionClosed: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: OcppProtocolEventService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: BootNotificationHandler, useValue: { handle: jest.fn() } },
        { provide: HeartbeatHandler, useValue: { handle: jest.fn() } },
        { provide: StatusNotificationHandler, useValue: { handle: jest.fn() } },
        { provide: AuthorizationHandler, useValue: { handle: jest.fn() } },
        { provide: TransactionStartHandler, useValue: { handle: jest.fn() } },
        { provide: TransactionUpdateHandler, useValue: { handle: jest.fn() } },
        { provide: TransactionEndHandler, useValue: { handle: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    connectionRegistry = moduleRef.get(ConnectionRegistryService);
    service = moduleRef.get(RemoteCommandService);
    const transport = moduleRef.get(OcppWebSocketServer);

    httpServer = createServer();
    transport.attach(httpServer);
    await new Promise<void>((resolve) =>
      httpServer.listen(0, '127.0.0.1', resolve),
    );
    port = (httpServer.address() as AddressInfo).port;
  });

  afterEach(async () => {
    for (const twin of twins.splice(0)) {
      twin.disconnect();
    }
    connectionRegistry.onModuleDestroy();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  async function connectTwin(
    commandResponses: ConstructorParameters<
      typeof OcppSimulator
    >[0]['commandResponses'] = {},
  ): Promise<OcppSimulator> {
    const twin = new OcppSimulator({
      host: '127.0.0.1',
      port,
      ocppIdentity: OCPP_IDENTITY,
      secret: 'irrelevant-basic-auth-is-mocked',
      protocolVersion: 'OCPP1_6J',
      commandResponses,
    });
    twins.push(twin);
    await twin.connect();
    // Let ConnectionRegistryService finish registering before the test
    // proceeds — register() itself is synchronous, but this keeps the test
    // robust against that changing.
    await new Promise((resolve) => setTimeout(resolve, 20));
    return twin;
  }

  function requestRemoteStart() {
    return service.requestCommand({
      organizationId: ORG,
      actorUserId: ACTOR,
      chargingStationId: STATION_ID,
      connectorId: CONNECTOR_ID,
      authorizationCredentialId: CREDENTIAL_ID,
      commandType: RemoteCommandType.REMOTE_START,
    });
  }

  it('Accepted: full round trip over a real WebSocket reaches ACCEPTED and records AuditEvent', async () => {
    await connectTwin({
      RemoteStartTransaction: {
        kind: 'accept',
        payload: { status: 'Accepted' },
      },
    });

    const result = await requestRemoteStart();

    expect(result.state).toBe(RemoteCommandState.ACCEPTED);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'REMOTE_COMMAND_ACCEPTED' }),
    );
  });

  it('Rejected via CALLRESULT: the Digital Twin explicitly rejects the command', async () => {
    await connectTwin({
      RemoteStartTransaction: { kind: 'reject' },
    });

    const result = await requestRemoteStart();
    expect(result.state).toBe(RemoteCommandState.REJECTED);
  });

  it('Rejected via CALLERROR: the Digital Twin returns a protocol error instead of a normal response', async () => {
    await connectTwin({
      RemoteStartTransaction: {
        kind: 'error',
        errorCode: 'InternalError',
        errorDescription: 'simulated fault',
      },
    });

    const result = await requestRemoteStart();
    expect(result.state).toBe(RemoteCommandState.REJECTED);
    expect(result.rejectionReason).toContain('InternalError');
  });

  it('Timeout/no response: the Digital Twin receives the CALL but stays silent', async () => {
    await connectTwin({
      RemoteStartTransaction: { kind: 'silent' },
    });

    const result = await requestRemoteStart();
    expect(result.state).toBe(RemoteCommandState.TIMED_OUT);
  });

  it('station offline before send: no Digital Twin connected at all — fails immediately, no CALL ever sent', async () => {
    const result = await requestRemoteStart();
    expect(result.state).toBe(RemoteCommandState.REJECTED);
    expect(result.rejectionReason).toContain('no está en línea');
  });

  it('disconnect while pending: the Digital Twin disconnects after receiving the CALL but before responding', async () => {
    await connectTwin({
      RemoteStartTransaction: { kind: 'silent' }, // never responds on its own
    });

    const resultPromise = requestRemoteStart();
    await new Promise((resolve) => setTimeout(resolve, 50));
    twins[0].disconnect(); // mid-flight disconnect — must resolve honestly, not hang

    const result = await resultPromise;
    expect(result.state).toBe(RemoteCommandState.TIMED_OUT);
  });

  it('duplicate/concurrent command rejection: a second RemoteStart for the same connector is rejected deterministically while the first is in flight', async () => {
    await connectTwin({
      RemoteStartTransaction: { kind: 'silent' }, // keep the first in flight
    });

    const first = requestRemoteStart();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The concurrency guard's app-level check reads existing RemoteCommand
    // rows — simulate that the first command's SENT row is now "in the
    // database" for the conflict check to find.
    prisma.remoteCommand.findFirst.mockResolvedValueOnce(
      remoteCommandRow({ state: RemoteCommandState.SENT }),
    );

    await expect(requestRemoteStart()).rejects.toThrow(ConflictException);

    // Let the first command resolve (timeout) so the test doesn't leak an
    // open handle.
    await first;
  });

  it('cross-tenant rejection: a caller from a different organization cannot target this station', async () => {
    prisma.chargingStation.findFirst.mockResolvedValueOnce(null);

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
  });

  it('stale/unknown CALLRESULT: a spontaneous, unrelated CALLRESULT from the Digital Twin is handled safely and does not resolve the real pending command', async () => {
    const twin = await connectTwin({
      RemoteStartTransaction: { kind: 'silent' },
    });

    const resultPromise = requestRemoteStart();
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The twin spontaneously sends a CALLRESULT for a message id nobody
    // registered — the router must log it as unexpected (see
    // ocpp-message-router.service.spec.ts's own unit coverage of this
    // exact path) and, critically, must not accidentally resolve the real
    // in-flight command.
    (twin as unknown as { ws: { send: (data: string) => void } }).ws.send(
      JSON.stringify([3, 'not-a-real-pending-id', { status: 'Accepted' }]),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    twin.disconnect();
    const result = await resultPromise;
    // Resolved via the disconnect/timeout path, never via the spurious
    // CALLRESULT above (which would have produced ACCEPTED instead).
    expect(result.state).toBe(RemoteCommandState.TIMED_OUT);
  });
});
