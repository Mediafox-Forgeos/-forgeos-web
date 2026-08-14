import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MemberRole } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';

/**
 * Technician Identity & My Work (WO-ARGOS-037) — Objective 7's mandatory
 * security tests. Mirrors tenant-isolation.e2e-spec.ts's real-database
 * pattern (skips cleanly when no PostgreSQL is reachable).
 */
describe('Technician isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let stationA = '';
  let woTech1 = ''; // assigned to tech-1 (org A)
  let woTech2 = ''; // assigned to tech-2 (org A)
  let tokenOwnerA = '';
  let tokenTech1 = '';
  let tokenTech2 = '';
  let tokenTechB = '';
  let tech1UserId = '';

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
  }): Promise<{ userId: string; membershipId: string }> {
    const user = await seedUser(prisma, {
      email: params.email,
      password: 'password-123',
      displayName: params.email,
    });
    const membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: params.organizationId,
        role: params.role,
        status: 'ACTIVE',
      },
    });
    return { userId: user.id, membershipId: membership.id };
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a-tech', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b-tech', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    await createUserWithMembership({
      email: 'owner-a@kylum.co',
      organizationId: orgA,
      role: 'OWNER',
    });
    const tech1 = await createUserWithMembership({
      email: 'tech1-a@kylum.co',
      organizationId: orgA,
      role: 'TECHNICIAN',
    });
    tech1UserId = tech1.userId;
    await createUserWithMembership({
      email: 'tech2-a@kylum.co',
      organizationId: orgA,
      role: 'TECHNICIAN',
    });
    await createUserWithMembership({
      email: 'owner-b@kylum.co',
      organizationId: orgB,
      role: 'OWNER',
    });
    await createUserWithMembership({
      email: 'techb-b@kylum.co',
      organizationId: orgB,
      role: 'TECHNICIAN',
    });

    tokenOwnerA = await login('owner-a@kylum.co', 'password-123');
    tokenTech1 = await login('tech1-a@kylum.co', 'password-123');
    tokenTech2 = await login('tech2-a@kylum.co', 'password-123');
    tokenTechB = await login('techb-b@kylum.co', 'password-123');
    const tokenOwnerB = await login('owner-b@kylum.co', 'password-123');

    // Real site + station in org A, created via the API by its OWNER.
    const site = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'Site A1', city: 'Bogotá', address: 'Cra 1' });

    const station = await request(app.getHttpServer())
      .post(`/api/v1/sites/${site.body.id}/charging-stations`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'Station A1' });
    stationA = station.body.id;

    // A station in org B too, so a cross-org WorkOrder can never even be
    // created against org A — created for completeness, not used directly.
    const siteB = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .set('X-Organization-Id', orgB)
      .send({ name: 'Site B1', city: 'Cali', address: 'Cra 9' });
    await request(app.getHttpServer())
      .post(`/api/v1/sites/${siteB.body.id}/charging-stations`)
      .set('Authorization', `Bearer ${tokenOwnerB}`)
      .set('X-Organization-Id', orgB)
      .send({ name: 'Station B1' });

    // Two work orders in org A, one assigned to each technician, by the
    // OWNER — the only role with `assign` access.
    const wo1 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        title: 'Conector sin respuesta',
        description: 'Requiere revisión en sitio.',
        priority: 'HIGH',
        source: 'MANUAL',
        stationId: stationA,
      });
    woTech1 = wo1.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woTech1}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'assign', assignedMemberId: tech1UserId });

    const tech2 = await prisma.membership.findFirst({
      where: {
        organizationId: orgA,
        role: 'TECHNICIAN',
        userId: { not: tech1UserId },
      },
    });
    const wo2 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        title: 'Estación fuera de línea',
        description: 'Segunda orden de trabajo.',
        priority: 'MEDIUM',
        source: 'MANUAL',
        stationId: stationA,
      });
    woTech2 = wo2.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woTech2}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'assign', assignedMemberId: tech2!.userId });
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

  // 1. A technician can read their own assigned WorkOrder.
  maybe('a technician can read their own assigned work order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/my-work/${woTech1}`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(woTech1);
    expect(res.body.assignedMemberId).toBe(tech1UserId);
  });

  // 2. A technician cannot read another technician's assigned WorkOrder
  //    merely by changing an id.
  maybe(
    "a technician cannot read a colleague's work order by substituting its id",
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/my-work/${woTech2}`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(404);
    },
  );

  maybe(
    "a technician cannot list a colleague's work order via /my-work either",
    async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/my-work')
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ id: string }>).map((wo) => wo.id);
      expect(ids).toContain(woTech1);
      expect(ids).not.toContain(woTech2);
    },
  );

  // 3. A technician from Organization A cannot read WorkOrders from
  //    Organization B (and vice versa — org B's technician has none in org
  //    A's tenant at all).
  maybe(
    'a technician from another organization cannot read this work order',
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/my-work/${woTech1}`)
        .set('Authorization', `Bearer ${tokenTechB}`)
        .set('X-Organization-Id', orgB);
      // OrgContextGuard resolves the active org from the header, then
      // membership scoping excludes a WorkOrder from a different tenant —
      // same 404, existence never revealed either way.
      expect(res.status).toBe(404);
    },
  );

  maybe(
    'a technician cannot read across organizations even with a forged org header',
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/my-work/${woTech1}`)
        .set('Authorization', `Bearer ${tokenTechB}`)
        .set('X-Organization-Id', orgA);
      // OrgContextGuard itself rejects this — techB has no ACTIVE
      // Membership in orgA at all.
      expect(res.status).toBe(403);
    },
  );

  // 4. A technician cannot assign work orders unless separately authorized.
  maybe(
    'a technician cannot use the operator-facing work-orders endpoint at all',
    async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/work-orders')
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(403);
    },
  );

  maybe(
    'a technician cannot assign a work order to themselves via /my-work',
    async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/my-work/${woTech1}`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({ transition: 'assign', assignedMemberId: tech1UserId });
      expect(res.status).toBe(400);
    },
  );

  maybe(
    'a technician cannot cancel their own work order via /my-work',
    async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/my-work/${woTech1}`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({ transition: 'cancel', comment: 'no' });
      expect(res.status).toBe(400);
    },
  );

  // 5. Invalid WorkOrder state transitions are rejected server-side.
  maybe(
    'resolving a work order that was never started is rejected server-side',
    async () => {
      // woTech1 is ASSIGNED, not IN_PROGRESS — `resolve` is not a valid
      // transition from ASSIGNED per WorkOrderService's own state machine,
      // which MyWorkService delegates to rather than re-implementing.
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/my-work/${woTech1}`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({ transition: 'resolve', comment: 'listo' });
      expect(res.status).toBe(409);
    },
  );

  maybe('start then resolve follows the real state machine', async () => {
    const start = await request(app.getHttpServer())
      .patch(`/api/v1/my-work/${woTech1}`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'start' });
    expect(start.status).toBe(200);
    expect(start.body.status).toBe('IN_PROGRESS');

    const resolve = await request(app.getHttpServer())
      .patch(`/api/v1/my-work/${woTech1}`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'resolve', comment: 'Conector reiniciado.' });
    expect(resolve.status).toBe(200);
    expect(resolve.body.status).toBe('RESOLVED');
  });

  // 6. Revoked organization membership removes technician access on the
  //    next request, preserving DEC-022 semantics (no caching — re-checked
  //    server-side every request).
  maybe(
    'revoking membership blocks access on the very next request',
    async () => {
      const before = await request(app.getHttpServer())
        .get('/api/v1/my-work')
        .set('Authorization', `Bearer ${tokenTech2}`)
        .set('X-Organization-Id', orgA);
      expect(before.status).toBe(200);

      const tech2Membership = await prisma.membership.findFirst({
        where: {
          organizationId: orgA,
          role: 'TECHNICIAN',
          userId: { not: tech1UserId },
        },
      });
      await prisma.membership.update({
        where: { id: tech2Membership!.id },
        data: { status: 'SUSPENDED' },
      });

      const after = await request(app.getHttpServer())
        .get('/api/v1/my-work')
        .set('Authorization', `Bearer ${tokenTech2}`)
        .set('X-Organization-Id', orgA);
      expect(after.status).toBe(403);
    },
  );
});
