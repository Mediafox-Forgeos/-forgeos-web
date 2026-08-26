import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service';
import { WorkOrderAutomationService } from '../src/work-orders/work-order-automation.service';
import { WorkOrderService } from '../src/work-orders/work-order.service';
import { createTestApp, isDatabaseAvailable, resetDatabase } from './setup-e2e';

const FIFTEEN_MINUTES_MS = 15 * 60_000;

/**
 * WO-ARGOS-038, Objective 2 — the HIGH-severity duplicate-WorkOrder finding
 * from docs/product/OPERATIONAL_LOOP_CHECKPOINT.md, proven server-side
 * against a real database with the real production service (not a mock),
 * calling sweepOfflineStations() directly rather than waiting on its
 * 60-second timer.
 */
describe('Work order connectivity-loss automation idempotency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let automation: WorkOrderAutomationService;
  let available = false;
  let organizationId = '';
  let stationId = '';

  async function countWorkOrders(): Promise<number> {
    return prisma.workOrder.count({
      where: { stationId, source: 'CONNECTIVITY_LOSS' },
    });
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    automation = app.get(WorkOrderAutomationService);
    await resetDatabase(prisma);

    const org = await prisma.organization.create({
      data: {
        name: 'Org Automation',
        slug: 'org-automation',
        status: 'ACTIVE',
      },
    });
    organizationId = org.id;
    const owner = await prisma.user.create({
      data: {
        email: 'owner-automation@kylum.co',
        passwordHash: 'x',
        displayName: 'Owner',
        status: 'ACTIVE',
      },
    });
    const site = await prisma.site.create({
      data: {
        organizationId,
        createdByUserId: owner.id,
        name: 'Site',
        slug: 'site-automation',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
      },
    });
    const station = await prisma.chargingStation.create({
      data: {
        siteId: site.id,
        name: 'Station Automation',
        status: 'ACTIVE',
        connectivityStatus: 'OFFLINE',
        lastDisconnectedAt: new Date(Date.now() - FIFTEEN_MINUTES_MS - 60_000),
      },
    });
    stationId = station.id;
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skip] ${name}: no database available`);
        return;
      }
      await fn();
    });

  maybe(
    'a genuinely offline station gets exactly one CONNECTIVITY_LOSS WorkOrder',
    async () => {
      await automation.sweepOfflineStations();
      expect(await countWorkOrders()).toBe(1);
    },
  );

  maybe(
    'repeated sweeps while still offline do not create duplicates',
    async () => {
      await automation.sweepOfflineStations();
      await automation.sweepOfflineStations();
      await automation.sweepOfflineStations();
      expect(await countWorkOrders()).toBe(1);
    },
  );

  maybe(
    'THE FIX: resolving the WorkOrder while the station remains offline does not trigger a duplicate',
    async () => {
      const existing = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });
      expect(existing).not.toBeNull();
      await prisma.workOrder.update({
        where: { id: existing!.id },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });

      await automation.sweepOfflineStations();

      expect(await countWorkOrders()).toBe(1); // still just the one
    },
  );

  maybe(
    'a genuinely new loss episode (reconnect, then disconnect again) becomes eligible for a new WorkOrder',
    async () => {
      // Reconnect — never touches lastDisconnectedAt.
      await prisma.chargingStation.update({
        where: { id: stationId },
        data: { connectivityStatus: 'ONLINE', lastConnectedAt: new Date() },
      });
      await automation.sweepOfflineStations();
      expect(await countWorkOrders()).toBe(1); // online — sweep skips it

      // `WorkOrder.createdAt` is a real Postgres server timestamp (not
      // fakeable from the Node process), so the whole test suite runs in
      // well under 15 real minutes. To exercise "genuinely new episode"
      // without waiting 15 real minutes, backdate the *existing* episode's
      // WorkOrder further into the past — test setup only, never something
      // production code does — so a new lastDisconnectedAt can validly sit
      // after it while still satisfying the sweep's own 15-minute-stale
      // filter.
      const previous = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });
      await prisma.workOrder.update({
        where: { id: previous!.id },
        data: { createdAt: new Date(Date.now() - 60 * 60_000) },
      });

      // Disconnect again, 20 minutes ago — past the 15-minute threshold,
      // and after the (backdated) previous episode's WorkOrder.
      await prisma.chargingStation.update({
        where: { id: stationId },
        data: {
          connectivityStatus: 'OFFLINE',
          lastDisconnectedAt: new Date(Date.now() - 20 * 60_000),
        },
      });
      await automation.sweepOfflineStations();

      expect(await countWorkOrders()).toBe(2);
    },
  );
});

/**
 * WO-ARGOS-090 — the reconnect-side counterpart, proven against a real
 * database with the real production services (WorkOrderAutomationService +
 * WorkOrderService), not mocks. Covers the full test matrix from §14 of the
 * work order: resolution, non-interference with unrelated/manual work
 * orders, multi-episode history preservation, station/tenant isolation,
 * idempotency, and Requires Attention exclusion/inclusion.
 */
describe('Connectivity-recovery WorkOrder resolution (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let automation: WorkOrderAutomationService;
  let workOrderService: WorkOrderService;
  let available = false;

  async function makeOrgSiteStation(suffix: string) {
    const org = await prisma.organization.create({
      data: {
        name: `Org Recovery ${suffix}`,
        slug: `org-recovery-${suffix}`,
        status: 'ACTIVE',
      },
    });
    const owner = await prisma.user.create({
      data: {
        email: `owner-recovery-${suffix}@kylum.co`,
        passwordHash: 'x',
        displayName: 'Owner',
        status: 'ACTIVE',
      },
    });
    const site = await prisma.site.create({
      data: {
        organizationId: org.id,
        createdByUserId: owner.id,
        name: `Site ${suffix}`,
        slug: `site-recovery-${suffix}`,
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
      },
    });
    const station = await prisma.chargingStation.create({
      data: {
        siteId: site.id,
        name: `Station Recovery ${suffix}`,
        status: 'ACTIVE',
        connectivityStatus: 'OFFLINE',
        lastDisconnectedAt: new Date(Date.now() - FIFTEEN_MINUTES_MS - 60_000),
      },
    });
    return { organizationId: org.id, stationId: station.id };
  }

  async function reconnect(stationId: string): Promise<void> {
    // +1s, not `new Date()` — the eligibility check is a strict `>` against
    // the WorkOrder's own `createdAt` (a real Postgres server timestamp).
    // Two back-to-back writes from the Node test process can land in the
    // same millisecond bucket as that server timestamp, which would make
    // this a flaky tie in the test even though real reconnects are always
    // genuinely later in wall-clock terms (a physical device event, not a
    // same-process race) — the margin removes the test-only flakiness
    // without changing what the assertion actually proves.
    await prisma.chargingStation.update({
      where: { id: stationId },
      data: {
        connectivityStatus: 'ONLINE',
        lastConnectedAt: new Date(Date.now() + 1000),
      },
    });
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    automation = app.get(WorkOrderAutomationService);
    workOrderService = app.get(WorkOrderService);
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skip] ${name}: no database available`);
        return;
      }
      await fn();
    });

  maybe(
    'reconnect resolves the active CONNECTIVITY_LOSS work order',
    async () => {
      const { organizationId, stationId } = await makeOrgSiteStation('resolve');
      await automation.sweepOfflineStations();
      const created = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });
      expect(created?.status).toBe('OPEN');

      await reconnect(stationId);
      await automation.sweepRecoveredConnectivity();

      const after = await prisma.workOrder.findUnique({
        where: { id: created!.id },
      });
      expect(after?.status).toBe('RESOLVED');
      expect(after?.resolvedAt).not.toBeNull();

      const events = await prisma.workOrderEvent.findMany({
        where: { workOrderId: created!.id, type: 'RESOLVED' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].actorId).toBeNull();
      expect(events[0].payload).toMatchObject({
        auto: true,
        reason: 'CONNECTIVITY_RECOVERED',
      });

      const attention =
        await workOrderService.listAttentionItems(organizationId);
      expect(attention.some((item) => item.workOrder.id === created!.id)).toBe(
        false,
      );
    },
  );

  maybe(
    'reconnect does not resolve an unrelated MANUAL work order on the same station',
    async () => {
      const { organizationId, stationId } =
        await makeOrgSiteStation('unrelated');
      const manual = await workOrderService.create(organizationId, {
        title: 'Mantenimiento preventivo',
        description: 'Revisión trimestral programada.',
        priority: 'MEDIUM',
        source: 'MANUAL',
        stationId,
        actorId: null,
      });

      await automation.sweepOfflineStations();
      await reconnect(stationId);
      await automation.sweepRecoveredConnectivity();

      const after = await prisma.workOrder.findUnique({
        where: { id: manual.id },
      });
      expect(after?.status).toBe('OPEN');
    },
  );

  maybe(
    'a second later outage creates a new, distinct WorkOrder — the first is preserved, never deleted',
    async () => {
      const { stationId } = await makeOrgSiteStation('multi-episode');
      await automation.sweepOfflineStations();
      const first = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });

      await reconnect(stationId);
      await automation.sweepRecoveredConnectivity();
      const firstAfterRecovery = await prisma.workOrder.findUnique({
        where: { id: first!.id },
      });
      expect(firstAfterRecovery?.status).toBe('RESOLVED');

      // A second, genuinely new outage — same backdating technique the
      // idempotency suite above already uses, to exercise "15 minutes
      // stale" without a real 15-minute wait.
      await prisma.workOrder.update({
        where: { id: first!.id },
        data: { createdAt: new Date(Date.now() - 60 * 60_000) },
      });
      await prisma.chargingStation.update({
        where: { id: stationId },
        data: {
          connectivityStatus: 'OFFLINE',
          lastDisconnectedAt: new Date(Date.now() - 20 * 60_000),
        },
      });
      await automation.sweepOfflineStations();

      const all = await prisma.workOrder.findMany({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
        orderBy: { createdAt: 'asc' },
      });
      expect(all).toHaveLength(2);
      expect(all[0].id).toBe(first!.id);
      expect(all[0].status).toBe('RESOLVED'); // history preserved, untouched
      expect(all[1].status).toBe('OPEN'); // the new, distinct incident
    },
  );

  maybe(
    'multiple stations are resolved independently of each other',
    async () => {
      const a = await makeOrgSiteStation('station-a');
      const b = await makeOrgSiteStation('station-b');
      await automation.sweepOfflineStations();
      const woA = await prisma.workOrder.findFirst({
        where: { stationId: a.stationId, source: 'CONNECTIVITY_LOSS' },
      });
      const woB = await prisma.workOrder.findFirst({
        where: { stationId: b.stationId, source: 'CONNECTIVITY_LOSS' },
      });

      await reconnect(a.stationId); // only station A reconnects
      await automation.sweepRecoveredConnectivity();

      expect(
        (await prisma.workOrder.findUnique({ where: { id: woA!.id } }))?.status,
      ).toBe('RESOLVED');
      expect(
        (await prisma.workOrder.findUnique({ where: { id: woB!.id } }))?.status,
      ).toBe('OPEN'); // untouched — station B never reconnected
    },
  );

  maybe(
    "tenant isolation: resolving one organization never touches another organization's work order",
    async () => {
      const org1 = await makeOrgSiteStation('tenant-1');
      const org2 = await makeOrgSiteStation('tenant-2');
      await automation.sweepOfflineStations();
      const wo1 = await prisma.workOrder.findFirst({
        where: { stationId: org1.stationId, source: 'CONNECTIVITY_LOSS' },
      });
      const wo2 = await prisma.workOrder.findFirst({
        where: { stationId: org2.stationId, source: 'CONNECTIVITY_LOSS' },
      });
      expect(wo1?.organizationId).not.toBe(wo2?.organizationId);

      await reconnect(org1.stationId);
      await automation.sweepRecoveredConnectivity();

      expect(
        (await prisma.workOrder.findUnique({ where: { id: wo1!.id } }))?.status,
      ).toBe('RESOLVED');
      expect(
        (await prisma.workOrder.findUnique({ where: { id: wo2!.id } }))?.status,
      ).toBe('OPEN');
    },
  );

  maybe(
    'a duplicate/overlapping reconnect signal is idempotent — no double-resolution, no error',
    async () => {
      const { stationId } = await makeOrgSiteStation('idempotent');
      await automation.sweepOfflineStations();
      await reconnect(stationId);

      await automation.sweepRecoveredConnectivity();
      await automation.sweepRecoveredConnectivity();
      await automation.sweepRecoveredConnectivity();

      const wo = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });
      const events = await prisma.workOrderEvent.findMany({
        where: { workOrderId: wo!.id, type: 'RESOLVED' },
      });
      expect(events).toHaveLength(1); // not 3
    },
  );

  maybe(
    'Requires Attention shows the active new outage but excludes the already-recovered one',
    async () => {
      const { organizationId, stationId } =
        await makeOrgSiteStation('attention');
      await automation.sweepOfflineStations();
      const recovered = await prisma.workOrder.findFirst({
        where: { stationId, source: 'CONNECTIVITY_LOSS' },
      });
      await reconnect(stationId);
      await automation.sweepRecoveredConnectivity();

      // New outage, same station, later episode.
      await prisma.workOrder.update({
        where: { id: recovered!.id },
        data: { createdAt: new Date(Date.now() - 60 * 60_000) },
      });
      await prisma.chargingStation.update({
        where: { id: stationId },
        data: {
          connectivityStatus: 'OFFLINE',
          lastDisconnectedAt: new Date(Date.now() - 20 * 60_000),
        },
      });
      await automation.sweepOfflineStations();
      const active = await prisma.workOrder.findFirst({
        where: {
          stationId,
          source: 'CONNECTIVITY_LOSS',
          status: { not: 'RESOLVED' },
        },
      });

      const attention =
        await workOrderService.listAttentionItems(organizationId);
      const attentionIds = attention.map((item) => item.workOrder.id);
      expect(attentionIds).toContain(active!.id);
      expect(attentionIds).not.toContain(recovered!.id);
    },
  );
});
