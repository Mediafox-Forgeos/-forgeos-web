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
 * WO-ARGOS-038 — Objective 1's assignee picker and Objective 6's mandatory
 * security validation for it. Mirrors tenant-isolation.e2e-spec.ts's
 * real-database pattern.
 */
describe('Work order assignment (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let stationA = '';
  let workOrderId = '';
  let technicianAId = '';
  let suspendedTechnicianAId = '';
  let technicianBId = '';
  let tokenOwnerA = '';
  let tokenTechA = '';

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
    status?: 'ACTIVE' | 'SUSPENDED';
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
        status: params.status ?? 'ACTIVE',
      },
    });
    return user.id;
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a-assign', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b-assign', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    await createUserWithMembership({
      email: 'owner-a@kylum.co',
      organizationId: orgA,
      role: 'OWNER',
    });
    technicianAId = await createUserWithMembership({
      email: 'tech-a@kylum.co',
      organizationId: orgA,
      role: 'TECHNICIAN',
    });
    suspendedTechnicianAId = await createUserWithMembership({
      email: 'tech-suspended-a@kylum.co',
      organizationId: orgA,
      role: 'TECHNICIAN',
      status: 'SUSPENDED',
    });
    technicianBId = await createUserWithMembership({
      email: 'tech-b@kylum.co',
      organizationId: orgB,
      role: 'TECHNICIAN',
    });

    tokenOwnerA = await login('owner-a@kylum.co', 'password-123');
    tokenTechA = await login('tech-a@kylum.co', 'password-123');

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

    const wo = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        title: 'Conector con fallas',
        description: 'Requiere revisión.',
        priority: 'MEDIUM',
        source: 'MANUAL',
        stationId: stationA,
      });
    workOrderId = wo.body.id;
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
    "the assignable-technicians list includes only ACTIVE TECHNICIAN members of the caller's own org",
    async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/work-orders/assignable-technicians')
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(200);
      const ids = (res.body as Array<{ userId: string }>).map((t) => t.userId);
      expect(ids).toContain(technicianAId);
      expect(ids).not.toContain(suspendedTechnicianAId); // inactive/revoked
      expect(ids).not.toContain(technicianBId); // different organization
    },
  );

  maybe(
    'a technician (unauthorized role) cannot list assignable technicians',
    async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/work-orders/assignable-technicians')
        .set('Authorization', `Bearer ${tokenTechA}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(403);
    },
  );

  maybe(
    'a technician (unauthorized role) cannot assign a work order at all',
    async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}`)
        .set('Authorization', `Bearer ${tokenTechA}`)
        .set('X-Organization-Id', orgA)
        .send({ transition: 'assign', assignedMemberId: technicianAId });
      expect(res.status).toBe(403);
    },
  );

  maybe('an operator can assign an eligible technician', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${workOrderId}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'assign', assignedMemberId: technicianAId });
    expect(res.status).toBe(200);
    expect(res.body.assignedMemberId).toBe(technicianAId);
    expect(res.body.status).toBe('ASSIGNED');

    const events = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${workOrderId}/events`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA);
    expect(
      (events.body as Array<{ type: string }>).some(
        (e) => e.type === 'ASSIGNED',
      ),
    ).toBe(true);
  });

  maybe(
    'organization A cannot assign a member who only belongs to organization B',
    async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .set('X-Organization-Id', orgA)
        .send({ transition: 'assign', assignedMemberId: technicianBId });
      expect(res.status).toBe(400);
    },
  );

  maybe('a suspended (inactive) member cannot be assigned', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${workOrderId}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        transition: 'assign',
        assignedMemberId: suspendedTechnicianAId,
      });
    expect(res.status).toBe(400);
  });
});
