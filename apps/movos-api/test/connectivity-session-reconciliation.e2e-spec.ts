import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service';
import { ConnectivityCoordinator } from '../src/ocpp/connectivity/connectivity-coordinator.service';
import { SessionLifecycleService } from '../src/sessions/session-lifecycle.service';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';

/**
 * WO-ARGOS-061 scope item 16 — the confirmed WO-ARGOS-060 reproduction,
 * turned into a permanent regression test. Real PostgreSQL, real Prisma,
 * real SessionLifecycleService and ConnectivityCoordinator pulled from the
 * full app's DI container — mirrors the exact sequence WO-060's own
 * (temporary, deleted) reproduction used: real org -> site -> station ->
 * EVSE -> connector -> credential -> real ACTIVE ChargingSession via
 * createSession -> ConnectivityCoordinator.handleConnectionClosed
 * (reason='clean'). Requires a reachable PostgreSQL; skips cleanly
 * (documented, not silently) when none is available — same convention as
 * tenant-isolation.e2e-spec.ts and remote-command-tenant-isolation.e2e-spec.ts.
 */
describe('ConnectivityCoordinator session reconciliation (e2e, WO-ARGOS-061)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let coordinator: ConnectivityCoordinator;
  let sessionLifecycle: SessionLifecycleService;
  let available = false;

  let organizationId = '';
  let siteId = '';
  let userId = '';
  let credentialId = '';

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
    await resetDatabase(prisma);

    const org = await prisma.organization.create({
      data: { name: 'Org Recon', slug: 'wo-061-org', status: 'ACTIVE' },
    });
    organizationId = org.id;

    const user = await seedUser(prisma, {
      email: 'owner@wo-061.test',
      password: 'password-123',
      displayName: 'Owner',
    });
    userId = user.id;
    await prisma.membership.create({
      data: {
        userId,
        organizationId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const site = await prisma.site.create({
      data: {
        organizationId,
        name: 'Site Recon',
        slug: 'wo-061-site',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: userId,
      },
    });
    siteId = site.id;

    const credential = await prisma.authorizationCredential.create({
      data: {
        organizationId,
        type: 'RFID',
        externalIdentifier: 'RFID-WO-061',
        status: 'ACTIVE',
      },
    });
    credentialId = credential.id;
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  // Fresh station/EVSE/connector per test so sessions from one test never
  // interfere with the next — the reconciliation query is station-scoped.
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

  async function createActiveSession(
    stationId: string,
    connId: string,
    evId: string,
  ) {
    return sessionLifecycle.createSession({
      organizationId,
      siteId,
      chargingStationId: stationId,
      evseId: evId,
      connectorId: connId,
      authorizationCredentialId: credentialId,
      protocolVersion: 'OCPP1_6J',
      meterStart: 0,
      startedAt: new Date(),
    });
  }

  maybe(
    'clean disconnect reconciles an ACTIVE session to OFFLINE, leaves Connector/Evse status untouched',
    async () => {
      const { station, evse, connector } =
        await seedStation('movos-wo061-clean');
      const session = await createActiveSession(
        station.id,
        connector.id,
        evse.id,
      );
      expect(session.status).toBe('ACTIVE');

      await coordinator.handleConnectionClosed({
        chargingStationId: station.id,
        ocppIdentity: station.ocppIdentity as string,
        reason: 'clean',
      });

      const persistedStation = await prisma.chargingStation.findUniqueOrThrow({
        where: { id: station.id },
      });
      expect(persistedStation.connectivityStatus).toBe('OFFLINE');

      const persistedSession = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(persistedSession.status).toBe('OFFLINE');

      // Connector/Evse status must be untouched — WO-060 confirmed
      // StatusNotificationHandler remains the sole writer of Connector.status,
      // and Evse.status (administrative) is independent of connectivity.
      const persistedConnector = await prisma.connector.findUniqueOrThrow({
        where: { id: connector.id },
      });
      expect(persistedConnector.status).toBe('CHARGING');

      const persistedEvse = await prisma.evse.findUniqueOrThrow({
        where: { id: evse.id },
      });
      expect(persistedEvse.status).toBe('AVAILABLE');
    },
  );

  maybe(
    'a clean-disconnect-created OFFLINE session is discovered and recovered on reconnect',
    async () => {
      const { station, evse, connector } = await seedStation(
        'movos-wo061-reconnect',
      );
      const session = await createActiveSession(
        station.id,
        connector.id,
        evse.id,
      );

      await coordinator.handleConnectionClosed({
        chargingStationId: station.id,
        ocppIdentity: station.ocppIdentity as string,
        reason: 'clean',
      });
      const offlineSession = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(offlineSession.status).toBe('OFFLINE');

      await coordinator.handleConnectionEstablished({
        chargingStationId: station.id,
        ocppIdentity: station.ocppIdentity as string,
        protocolVersion: 'OCPP1_6J',
      });

      const recoveredSession = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      expect(recoveredSession.status).toBe('ACTIVE');

      const auditEvents = await prisma.auditEvent.findMany({
        where: { subjectId: session.id, action: 'SESSION_RECOVERED' },
      });
      expect(auditEvents).toHaveLength(1);
    },
  );

  maybe(
    'multi-connector station: every ACTIVE/SUSPENDED session on the station is reconciled on a clean disconnect',
    async () => {
      const station = await prisma.chargingStation.create({
        data: {
          siteId,
          name: 'Station multi-connector',
          status: 'ACTIVE',
          ocppIdentity: 'movos-wo061-multi',
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

      const sessionA = await createActiveSession(
        station.id,
        connectorA.id,
        evseA.id,
      );
      const sessionB = await createActiveSession(
        station.id,
        connectorB.id,
        evseB.id,
      );

      await coordinator.handleConnectionClosed({
        chargingStationId: station.id,
        ocppIdentity: station.ocppIdentity as string,
        reason: 'clean',
      });

      const persistedA = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: sessionA.id },
      });
      const persistedB = await prisma.chargingSession.findUniqueOrThrow({
        where: { id: sessionB.id },
      });
      expect(persistedA.status).toBe('OFFLINE');
      expect(persistedB.status).toBe('OFFLINE');
    },
  );

  maybe(
    'GET-active-sessions source of truth: a reconciled session no longer qualifies as ACTIVE/SUSPENDED at the query level',
    async () => {
      const { station, evse, connector } = await seedStation(
        'movos-wo061-active-query',
      );
      const session = await createActiveSession(
        station.id,
        connector.id,
        evse.id,
      );

      await coordinator.handleConnectionClosed({
        chargingStationId: station.id,
        ocppIdentity: station.ocppIdentity as string,
        reason: 'clean',
      });

      // This mirrors exactly the where-clause GET /sessions/active uses
      // (status IN ACTIVE/SUSPENDED) — the operator-surface regression
      // WO-061 item 18 asks to validate, at the source-of-truth level.
      const stillActive = await prisma.chargingSession.findFirst({
        where: { id: session.id, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      });
      expect(stillActive).toBeNull();
    },
  );
});
