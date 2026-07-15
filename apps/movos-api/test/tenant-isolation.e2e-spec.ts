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
 * Multi-tenant isolation guarantees. These are the mandatory security tests
 * for Mission 006. They require a reachable PostgreSQL; if none is available
 * the suite is skipped (documented in MOVOS_PLATFORM_FOUNDATION.md).
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let tokenAOwner = '';
  let tokenAViewer = '';

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
  }): Promise<void> {
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
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    await createUserWithMembership({
      email: 'owner-a@kylum.co',
      organizationId: orgA,
      role: 'OWNER',
    });
    await createUserWithMembership({
      email: 'viewer-a@kylum.co',
      organizationId: orgA,
      role: 'VIEWER',
    });
    await createUserWithMembership({
      email: 'owner-b@kylum.co',
      organizationId: orgB,
      role: 'OWNER',
    });

    tokenAOwner = await login('owner-a@kylum.co', 'password-123');
    tokenAViewer = await login('viewer-a@kylum.co', 'password-123');

    // Seed one site in each org via the API (owner has ADMIN-level rights).
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'Site A1', city: 'Bogotá', address: 'Cra 1' });

    const ownerB = await login('owner-b@kylum.co', 'password-123');
    await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${ownerB}`)
      .set('X-Organization-Id', orgB)
      .send({ name: 'Site B1', city: 'Cali', address: 'Cra 9' });
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

  maybe('User A lists only org A sites', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Site A1');
  });

  maybe('User A requesting org B sites is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgB);
    expect(res.status).toBe(403);
  });

  maybe('User A with a forged org header is forbidden', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', 'org-does-not-exist');
    expect(res.status).toBe(403);
  });

  maybe('VIEWER cannot create a site', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAViewer}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'Blocked', city: 'X', address: 'Y' });
    expect(res.status).toBe(403);
  });

  maybe('OWNER/ADMIN can create a site', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'Site A2', city: 'Bogotá', address: 'Cra 2' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('site-a2');
  });

  maybe('archived sites are excluded from the list', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA)
      .send({ name: 'To Archive', city: 'Bogotá', address: 'Cra 3' });

    await request(app.getHttpServer())
      .post(`/api/v1/sites/${created.body.id}/archive`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA)
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/sites')
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    const names = (list.body as Array<{ name: string }>).map((s) => s.name);
    expect(names).not.toContain('To Archive');
  });

  maybe('a site cannot be read across organization boundaries', async () => {
    const siteB = await prisma.site.findFirst({
      where: { organizationId: orgB },
    });
    expect(siteB).not.toBeNull();

    const res = await request(app.getHttpServer())
      .get(`/api/v1/sites/${siteB!.id}`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);
    expect(res.status).toBe(404);
  });
});
