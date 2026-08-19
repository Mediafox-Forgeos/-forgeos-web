import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../src/prisma/prisma.service';
import { ConnectivityCoordinator } from '../src/ocpp/connectivity/connectivity-coordinator.service';
import { SessionLifecycleService } from '../src/sessions/session-lifecycle.service';
import { TransactionEndHandler } from '../src/ocpp/handlers/transaction-end.handler';
import { OcppWebSocketServer } from '../src/ocpp/transport/ocpp-websocket.server';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';
// WO-ARGOS-063 Digital Twin scenario — isolated local simulator only, never
// the production Kylum Digital Twin. apps/movos-api/tsconfig.build.json
// excludes simulator/ from the production build regardless of this import.
import { OcppSimulator } from '../simulator/ocpp-simulator';

const OCPP_SECRET = 'wo-063-digital-twin-secret';

/**
 * WO-ARGOS-063 — permanent regression coverage for the OFFLINE-session /
 * new-StartTransaction collision WO-062 discovered and this WO fixes.
 * Real PostgreSQL, real DI container (SessionLifecycleService,
 * ConnectivityCoordinator, TransactionEndHandler) — nothing mocked. Requires
 * a reachable PostgreSQL; skips cleanly when none is available, same
 * convention as every other *.e2e-spec.ts in this directory.
 */
describe('OFFLINE session supersession (e2e, WO-ARGOS-063)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coordinator: ConnectivityCoordinator;
  let sessionLifecycle: SessionLifecycleService;
  let transactionEndHandler: TransactionEndHandler;
  let port: number;
  let available = false;

  let organizationId = '';
  let siteId = '';
  let credentialOldId = '';
  let credentialNewId = '';
  const twins: OcppSimulator[] = [];

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skip] ${name}: no database available`);
        return;
      }
      await fn();
    });

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    coordinator = app.get(ConnectivityCoordinator);
    sessionLifecycle = app.get(SessionLifecycleService);
    transactionEndHandler = app.get(TransactionEndHandler);
    await resetDatabase(prisma);

    await app.listen(0);
    app.get(OcppWebSocketServer).attach(app.getHttpServer());
    const address = app.getHttpServer().address();
    port = typeof address === 'object' && address ? address.port : 0;

    const org = await prisma.organization.create({
      data: { name: 'Org WO063', slug: 'wo-063-org', status: 'ACTIVE' },
    });
    organizationId = org.id;

    const user = await seedUser(prisma, {
      email: 'owner@wo-063.test',
      password: 'password-123',
      displayName: 'Owner',
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const site = await prisma.site.create({
      data: {
        organizationId,
        name: 'Site WO063',
        slug: 'wo-063-site',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: user.id,
      },
    });
    siteId = site.id;

    const credOld = await prisma.authorizationCredential.create({
      data: {
        organizationId,
        type: 'RFID',
        externalIdentifier: 'RFID-WO063-OLD-DRIVER',
        status: 'ACTIVE',
      },
    });
    credentialOldId = credOld.id;

    const credNew = await prisma.authorizationCredential.create({
      data: {
        organizationId,
        type: 'RFID',
        externalIdentifier: 'RFID-WO063-NEW-DRIVER',
        status: 'ACTIVE',
      },
    });
    credentialNewId = credNew.id;
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  afterEach(async () => {
    for (const twin of twins.splice(0)) {
      twin.disconnect();
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  async function seedStation(ocppIdentity: string) {
    const station = await prisma.chargingStation.create({
      data: {
        siteId,
        name: `Station ${ocppIdentity}`,
        status: 'ACTIVE',
        ocppIdentity,
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
        status: 'CHARGING',
      },
    });
    return { station, evse, connector };
  }

  async function createSessionFor(
    stationId: string,
    connectorId: string,
    evseId: string,
    credentialId: string,
    meterStart: number,
    startedAt = new Date(),
  ) {
    return sessionLifecycle.createSession({
      organizationId,
      siteId,
      chargingStationId: stationId,
      evseId,
      connectorId,
      authorizationCredentialId: credentialId,
      protocolVersion: 'OCPP1_6J',
      meterStart,
      startedAt,
    });
  }

  async function moveOfflineAndExpire(stationId: string, sessionId: string) {
    await coordinator.handleConnectionClosed({
      chargingStationId: stationId,
      ocppIdentity: `dummy-${stationId}`,
      reason: 'clean',
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "ChargingSession" SET "updatedAt" = NOW() - INTERVAL '2 hours' WHERE id = $1`,
      sessionId,
    );
  }

  // ------------------------------------------------------------------
  // 1. Mandatory billing/energy regression (WO-063 §6)
  // ------------------------------------------------------------------
  maybe(
    'mandatory scenario: expired OFFLINE session is superseded — old FAILED, new session correctly billed',
    async () => {
      const { station, evse, connector } = await seedStation(
        'movos-wo063-mandatory',
      );

      const oldSession = await createSessionFor(
        station.id,
        connector.id,
        evse.id,
        credentialOldId,
        1000,
        new Date('2026-08-01T08:00:00.000Z'),
      );
      expect(oldSession.status).toBe('ACTIVE');

      await moveOfflineAndExpire(station.id, oldSession.id);
      const offline = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: oldSession.id },
      });
      expect(offline.status).toBe('OFFLINE');

      const newSession = await createSessionFor(
        station.id,
        connector.id,
        evse.id,
        credentialNewId,
        5000,
      );

      // Exactly two ChargingSession rows on this connector.
      const allOnConnector = await prisma.chargingSession.findMany({
        where: { connectorId: connector.id },
      });
      expect(allOnConnector).toHaveLength(2);

      // Old session: FAILED, historical fields untouched.
      const oldAfter = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: oldSession.id },
      });
      expect(oldAfter.status).toBe('FAILED');
      expect(oldAfter.terminationReason).toBe('NETWORK_FAILURE');
      expect(oldAfter.meterStart).toBe(1000);
      expect(oldAfter.meterStop).toBeNull();
      expect(oldAfter.energyWh).toBe(0);
      expect(oldAfter.authorizationCredentialId).toBe(credentialOldId);
      expect(oldAfter.protocolTransactionId).toBe(
        oldSession.protocolTransactionId,
      );

      // New session: genuinely independent identity.
      expect(newSession.id).not.toBe(oldSession.id);
      expect(newSession.status).toBe('ACTIVE');
      expect(newSession.meterStart).toBe(5000);
      expect(newSession.authorizationCredentialId).toBe(credentialNewId);
      expect(newSession.protocolTransactionId).not.toBe(
        oldSession.protocolTransactionId,
      );

      // Complete the new session — energyWh must derive from the NEW
      // meterStart, not the abandoned one's.
      const completed = await sessionLifecycle.stopSession(newSession.id, {
        meterStop: 5300,
        reason: 'NORMAL_COMPLETION',
      });
      expect(completed.status).toBe('COMPLETED');
      expect(completed.meterStart).toBe(5000);
      expect(completed.meterStop).toBe(5300);
      expect(completed.energyWh).toBe(300);
      expect(completed.authorizationCredentialId).toBe(credentialNewId);

      // Audit trail: exactly one SESSION_ABANDONED_ON_NEW_TRANSACTION event
      // for the old session.
      const auditEvents = await prisma.auditEvent.findMany({
        where: {
          subjectId: oldSession.id,
          action: 'SESSION_ABANDONED_ON_NEW_TRANSACTION',
        },
      });
      expect(auditEvents).toHaveLength(1);
      const metadata = auditEvents[0].metadata as Record<string, unknown>;
      expect(metadata.chargingStationId).toBe(station.id);
      expect(metadata.connectorId).toBe(connector.id);
      expect(metadata.protocolTransactionId).toBe(
        oldSession.protocolTransactionId,
      );
      expect(metadata.reason).toBe(
        'expired-offline-superseded-by-new-transaction',
      );
    },
  );

  // ------------------------------------------------------------------
  // 2. StopTransaction A/B/C (WO-063 §5) — real TransactionEndHandler
  // ------------------------------------------------------------------
  describe('StopTransaction sequences', () => {
    maybe(
      '[A] old transaction -> OFFLINE -> reconnect/recovery -> old StopTransaction resolves and completes correctly',
      async () => {
        const { station, evse, connector } =
          await seedStation('movos-wo063-stopA');
        const session = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );

        await coordinator.handleConnectionClosed({
          chargingStationId: station.id,
          ocppIdentity: 'dummy',
          reason: 'clean',
        });
        // Still inside the recovery window — no backdating.
        await coordinator.handleConnectionEstablished({
          chargingStationId: station.id,
          ocppIdentity: 'dummy',
          protocolVersion: 'OCPP1_6J',
        });
        const recovered = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        expect(recovered.status).toBe('ACTIVE');

        const result = await transactionEndHandler.handle(
          {
            type: 'TransactionEnd',
            stationIdentity: station.ocppIdentity as string,
            transactionRef: session.protocolTransactionId,
            meterStop: 1500,
            timestamp: new Date().toISOString(),
          },
          station,
        );
        expect(result.status).toBe('Accepted');

        const completed = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        expect(completed.status).toBe('COMPLETED');
        expect(completed.energyWh).toBe(500);
      },
    );

    maybe(
      '[B] old transaction -> OFFLINE expired -> new StartTransaction -> old StopTransaction never terminates or corrupts the new session',
      async () => {
        const { station, evse, connector } =
          await seedStation('movos-wo063-stopB');
        const oldSession = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        await moveOfflineAndExpire(station.id, oldSession.id);

        const newSession = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialNewId,
          5000,
        );

        // The old StopTransaction arrives, still carrying the OLD
        // protocolTransactionId (whatever StartTransaction.conf handed the
        // charger originally).
        const result = await transactionEndHandler.handle(
          {
            type: 'TransactionEnd',
            stationIdentity: station.ocppIdentity as string,
            transactionRef: oldSession.protocolTransactionId,
            meterStop: 1800,
            timestamp: new Date().toISOString(),
          },
          station,
        );
        // TransactionEndHandler's existing already-terminal short-circuit
        // (unmodified by this WO) treats the now-FAILED old session as a
        // safe no-op — Accepted, but no mutation.
        expect(result.status).toBe('Accepted');

        const oldAfter = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: oldSession.id },
        });
        expect(oldAfter.status).toBe('FAILED');
        expect(oldAfter.meterStop).toBeNull();

        const newAfter = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: newSession.id },
        });
        expect(newAfter.status).toBe('ACTIVE');
        expect(newAfter.meterStop).toBeNull();
      },
    );

    maybe(
      '[C] old transaction -> OFFLINE expired -> new StartTransaction -> new StopTransaction terminates the NEW session with correct energy',
      async () => {
        const { station, evse, connector } =
          await seedStation('movos-wo063-stopC');
        const oldSession = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        await moveOfflineAndExpire(station.id, oldSession.id);

        const newSession = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialNewId,
          5000,
        );

        const result = await transactionEndHandler.handle(
          {
            type: 'TransactionEnd',
            stationIdentity: station.ocppIdentity as string,
            transactionRef: newSession.protocolTransactionId,
            meterStop: 5300,
            timestamp: new Date().toISOString(),
          },
          station,
        );
        expect(result.status).toBe('Accepted');

        const newAfter = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: newSession.id },
        });
        expect(newAfter.status).toBe('COMPLETED');
        expect(newAfter.meterStart).toBe(5000);
        expect(newAfter.meterStop).toBe(5300);
        expect(newAfter.energyWh).toBe(300);

        // Old session, untouched by this StopTransaction.
        const oldAfter = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: oldSession.id },
        });
        expect(oldAfter.status).toBe('FAILED');
      },
    );
  });

  // ------------------------------------------------------------------
  // 3. Idempotency regression (WO-063 §7)
  // ------------------------------------------------------------------
  describe('idempotency regression', () => {
    maybe(
      'CASE A: duplicate/retried StartTransaction while an ACTIVE session exists returns the same row, no duplicate',
      async () => {
        const { station, evse, connector } = await seedStation(
          'movos-wo063-idemp-a',
        );
        const session = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        const retried = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        expect(retried.id).toBe(session.id);
        const all = await prisma.chargingSession.findMany({
          where: { connectorId: connector.id },
        });
        expect(all).toHaveLength(1);
      },
    );

    maybe(
      'CASE B: same connector, OFFLINE inside the recovery window — no duplicate row',
      async () => {
        const { station, evse, connector } = await seedStation(
          'movos-wo063-idemp-b',
        );
        const session = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        await coordinator.handleConnectionClosed({
          chargingStationId: station.id,
          ocppIdentity: 'dummy',
          reason: 'clean',
        });
        const retried = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        expect(retried.id).toBe(session.id);
        expect(retried.status).toBe('OFFLINE');
        const all = await prisma.chargingSession.findMany({
          where: { connectorId: connector.id },
        });
        expect(all).toHaveLength(1);
      },
    );

    maybe(
      'CASE C: same connector, OFFLINE outside the recovery window — old terminalized, exactly one new row created',
      async () => {
        const { station, evse, connector } = await seedStation(
          'movos-wo063-idemp-c',
        );
        const session = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          1000,
        );
        await moveOfflineAndExpire(station.id, session.id);

        const created = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialNewId,
          5000,
        );
        expect(created.id).not.toBe(session.id);

        // A further retry now hits CASE A against the new ACTIVE row — no
        // third row.
        const retried = await createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialNewId,
          5000,
        );
        expect(retried.id).toBe(created.id);

        const all = await prisma.chargingSession.findMany({
          where: { connectorId: connector.id },
        });
        expect(all).toHaveLength(2);
      },
    );

    maybe(
      'different connector / different EVSE / multi-EVSE station: a superseded session on connector A never affects connector B',
      async () => {
        const station = await prisma.chargingStation.create({
          data: {
            siteId,
            name: 'Station WO063 multi',
            status: 'ACTIVE',
            ocppIdentity: 'movos-wo063-multi',
            connectivityStatus: 'ONLINE',
          },
        });
        const evseA = await prisma.evse.create({
          data: { chargingStationId: station.id, status: 'AVAILABLE' },
        });
        const evseB = await prisma.evse.create({
          data: { chargingStationId: station.id, status: 'AVAILABLE' },
        });
        const connectorA = await prisma.connector.create({
          data: {
            evseId: evseA.id,
            externalId: '1',
            type: 'CCS2',
            status: 'CHARGING',
          },
        });
        const connectorB = await prisma.connector.create({
          data: {
            evseId: evseB.id,
            externalId: '2',
            type: 'CCS2',
            status: 'CHARGING',
          },
        });

        const sessionA = await createSessionFor(
          station.id,
          connectorA.id,
          evseA.id,
          credentialOldId,
          1000,
        );
        const sessionB = await createSessionFor(
          station.id,
          connectorB.id,
          evseB.id,
          credentialOldId,
          2000,
        );

        // Only connector A's session goes OFFLINE and expires — the whole
        // station is disconnected (reconciliation is station-scoped per
        // WO-061), so B goes OFFLINE too, but only A is superseded.
        await moveOfflineAndExpire(station.id, sessionA.id);
        // B is backdated too by moveOfflineAndExpire's raw UPDATE? No —
        // moveOfflineAndExpire only backdates the id passed in. B stays
        // fresh-OFFLINE (inside its own recovery window).

        const newOnA = await createSessionFor(
          station.id,
          connectorA.id,
          evseA.id,
          credentialNewId,
          5000,
        );
        expect(newOnA.id).not.toBe(sessionA.id);

        // Connector B: still OFFLINE, inside window, untouched by A's
        // supersession — a same-shape retry on B still returns B's original
        // row.
        const retriedB = await createSessionFor(
          station.id,
          connectorB.id,
          evseB.id,
          credentialOldId,
          2000,
        );
        expect(retriedB.id).toBe(sessionB.id);
        expect(retriedB.status).toBe('OFFLINE');

        const allA = await prisma.chargingSession.findMany({
          where: { connectorId: connectorA.id },
        });
        const allB = await prisma.chargingSession.findMany({
          where: { connectorId: connectorB.id },
        });
        expect(allA).toHaveLength(2); // old FAILED + new ACTIVE
        expect(allB).toHaveLength(1); // untouched
      },
    );
  });

  // ------------------------------------------------------------------
  // 4. Concurrency (WO-063 §8) — deterministic evidence, not a full fix
  // ------------------------------------------------------------------
  maybe(
    'concurrency: two simultaneous createSession calls for a never-before-occupied connector never produce two ChargingSession rows',
    async () => {
      const { station, evse, connector } = await seedStation(
        'movos-wo063-concurrency',
      );

      const attempt = () =>
        createSessionFor(
          station.id,
          connector.id,
          evse.id,
          credentialOldId,
          100,
        );

      const results = await Promise.allSettled([attempt(), attempt()]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Whatever the split (one wins / one gets a serialization conflict,
      // or — under this test's actual scheduling — both happen to
      // interleave safely), the schema-level truth must hold: exactly one
      // non-terminal ChargingSession row on this connector, never two.
      const rows = await prisma.chargingSession.findMany({
        where: { connectorId: connector.id },
      });
      expect(rows).toHaveLength(1);
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);

      console.log(
        `[CONCURRENCY] ${fulfilled.length} fulfilled, ${rejected.length} rejected (serialization conflict expected for the loser, if any) — 1 row persisted either way`,
      );
    },
  );

  // ------------------------------------------------------------------
  // 5. Digital Twin — real WebSocket, real inbound OCPP (WO-063 §13)
  // ------------------------------------------------------------------
  describe('Digital Twin — real WebSocket end-to-end', () => {
    async function seedTwinStation(ocppIdentity: string) {
      const ocppSecretHash = await bcrypt.hash(OCPP_SECRET, 8);
      const station = await prisma.chargingStation.create({
        data: {
          siteId,
          name: `Station ${ocppIdentity}`,
          status: 'ACTIVE',
          ocppIdentity,
          ocppSecretHash,
        },
      });
      const evse = await prisma.evse.create({
        data: { chargingStationId: station.id, status: 'AVAILABLE' },
      });
      await prisma.connector.create({
        data: {
          evseId: evse.id,
          externalId: '1',
          type: 'CCS2',
          status: 'AVAILABLE',
        },
      });
      return { station, evse };
    }

    async function connectTwin(ocppIdentity: string): Promise<OcppSimulator> {
      const twin = new OcppSimulator({
        host: '127.0.0.1',
        port,
        ocppIdentity,
        secret: OCPP_SECRET,
        protocolVersion: 'OCPP1_6J',
      });
      twins.push(twin);
      await twin.connect();
      return twin;
    }

    maybe(
      'real StartTransaction -> disconnect -> expiry -> real new StartTransaction gets a new session identity -> real StopTransaction reports correct energy',
      async () => {
        const ocppIdentity = 'movos-wo063-twin-collision';
        const { station } = await seedTwinStation(ocppIdentity);

        const twin1 = await connectTwin(ocppIdentity);
        await twin1.sendBootNotification('MediaFOX', 'WO-063-Twin');
        const startResponse = await twin1.sendStartTransaction(
          1,
          'RFID-WO063-OLD-DRIVER',
          1000,
        );
        expect(startResponse.kind).toBe('CALLRESULT');

        const oldSession = await prisma.chargingSession.findFirstOrThrow({
          where: { chargingStationId: station.id, status: 'ACTIVE' },
        });
        expect(oldSession.meterStart).toBe(1000);

        // Real clean disconnect over the real WebSocket.
        twin1.disconnect();
        await new Promise((resolve) => setTimeout(resolve, 150));

        const offline = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: oldSession.id },
        });
        expect(offline.status).toBe('OFFLINE');

        // Push it outside the recovery window.
        await prisma.$executeRawUnsafe(
          `UPDATE "ChargingSession" SET "updatedAt" = NOW() - INTERVAL '2 hours' WHERE id = $1`,
          oldSession.id,
        );

        // A real, new physical connection sends a genuinely new
        // StartTransaction on the same connector.
        const twin2 = await connectTwin(ocppIdentity);
        const newStartResponse = await twin2.sendStartTransaction(
          1,
          'RFID-WO063-NEW-DRIVER',
          5000,
        );
        expect(newStartResponse.kind).toBe('CALLRESULT');
        const newTransactionId = (
          newStartResponse.payload as { transactionId: number }
        ).transactionId;

        const oldAfter = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: oldSession.id },
        });
        expect(oldAfter.status).toBe('FAILED');

        const newSession = await prisma.chargingSession.findFirstOrThrow({
          where: { chargingStationId: station.id, status: 'ACTIVE' },
        });
        expect(newSession.id).not.toBe(oldSession.id);
        expect(newSession.meterStart).toBe(5000);
        expect(String(newTransactionId)).toBe(newSession.protocolTransactionId);

        const stopResponse = await twin2.sendStopTransaction(
          newTransactionId,
          5300,
        );
        expect(stopResponse.kind).toBe('CALLRESULT');

        const completed = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: newSession.id },
        });
        expect(completed.status).toBe('COMPLETED');
        expect(completed.energyWh).toBe(300);
      },
    );
  });
});
