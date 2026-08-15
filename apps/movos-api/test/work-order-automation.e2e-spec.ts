import type { INestApplication } from '@nestjs/common';

import { PrismaService } from '../src/prisma/prisma.service';
import { WorkOrderAutomationService } from '../src/work-orders/work-order-automation.service';
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
