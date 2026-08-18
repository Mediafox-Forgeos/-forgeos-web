import type { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../src/prisma/prisma.service';
import { OcppWebSocketServer } from '../src/ocpp/transport/ocpp-websocket.server';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';
// WO-ARGOS-059/061 — the real Digital Twin client, imported by this
// integration spec only (mirrors remote-command.digital-twin.spec.ts's own
// precedent). apps/movos-api/tsconfig.build.json excludes simulator/ from
// the production build regardless of this import.
import { OcppSimulator } from '../simulator/ocpp-simulator';

const OCPP_SECRET = 'wo-061-digital-twin-secret';

/**
 * WO-ARGOS-061 scope item 17 — Digital Twin end-to-end validation of the
 * clean-disconnect session-stranding fix, over a real WebSocket and a real
 * inbound OCPP path (not a direct ConnectivityCoordinator method call —
 * that is already covered by connectivity-session-reconciliation.e2e-spec.ts).
 * Reuses the full real AppModule (real handlers, real PrismaService, real
 * ConnectionRegistryService, real ConnectivityCoordinator) — nothing here
 * is mocked. Requires a reachable PostgreSQL; skips cleanly when none is
 * available, same convention as every other *.e2e-spec.ts in this
 * directory. Uses an isolated local Digital Twin instance only — never the
 * production Kylum Digital Twin, per the WO's explicit instruction.
 *
 * Flow: real StartTransaction over a real WebSocket -> real ACTIVE
 * ChargingSession -> Digital Twin clean disconnect -> production
 * ws.on('close') -> ConnectionRegistry.unregister ->
 * ConnectivityCoordinator.handleConnectionClosed -> persisted station
 * OFFLINE, persisted session OFFLINE -> Digital Twin reconnects -> existing
 * recovery mechanism restores the session to ACTIVE.
 */
describe('ConnectivityCoordinator — Digital Twin clean-disconnect reconciliation (WO-ARGOS-061)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let port: number;
  let available = false;

  let siteId = '';
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
    await resetDatabase(prisma);

    await app.listen(0);
    // Must happen after listen() — the underlying http.Server only exists
    // once listening has started (same ordering main.ts itself uses).
    app.get(OcppWebSocketServer).attach(app.getHttpServer());
    const address = app.getHttpServer().address();
    port = typeof address === 'object' && address ? address.port : 0;

    const org = await prisma.organization.create({
      data: {
        name: 'Org Twin Recon',
        slug: 'wo-061-twin-org',
        status: 'ACTIVE',
      },
    });

    const user = await seedUser(prisma, {
      email: 'owner@wo-061-twin.test',
      password: 'password-123',
      displayName: 'Owner',
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const site = await prisma.site.create({
      data: {
        organizationId: org.id,
        name: 'Site Twin Recon',
        slug: 'wo-061-twin-site',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: user.id,
      },
    });
    siteId = site.id;

    await prisma.authorizationCredential.create({
      data: {
        organizationId: org.id,
        type: 'RFID',
        externalIdentifier: 'RFID-WO-061-TWIN',
        status: 'ACTIVE',
      },
    });
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
    // ConnectionRegistryService invokes ConnectivityCoordinator fire-and-
    // forget (by design — a connectivity-side failure must never propagate
    // into transport-layer connection handling). Give that in-flight
    // reconciliation time to settle before afterAll's resetDatabase() can
    // race it and delete rows out from under an in-progress transition.
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  async function seedStation(ocppIdentity: string) {
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
    'a real StartTransaction followed by a clean Digital Twin disconnect reconciles the session to OFFLINE, then a reconnect recovers it to ACTIVE',
    async () => {
      const ocppIdentity = 'movos-wo061-twin-clean';
      const { station } = await seedStation(ocppIdentity);

      const twin = await connectTwin(ocppIdentity);
      await twin.sendBootNotification('MediaFOX', 'WO-061-Twin');

      const startResponse = await twin.sendStartTransaction(
        1,
        'RFID-WO-061-TWIN',
        0,
      );
      expect(startResponse.kind).toBe('CALLRESULT');

      const activeSession = await prisma.chargingSession.findFirstOrThrow({
        where: { chargingStationId: station.id, status: 'ACTIVE' },
      });

      // Real clean disconnect over the real WebSocket — production's
      // ws.on('close') -> ConnectionRegistry.unregister ->
      // ConnectivityCoordinator.handleConnectionClosed chain, exactly as a
      // physical charge point disconnecting would trigger it.
      twin.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 150));

      const stationAfterDisconnect =
        await prisma.chargingStation.findUniqueOrThrow({
          where: { id: station.id },
        });
      expect(stationAfterDisconnect.connectivityStatus).toBe('OFFLINE');

      const sessionAfterDisconnect =
        await prisma.chargingSession.findUniqueOrThrow({
          where: { id: activeSession.id },
        });
      expect(sessionAfterDisconnect.status).toBe('OFFLINE');

      // Reconnect — same identity, new WebSocket, same real transport path.
      // The existing recovery mechanism (unmodified by this WO) must
      // discover the OFFLINE session and restore it, proving the WO-060
      // §5 "invisible to reconnect" gap is closed as a side effect of the
      // clean-disconnect fix.
      await connectTwin(ocppIdentity);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const sessionAfterReconnect =
        await prisma.chargingSession.findUniqueOrThrow({
          where: { id: activeSession.id },
        });
      expect(sessionAfterReconnect.status).toBe('ACTIVE');

      const stationAfterReconnect =
        await prisma.chargingStation.findUniqueOrThrow({
          where: { id: station.id },
        });
      expect(stationAfterReconnect.connectivityStatus).toBe('ONLINE');
    },
  );
});
