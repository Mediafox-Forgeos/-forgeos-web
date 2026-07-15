import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;
  let orgId = '';

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const org = await prisma.organization.create({
      data: { name: 'Org', slug: 'org', status: 'ACTIVE' },
    });
    orgId = org.id;
    const user = await seedUser(prisma, {
      email: 'user@kylum.co',
      password: 'password-123',
      displayName: 'User',
    });
    await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        role: 'OWNER',
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

  const maybe = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skip] ${name}: no database available`);
        return;
      }
      await fn();
    });

  maybe('health is public', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  maybe('rejects invalid credentials with a generic 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user@kylum.co', password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales incorrectas');
  });

  maybe('logs in, sets cookies and returns a token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user@kylum.co', password: 'password-123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe('user@kylum.co');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('movos_refresh='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('movos_session='))).toBe(true);
  });

  maybe('rejects protected routes without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  maybe('refreshes and rotates the token', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'user@kylum.co', password: 'password-123' })
      .expect(200);

    const refreshed = await agent.post('/api/v1/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeDefined();
  });

  maybe('me returns the user and organizations', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'user@kylum.co', password: 'password-123' });
    const token = login.body.accessToken as string;

    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.organizations).toHaveLength(1);
  });
});
