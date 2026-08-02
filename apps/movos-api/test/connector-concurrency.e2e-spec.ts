import { Test } from '@nestjs/testing';

import { PrismaService } from '../src/prisma/prisma.service';
import { SessionLifecycleService } from '../src/sessions/session-lifecycle.service';
import { TransactionIdGeneratorService } from '../src/sessions/transaction-id-generator.service';
import { ensureTestEnv, isDatabaseAvailable } from './setup-e2e';

/**
 * CAP-006A (WO-ARGOS-012) — real-Postgres proof that Invariant 1 ("at most
 * one non-terminal ChargingSession per connector") and Invariant 3
 * ("reconnect is idempotent") hold under actual concurrent execution, not
 * just mocked/sequential unit tests. Requires a reachable PostgreSQL (see
 * setup-e2e.ts); skips cleanly, like every other e2e spec in this repo,
 * when none is available — see docs/engineering/TESTING_STRATEGY.md's
 * documented, accepted gap (no CI database service exists yet).
 *
 * Fires genuinely concurrent calls via Promise.all against the real
 * SessionLifecycleService + PrismaService (no mocks) — this is the one
 * layer of proof a mocked-Prisma unit test structurally cannot provide,
 * since a mock's $transaction callback always runs synchronously/
 * sequentially, never actually contending for a real advisory lock.
 */
describe('Connector concurrency (e2e, real Postgres)', () => {
  let available = false;
  let prisma: PrismaService;
  let service: SessionLifecycleService;

  let userId: string;
  let organizationId: string;
  let siteId: string;
  let chargingStationId: string;
  let evseId: string;
  let connectorId: string;
  let credentialId: string;

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    ensureTestEnv();
    prisma = new PrismaService();
    await prisma.$connect();

    const moduleRef = await Test.createTestingModule({
      providers: [
        SessionLifecycleService,
        TransactionIdGeneratorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SessionLifecycleService);
  });

  afterAll(async () => {
    if (!available) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!available) return;

    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `cap006a-${unique}@example.test`,
        passwordHash: 'not-a-real-hash',
        displayName: 'CAP-006A Test User',
        status: 'ACTIVE',
      },
    });
    const org = await prisma.organization.create({
      data: {
        name: 'CAP-006A Test Org',
        slug: `cap006a-${unique}`,
        status: 'ACTIVE',
      },
    });
    const site = await prisma.site.create({
      data: {
        organizationId: org.id,
        name: 'Test Site',
        slug: `test-site-${unique}`,
        city: 'Bogotá',
        address: 'N/A',
        status: 'ACTIVE',
        createdByUserId: user.id,
      },
    });
    const station = await prisma.chargingStation.create({
      data: { siteId: site.id, name: 'Test Station', status: 'ACTIVE' },
    });
    const evse = await prisma.evse.create({
      data: {
        chargingStationId: station.id,
        externalId: '1',
        status: 'AVAILABLE',
      },
    });
    const connector = await prisma.connector.create({
      data: {
        evseId: evse.id,
        externalId: '1',
        type: 'TYPE2',
        status: 'AVAILABLE',
      },
    });
    const credential = await prisma.authorizationCredential.create({
      data: {
        organizationId: org.id,
        type: 'RFID',
        externalIdentifier: `TESTCARD-${unique}`,
        status: 'ACTIVE',
      },
    });

    userId = user.id;
    organizationId = org.id;
    siteId = site.id;
    chargingStationId = station.id;
    evseId = evse.id;
    connectorId = connector.id;
    credentialId = credential.id;
  });

  afterEach(async () => {
    if (!available) return;
    // Cascade cleanup, deepest-first — no shared resetDatabase() helper
    // touches the charging domain, so this suite owns its own teardown.
    await prisma.meterValue.deleteMany({});
    await prisma.chargingSession.deleteMany({ where: { organizationId } });
    await prisma.authorizationAttempt.deleteMany({ where: { organizationId } });
    await prisma.authorizationCredential.deleteMany({
      where: { organizationId },
    });
    await prisma.connector.deleteMany({ where: { evseId } });
    await prisma.evse.deleteMany({ where: { chargingStationId } });
    await prisma.chargingStation.deleteMany({ where: { siteId } });
    await prisma.site.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  function sessionInput(
    overrides: Partial<
      Parameters<SessionLifecycleService['createSession']>[0]
    > = {},
  ) {
    return {
      organizationId,
      siteId,
      chargingStationId,
      evseId,
      connectorId,
      authorizationCredentialId: credentialId,
      protocolVersion: 'OCPP1_6J' as const,
      meterStart: 1000,
      startedAt: new Date(),
      ...overrides,
    };
  }

  it('simultaneous StartTransaction calls on the same connector produce exactly one non-terminal session (Invariant 1)', async () => {
    if (!available) {
      console.warn('Skipping: no reachable test database');
      return;
    }

    const CONCURRENT_CALLS = 10;
    const results = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () =>
        service.createSession(sessionInput()),
      ),
    );

    // Every call must have resolved to the SAME session id — the winner's
    // row, returned to every loser via the idempotent-existing-session path.
    const uniqueIds = new Set(results.map((r) => r.id));
    expect(uniqueIds.size).toBe(1);

    const rows = await prisma.chargingSession.findMany({
      where: {
        connectorId,
        status: {
          in: [
            'PENDING',
            'AUTHORIZED',
            'STARTING',
            'ACTIVE',
            'SUSPENDED',
            'OFFLINE',
            'STOPPING',
          ],
        },
      },
    });
    expect(rows).toHaveLength(1);
  }, 30_000);

  it('connector contention: a reconnect-triggered recovery racing a fresh StartTransaction still leaves exactly one non-terminal session (Invariant 1)', async () => {
    if (!available) {
      console.warn('Skipping: no reachable test database');
      return;
    }

    const original = await service.createSession(sessionInput());
    await service.suspendSession(original.id, 'OFFLINE');

    const [recoveryResult, raceResult] = await Promise.allSettled([
      service.recoverOfflineSession(original.id, 15 * 60_000),
      service.createSession(sessionInput({ meterStart: 2000 })),
    ]);

    expect(recoveryResult.status).toBe('fulfilled');
    expect(raceResult.status).toBe('fulfilled');

    const rows = await prisma.chargingSession.findMany({
      where: {
        connectorId,
        status: {
          in: [
            'PENDING',
            'AUTHORIZED',
            'STARTING',
            'ACTIVE',
            'SUSPENDED',
            'OFFLINE',
            'STOPPING',
          ],
        },
      },
    });
    // Exactly one survives non-terminal — either the recovered original (if
    // the race's createSession lost / returned the existing row), or a new
    // session with the original left rejected-and-still-OFFLINE... but
    // OFFLINE is itself non-terminal, so the real invariant under test is
    // simply: never two ACTIVE-or-otherwise-live rows at once.
    expect(rows.length).toBe(1);
  }, 30_000);

  it('recovery replay: concurrent recoverOfflineSession calls for the same session resolve exactly once (Invariant 3, idempotent reconnect)', async () => {
    if (!available) {
      console.warn('Skipping: no reachable test database');
      return;
    }

    const session = await service.createSession(sessionInput());
    await service.suspendSession(session.id, 'OFFLINE');

    const results = await Promise.all([
      service.recoverOfflineSession(session.id, 15 * 60_000),
      service.recoverOfflineSession(session.id, 15 * 60_000),
      service.recoverOfflineSession(session.id, 15 * 60_000),
    ]);

    const recoveredCount = results.filter(
      (r) => r.outcome === 'recovered',
    ).length;
    const alreadyResolvedCount = results.filter(
      (r) => r.outcome === 'already-resolved',
    ).length;
    expect(recoveredCount).toBe(1);
    expect(alreadyResolvedCount).toBe(2);

    const fresh = await prisma.chargingSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    expect(fresh.status).toBe('ACTIVE');
  }, 30_000);

  it('orphan cleanup: a session that never reconnects is left for the orphan sweep, not silently duplicated by a subsequent StartTransaction', async () => {
    if (!available) {
      console.warn('Skipping: no reachable test database');
      return;
    }

    const orphaned = await service.createSession(sessionInput());
    await service.suspendSession(orphaned.id, 'OFFLINE');

    // Simulates OrphanSessionSweepService's terminal action once the
    // recovery window has passed — proves the connector is genuinely free
    // afterward for a real new session, with no leftover non-terminal row.
    await service.failSession(orphaned.id, 'NETWORK_FAILURE');

    const fresh = await service.createSession(
      sessionInput({ meterStart: 500 }),
    );
    expect(fresh.id).not.toBe(orphaned.id);

    const rows = await prisma.chargingSession.findMany({
      where: {
        connectorId,
        status: {
          in: [
            'PENDING',
            'AUTHORIZED',
            'STARTING',
            'ACTIVE',
            'SUSPENDED',
            'OFFLINE',
            'STOPPING',
          ],
        },
      },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(fresh.id);
  }, 30_000);

  // Defense-in-depth proof (CAP-006A_INVARIANTS.md, Invariant 1): even
  // bypassing SessionLifecycleService entirely — no advisory lock, two raw
  // concurrent inserts straight through Prisma — the partial unique index
  // `ChargingSession_connectorId_nonterminal_key` still rejects the second
  // row outright. This is what "the invariant holds independent of
  // application code's discipline" actually means, proven rather than
  // merely asserted in the doc.
  it('the partial unique index rejects a second non-terminal row on the same connector even with the advisory lock bypassed entirely', async () => {
    if (!available) {
      console.warn('Skipping: no reachable test database');
      return;
    }

    const insertRaw = () =>
      prisma.chargingSession.create({
        data: {
          organizationId,
          siteId,
          chargingStationId,
          evseId,
          connectorId,
          authorizationCredentialId: credentialId,
          protocolVersion: 'OCPP1_6J',
          protocolTransactionId: String(Math.floor(Math.random() * 1_000_000)),
          status: 'ACTIVE',
          meterStart: 1000,
          energyWh: 0,
          startedAt: new Date(),
        },
      });

    const results = await Promise.allSettled([insertRaw(), insertRaw()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toMatch(
      /Unique constraint failed|ChargingSession_connectorId_nonterminal_key/,
    );

    const rows = await prisma.chargingSession.findMany({
      where: {
        connectorId,
        status: {
          in: [
            'PENDING',
            'AUTHORIZED',
            'STARTING',
            'ACTIVE',
            'SUSPENDED',
            'OFFLINE',
            'STOPPING',
          ],
        },
      },
    });
    expect(rows).toHaveLength(1);
  }, 30_000);
});
