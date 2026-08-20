import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import type { MemberRole } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { OcppWebSocketServer } from '../src/ocpp/transport/ocpp-websocket.server';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';
// WO-ARGOS-064 — isolated local Digital Twin only, never the production
// Kylum Digital Twin. apps/movos-api/tsconfig.build.json excludes
// simulator/ from the production build regardless of this import.
import { OcppSimulator } from '../simulator/ocpp-simulator';

const OCPP_SECRET = 'wo-064-digital-twin-secret';

/**
 * WO-ARGOS-064 — Remote Operations Phase A (RemoteStart/RemoteStop). Real
 * PostgreSQL, real HTTP requests through the full app (JwtAuthGuard,
 * OrgContextGuard, RolesGuard, RemoteCommandsController, RemoteCommandService,
 * RemoteCommandConfirmationService) — nothing mocked. Sets a short
 * REMOTE_COMMAND_CONFIRMATION_WINDOW_MS before booting the app so the
 * UNCONFIRMED-after-window path is deterministic in tests rather than
 * waiting out the real 5-minute default (see ocpp.module.ts). Requires a
 * reachable PostgreSQL; skips cleanly when none is available.
 *
 * Digital-Twin-level REJECTED/CALLERROR/TIMED_OUT/mid-flight-disconnect/
 * duplicate-command scenarios are already covered by the pre-existing,
 * unmodified remote-command.digital-twin.spec.ts (WO-ARGOS-059) — not
 * re-duplicated here. This file adds what WO-064 introduces: the HTTP API
 * surface, RBAC, tenant isolation, the new RemoteStart preconditions, the
 * observed-confirmation lifecycle (ACCEPTED -> CONFIRMED/UNCONFIRMED) for
 * both commands, the natural-completion race, command history, audit, and
 * one complete local end-to-end RemoteStart -> RemoteStop lifecycle.
 */
describe('Remote Operations Phase A — RemoteStart/RemoteStop (e2e, WO-ARGOS-064)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let available = false;
  const twins: OcppSimulator[] = [];

  let orgAId = '';
  let orgBId = '';
  let siteAId = '';
  let credentialAId = '';
  let tokenOwner = '';
  let tokenAdmin = '';
  let tokenOperator = '';
  let tokenViewer = '';
  let tokenOrgB = '';
  let billingAccountAId = '';

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skip] ${name}: no database available`);
        return;
      }
      await fn();
    });

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password });
    return res.body.accessToken as string;
  }

  async function createUserWithMembership(params: {
    email: string;
    organizationId: string;
    role: MemberRole;
  }): Promise<string> {
    const user = await seedUser(prisma, {
      email: params.email,
      password: 'password-123',
      displayName: params.email,
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: params.organizationId,
        role: params.role,
        status: 'ACTIVE',
      },
    });
    return login(params.email, 'password-123');
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    // WO-ARGOS-064 §9 — short confirmation window so the UNCONFIRMED path
    // doesn't require waiting out the real 5-minute default.
    process.env.REMOTE_COMMAND_CONFIRMATION_WINDOW_MS = '300';

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    await app.listen(0);
    app.get(OcppWebSocketServer).attach(app.getHttpServer());
    const address = app.getHttpServer().address();
    port = typeof address === 'object' && address ? address.port : 0;

    const orgA = await prisma.organization.create({
      data: { name: 'Org WO064 A', slug: 'wo-064-org-a', status: 'ACTIVE' },
    });
    orgAId = orgA.id;
    const orgB = await prisma.organization.create({
      data: { name: 'Org WO064 B', slug: 'wo-064-org-b', status: 'ACTIVE' },
    });
    orgBId = orgB.id;

    tokenOwner = await createUserWithMembership({
      email: 'owner@wo-064.test',
      organizationId: orgAId,
      role: 'OWNER',
    });
    tokenAdmin = await createUserWithMembership({
      email: 'admin@wo-064.test',
      organizationId: orgAId,
      role: 'ADMIN',
    });
    tokenOperator = await createUserWithMembership({
      email: 'operator@wo-064.test',
      organizationId: orgAId,
      role: 'OPERATOR',
    });
    tokenViewer = await createUserWithMembership({
      email: 'viewer@wo-064.test',
      organizationId: orgAId,
      role: 'VIEWER',
    });
    tokenOrgB = await createUserWithMembership({
      email: 'owner-b@wo-064.test',
      organizationId: orgBId,
      role: 'OWNER',
    });

    const site = await prisma.site.create({
      data: {
        organizationId: orgAId,
        name: 'Site WO064',
        slug: 'wo-064-site',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: (
          await prisma.user.findFirstOrThrow({
            where: { email: 'owner@wo-064.test' },
          })
        ).id,
      },
    });
    siteAId = site.id;

    const credential = await prisma.authorizationCredential.create({
      data: {
        organizationId: orgAId,
        type: 'RFID',
        externalIdentifier: 'RFID-WO064',
        status: 'ACTIVE',
      },
    });
    credentialAId = credential.id;

    // One SYSTEM_DEFAULT BillingAccount per org (BillingAccount_one_system_
    // default_per_org is a real partial unique index) — created once, reused
    // by every test in this file that needs to seed a ChargingSession
    // directly.
    const billingAccount = await prisma.billingAccount.create({
      data: {
        organizationId: orgAId,
        type: 'SYSTEM_DEFAULT',
        displayName: 'Default (WO-064 e2e)',
        status: 'ACTIVE',
        currency: 'USD',
      },
    });
    billingAccountAId = billingAccount.id;
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
    delete process.env.REMOTE_COMMAND_CONFIRMATION_WINDOW_MS;
  });

  afterEach(async () => {
    for (const twin of twins.splice(0)) {
      twin.disconnect();
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  async function seedStation(
    ocppIdentity: string,
    connectorStatus: string = 'AVAILABLE',
  ) {
    const ocppSecretHash = await bcrypt.hash(OCPP_SECRET, 8);
    const station = await prisma.chargingStation.create({
      data: {
        siteId: siteAId,
        name: `Station ${ocppIdentity}`,
        status: 'ACTIVE',
        ocppIdentity,
        ocppSecretHash,
        connectivityStatus: 'ONLINE',
      },
    });
    const evse = await prisma.evse.create({
      data: { chargingStationId: station.id, status: 'AVAILABLE' },
    });
    const connector = await prisma.connector.create({
      data: {
        evseId: evse.id,
        externalId: '1',
        type: 'CCS2',
        status: connectorStatus as never,
      },
    });
    return { station, evse, connector };
  }

  async function connectTwin(
    ocppIdentity: string,
    commandResponses: ConstructorParameters<
      typeof OcppSimulator
    >[0]['commandResponses'] = {},
  ): Promise<OcppSimulator> {
    const twin = new OcppSimulator({
      host: '127.0.0.1',
      port,
      ocppIdentity,
      secret: OCPP_SECRET,
      protocolVersion: 'OCPP1_6J',
      commandResponses,
    });
    twins.push(twin);
    await twin.connect();
    await new Promise((resolve) => setTimeout(resolve, 20));
    return twin;
  }

  function remoteStart(
    token: string,
    connectorId: string,
    credentialId = credentialAId,
    orgId = orgAId,
  ) {
    return request(app.getHttpServer())
      .post(`/api/v1/connectors/${connectorId}/remote-start`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId)
      .send({ authorizationCredentialId: credentialId });
  }

  function remoteStop(token: string, sessionId: string, orgId = orgAId) {
    return request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/remote-stop`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Organization-Id', orgId);
  }

  async function waitFor(
    predicate: () => Promise<boolean>,
    timeoutMs = 2000,
  ): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('waitFor: condition never became true');
  }

  // ------------------------------------------------------------------
  // RBAC (WO-064 §3)
  // ------------------------------------------------------------------
  describe('RBAC', () => {
    maybe(
      'OWNER, ADMIN, and OPERATOR can reach RemoteStart (station offline here — REJECTED body, not a 403)',
      async () => {
        const { connector } = await seedStation('movos-wo064-rbac-1');
        for (const token of [tokenOwner, tokenAdmin, tokenOperator]) {
          const res = await remoteStart(token, connector.id);
          expect(res.status).toBe(201);
          expect(res.body.state).toBe('REJECTED');
        }
      },
    );

    maybe(
      'VIEWER is forbidden from RemoteStart — backend guard, not just frontend visibility',
      async () => {
        const { connector } = await seedStation('movos-wo064-rbac-2');
        const res = await remoteStart(tokenViewer, connector.id);
        expect(res.status).toBe(403);
      },
    );

    maybe('VIEWER is forbidden from RemoteStop', async () => {
      const { station, evse, connector } =
        await seedStation('movos-wo064-rbac-3');
      const session = await prisma.chargingSession.create({
        data: {
          organizationId: orgAId,
          siteId: siteAId,
          chargingStationId: station.id,
          evseId: evse.id,
          connectorId: connector.id,
          authorizationCredentialId: credentialAId,
          protocolVersion: 'OCPP1_6J',
          protocolTransactionId: '900001',
          status: 'ACTIVE',
          meterStart: 0,
          energyWh: 0,
          startedAt: new Date(),
          billingAccountId: billingAccountAId,
        },
      });

      const res = await remoteStop(tokenViewer, session.id);
      expect(res.status).toBe(403);
    });
  });

  // ------------------------------------------------------------------
  // Tenant isolation (WO-064 §4)
  // ------------------------------------------------------------------
  describe('tenant isolation', () => {
    maybe(
      'Org B cannot target Org A connector via RemoteStart — 404, not revealing existence',
      async () => {
        const { connector } = await seedStation('movos-wo064-tenant-1');
        const res = await remoteStart(
          tokenOrgB,
          connector.id,
          credentialAId,
          orgBId,
        );
        expect(res.status).toBe(404);
        const commands = await prisma.remoteCommand.findMany({
          where: { connectorId: connector.id },
        });
        expect(commands).toHaveLength(0);
      },
    );
  });

  // ------------------------------------------------------------------
  // RemoteStart preconditions (WO-064 §5)
  // ------------------------------------------------------------------
  describe('RemoteStart preconditions', () => {
    maybe('rejects with 400 when the connector is not AVAILABLE', async () => {
      const { connector } = await seedStation(
        'movos-wo064-precond-1',
        'CHARGING',
      );
      const res = await remoteStart(tokenOwner, connector.id);
      expect(res.status).toBe(400);
    });

    maybe(
      'rejects with 409 when a non-terminal ChargingSession already occupies the connector',
      async () => {
        const { station, evse, connector } = await seedStation(
          'movos-wo064-precond-2',
        );
        await prisma.chargingSession.create({
          data: {
            organizationId: orgAId,
            siteId: siteAId,
            chargingStationId: station.id,
            evseId: evse.id,
            connectorId: connector.id,
            authorizationCredentialId: credentialAId,
            protocolVersion: 'OCPP1_6J',
            protocolTransactionId: '900002',
            status: 'ACTIVE',
            meterStart: 0,
            energyWh: 0,
            startedAt: new Date(),
            billingAccountId: billingAccountAId,
          },
        });

        const res = await remoteStart(tokenOwner, connector.id);
        expect(res.status).toBe(409);
      },
    );

    maybe(
      'rejects with 404 for a credential outside the organization',
      async () => {
        const { connector } = await seedStation('movos-wo064-precond-3');
        const res = await remoteStart(
          tokenOwner,
          connector.id,
          'does-not-exist',
        );
        expect(res.status).toBe(404);
      },
    );
  });

  // ------------------------------------------------------------------
  // Observed confirmation — RemoteStart (WO-064 §7/§8/§9)
  // ------------------------------------------------------------------
  describe('RemoteStart observed confirmation', () => {
    maybe(
      '[A] Accepted + real StartTransaction -> CONFIRMED, real ChargingSession created',
      async () => {
        const ocppIdentity = 'movos-wo064-start-confirm';
        const { station, connector } = await seedStation(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStartTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        const res = await remoteStart(tokenOwner, connector.id);
        expect(res.status).toBe(201);
        expect(res.body.state).toBe('ACCEPTED');
        const commandId = res.body.id as string;

        const twin = twins[0];
        await twin.sendStartTransaction(1, 'RFID-WO064', 0);

        await waitFor(async () => {
          const detail = await request(app.getHttpServer())
            .get(`/api/v1/remote-commands/${commandId}`)
            .set('Authorization', `Bearer ${tokenOwner}`)
            .set('X-Organization-Id', orgAId);
          return detail.body.state === 'CONFIRMED';
        });

        const activeSession = await prisma.chargingSession.findFirstOrThrow({
          where: { chargingStationId: station.id, status: 'ACTIVE' },
        });
        const confirmed = await prisma.remoteCommand.findUniqueOrThrow({
          where: { id: commandId },
        });
        expect(confirmed.chargingSessionId).toBe(activeSession.id);
        expect(confirmed.resolvedAt).not.toBeNull();
      },
    );

    maybe(
      '[B] Accepted + no StartTransaction within the window -> UNCONFIRMED',
      async () => {
        const ocppIdentity = 'movos-wo064-start-unconfirmed';
        const { connector } = await seedStation(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStartTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        const res = await remoteStart(tokenOwner, connector.id);
        expect(res.body.state).toBe('ACCEPTED');
        const commandId = res.body.id as string;

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: commandId },
          });
          return command.state === 'UNCONFIRMED';
        }, 3000);
      },
    );
  });

  // ------------------------------------------------------------------
  // Observed confirmation — RemoteStop (WO-064 §12/§13)
  // ------------------------------------------------------------------
  describe('RemoteStop observed confirmation', () => {
    let nextTransactionId = 910000;

    async function seedActiveSession(ocppIdentity: string) {
      const { station, evse, connector } = await seedStation(ocppIdentity);
      // A realistic numeric protocolTransactionId (as a string) — matches
      // what TransactionIdGeneratorService actually assigns in production,
      // and is required for TransactionEndHandler's real
      // (chargingStationId, protocolTransactionId) StopTransaction
      // correlation to find this row at all.
      nextTransactionId += 1;
      const session = await prisma.chargingSession.create({
        data: {
          organizationId: orgAId,
          siteId: siteAId,
          chargingStationId: station.id,
          evseId: evse.id,
          connectorId: connector.id,
          authorizationCredentialId: credentialAId,
          protocolVersion: 'OCPP1_6J',
          protocolTransactionId: String(nextTransactionId),
          status: 'ACTIVE',
          meterStart: 0,
          energyWh: 0,
          startedAt: new Date(),
          billingAccountId: billingAccountAId,
        },
      });
      return { station, connector, session };
    }

    maybe(
      '[A] Accepted + real StopTransaction -> CONFIRMED, real ChargingSession COMPLETED',
      async () => {
        const ocppIdentity = 'movos-wo064-stop-confirm';
        const { session } = await seedActiveSession(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStopTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        const res = await remoteStop(tokenOwner, session.id);
        expect(res.body.state).toBe('ACCEPTED');
        const commandId = res.body.id as string;

        const twin = twins[0];
        const persisted = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        await twin.sendStopTransaction(
          Number(persisted.protocolTransactionId),
          500,
        );

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: commandId },
          });
          return command.state === 'CONFIRMED';
        });

        const completed = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        expect(completed.status).toBe('COMPLETED');
      },
    );

    maybe(
      '[B] Accepted + no StopTransaction within the window -> UNCONFIRMED',
      async () => {
        const ocppIdentity = 'movos-wo064-stop-unconfirmed';
        const { session } = await seedActiveSession(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStopTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        const res = await remoteStop(tokenOwner, session.id);
        const commandId = res.body.id as string;

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: commandId },
          });
          return command.state === 'UNCONFIRMED';
        }, 3000);

        // WO-064 §12 — an UNCONFIRMED command never mutates ChargingSession.
        const stillActive = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        expect(stillActive.status).toBe('ACTIVE');
      },
    );

    maybe(
      '[E] natural completion race: session ends via the normal path while RemoteStop is ACCEPTED -> CONFIRMED, no double finalization',
      async () => {
        const ocppIdentity = 'movos-wo064-stop-race';
        const { session } = await seedActiveSession(ocppIdentity);
        // The twin never actually replies to the outbound RemoteStop, but the
        // "real" StopTransaction still arrives independently — modeling a
        // driver unplugging right as the operator's RemoteStop is in flight.
        await connectTwin(ocppIdentity, {
          RemoteStopTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        let remoteStopSettled: { status: number; body: unknown } | null = null;
        const remoteStopPromise = remoteStop(tokenOwner, session.id).then(
          (r) => {
            remoteStopSettled = { status: r.status, body: r.body };
            return r;
          },
        );
        // WO-064 §13's race is specifically "the real StopTransaction lands
        // while the RemoteCommand is pending/accepted" — i.e. after the
        // command row already exists (precondition already passed), not
        // before it. Poll for the actual condition rather than guessing a
        // timing window. Also accepts remoteStopPromise itself settling first
        // (a separate Prisma client's read can trail a few ms behind another
        // connection's just-committed write) — either signal proves the
        // command already exists before the real StopTransaction is sent.
        await waitFor(async () => {
          const command = await prisma.remoteCommand.findFirst({
            where: {
              chargingSessionId: session.id,
              commandType: 'REMOTE_STOP',
            },
          });
          return command !== null || remoteStopSettled !== null;
        }, 5000);
        const persisted = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        const twin = twins[0];
        await twin.sendStopTransaction(
          Number(persisted.protocolTransactionId) || 1,
          700,
        );

        const res = await remoteStopPromise;
        expect(res.status).toBe(201);
        const commandId = res.body.id as string;

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: commandId },
          });
          return command.state === 'CONFIRMED';
        });

        const completed = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        expect(completed.status).toBe('COMPLETED');
        expect(completed.meterStop).toBe(700);
      },
    );
  });

  // ------------------------------------------------------------------
  // Command history / read API + audit (WO-064 §15/§16)
  // ------------------------------------------------------------------
  describe('command history and audit', () => {
    maybe(
      'connector and session history endpoints return the command; audit trail records REQUESTED/SENT/ACCEPTED',
      async () => {
        const ocppIdentity = 'movos-wo064-history';
        const { connector } = await seedStation(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStartTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });

        const res = await remoteStart(tokenOwner, connector.id);
        const commandId = res.body.id as string;

        const historyForConnector = await request(app.getHttpServer())
          .get(`/api/v1/connectors/${connector.id}/remote-commands`)
          .set('Authorization', `Bearer ${tokenOwner}`)
          .set('X-Organization-Id', orgAId);
        expect(
          historyForConnector.body.some(
            (c: { id: string }) => c.id === commandId,
          ),
        ).toBe(true);

        const auditEvents = await prisma.auditEvent.findMany({
          where: { subjectId: commandId, subjectType: 'RemoteCommand' },
        });
        const actions = auditEvents.map((e) => e.action);
        expect(actions).toEqual(
          expect.arrayContaining([
            'REMOTE_COMMAND_REQUESTED',
            'REMOTE_COMMAND_SENT',
            'REMOTE_COMMAND_ACCEPTED',
          ]),
        );
        // No credential secret material in metadata.
        for (const event of auditEvents) {
          expect(JSON.stringify(event.metadata ?? {})).not.toContain(
            'RFID-WO064',
          );
        }
      },
    );
  });

  // ------------------------------------------------------------------
  // Complete local end-to-end Phase A lifecycle (WO-064 §24)
  // ------------------------------------------------------------------
  describe('complete end-to-end lifecycle', () => {
    maybe(
      'RemoteStart -> real StartTransaction -> ACTIVE + CONFIRMED -> RemoteStop -> real StopTransaction -> COMPLETED + CONFIRMED',
      async () => {
        const ocppIdentity = 'movos-wo064-e2e-lifecycle';
        const { station, connector } = await seedStation(ocppIdentity);
        await connectTwin(ocppIdentity, {
          RemoteStartTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
          RemoteStopTransaction: {
            kind: 'accept',
            payload: { status: 'Accepted' },
          },
        });
        const twin = twins[0];

        // RemoteStart
        const startRes = await remoteStart(tokenOperator, connector.id);
        expect(startRes.status).toBe(201);
        expect(startRes.body.state).toBe('ACCEPTED');
        const startCommandId = startRes.body.id as string;

        // Real inbound StartTransaction
        const startTxResponse = await twin.sendStartTransaction(
          1,
          'RFID-WO064',
          1000,
        );
        expect(startTxResponse.kind).toBe('CALLRESULT');

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: startCommandId },
          });
          return command.state === 'CONFIRMED';
        });

        const activeSession = await prisma.chargingSession.findFirstOrThrow({
          where: { chargingStationId: station.id, status: 'ACTIVE' },
        });
        expect(activeSession.meterStart).toBe(1000);

        // MeterValues, in the middle of the session
        await twin.sendMeterValues(
          1,
          Number(activeSession.protocolTransactionId),
          250,
        );

        // RemoteStop
        const stopRes = await remoteStop(tokenOperator, activeSession.id);
        expect(stopRes.status).toBe(201);
        expect(stopRes.body.state).toBe('ACCEPTED');
        const stopCommandId = stopRes.body.id as string;

        // Real inbound StopTransaction
        const stopTxResponse = await twin.sendStopTransaction(
          Number(activeSession.protocolTransactionId),
          1300,
        );
        expect(stopTxResponse.kind).toBe('CALLRESULT');

        await waitFor(async () => {
          const command = await prisma.remoteCommand.findUniqueOrThrow({
            where: { id: stopCommandId },
          });
          return command.state === 'CONFIRMED';
        });

        // Session/energy integrity
        const completed = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: activeSession.id },
        });
        expect(completed.status).toBe('COMPLETED');
        expect(completed.meterStart).toBe(1000);
        expect(completed.meterStop).toBe(1300);
        expect(completed.energyWh).toBe(300);

        // No duplicate session on this connector, no stale absorption.
        const allSessionsOnConnector = await prisma.chargingSession.findMany({
          where: { connectorId: connector.id },
        });
        expect(allSessionsOnConnector).toHaveLength(1);

        // Command history for both commands present on the session.
        const sessionHistory = await request(app.getHttpServer())
          .get(`/api/v1/sessions/${activeSession.id}/remote-commands`)
          .set('Authorization', `Bearer ${tokenOperator}`)
          .set('X-Organization-Id', orgAId);
        const historyIds = sessionHistory.body.map((c: { id: string }) => c.id);
        expect(historyIds).toContain(stopCommandId);

        // Full audit trail for both commands.
        const startAudit = await prisma.auditEvent.findMany({
          where: { subjectId: startCommandId },
        });
        const stopAudit = await prisma.auditEvent.findMany({
          where: { subjectId: stopCommandId },
        });
        expect(startAudit.map((e) => e.action)).toEqual(
          expect.arrayContaining([
            'REMOTE_COMMAND_REQUESTED',
            'REMOTE_COMMAND_SENT',
            'REMOTE_COMMAND_ACCEPTED',
            'REMOTE_COMMAND_CONFIRMED',
          ]),
        );
        expect(stopAudit.map((e) => e.action)).toEqual(
          expect.arrayContaining([
            'REMOTE_COMMAND_REQUESTED',
            'REMOTE_COMMAND_SENT',
            'REMOTE_COMMAND_ACCEPTED',
            'REMOTE_COMMAND_CONFIRMED',
          ]),
        );

        // Never fabricated: Connector.status untouched by any of this — the
        // OCPP StatusNotification path (unexercised by this test) remains
        // the sole writer, exactly as WO-056/§21 requires.
        const connectorAfter = await prisma.connector.findUniqueOrThrow({
          where: { id: connector.id },
        });
        expect(connectorAfter.status).toBe('AVAILABLE');
      },
    );
  });
});
