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

  // DEC-022 (WO-ARGOS-015) fixtures: a second user with two ACTIVE
  // memberships, plus a third, revoked one, to exercise multi-org login,
  // explicit selection, and membership-revocation scenarios end to end.
  let orgAlphaId = '';
  let orgBetaId = '';
  let orgGammaId = '';

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

    const orgAlpha = await prisma.organization.create({
      data: { name: 'Alpha', slug: 'alpha', status: 'ACTIVE' },
    });
    const orgBeta = await prisma.organization.create({
      data: { name: 'Beta', slug: 'beta', status: 'ACTIVE' },
    });
    const orgGamma = await prisma.organization.create({
      data: { name: 'Gamma', slug: 'gamma', status: 'ACTIVE' },
    });
    orgAlphaId = orgAlpha.id;
    orgBetaId = orgBeta.id;
    orgGammaId = orgGamma.id;

    const multiOrgUser = await seedUser(prisma, {
      email: 'multi@kylum.co',
      password: 'password-123',
      displayName: 'Multi',
    });
    await prisma.membership.create({
      data: {
        userId: multiOrgUser.id,
        organizationId: orgAlphaId,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    await prisma.membership.create({
      data: {
        userId: multiOrgUser.id,
        organizationId: orgBetaId,
        role: 'VIEWER',
        status: 'ACTIVE',
      },
    });
    await prisma.membership.create({
      data: {
        userId: multiOrgUser.id,
        organizationId: orgGammaId,
        role: 'VIEWER',
        status: 'SUSPENDED',
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

  // DEC-022 (WO-ARGOS-015): "one access token = one active organization",
  // proven end to end against a real database rather than mocks.
  describe('DEC-022: organization affinity', () => {
    maybe('auto-selects the sole membership at login', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@kylum.co', password: 'password-123' });
      expect(res.status).toBe(200);
      expect(res.body.organizationId).toBe(orgId);
    });

    maybe(
      'login with multiple memberships issues a pre-selection token that cannot reach org-scoped routes',
      async () => {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'multi@kylum.co', password: 'password-123' });
        expect(login.status).toBe(200);
        expect(login.body.organizationId).toBeNull();
        expect(login.body.organizations).toHaveLength(2);

        const blocked = await request(app.getHttpServer())
          .get('/api/v1/sites')
          .set('Authorization', `Bearer ${login.body.accessToken as string}`);
        expect(blocked.status).toBe(403);
      },
    );

    maybe(
      'select-organization mints a token that can reach org-scoped routes',
      async () => {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'multi@kylum.co', password: 'password-123' });

        const selected = await request(app.getHttpServer())
          .post('/api/v1/auth/select-organization')
          .set('Authorization', `Bearer ${login.body.accessToken as string}`)
          .send({ organizationId: orgAlphaId });
        expect(selected.status).toBe(200);
        expect(selected.body.organizationId).toBe(orgAlphaId);

        const allowed = await request(app.getHttpServer())
          .get('/api/v1/sites')
          .set(
            'Authorization',
            `Bearer ${selected.body.accessToken as string}`,
          );
        expect(allowed.status).toBe(200);
      },
    );

    maybe('rejects selecting an organization with no membership', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'multi@kylum.co', password: 'password-123' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/select-organization')
        .set('Authorization', `Bearer ${login.body.accessToken as string}`)
        .send({ organizationId: orgId });
      expect(res.status).toBe(403);
    });

    maybe(
      'rejects selecting an organization with a revoked (suspended) membership',
      async () => {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'multi@kylum.co', password: 'password-123' });

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/select-organization')
          .set('Authorization', `Bearer ${login.body.accessToken as string}`)
          .send({ organizationId: orgGammaId });
        expect(res.status).toBe(403);
      },
    );

    maybe(
      'refresh preserves organization affinity when a requested organizationId is supplied',
      async () => {
        const agent = request.agent(app.getHttpServer());
        await agent
          .post('/api/v1/auth/login')
          .send({ email: 'multi@kylum.co', password: 'password-123' })
          .expect(200);

        const refreshed = await agent
          .post('/api/v1/auth/refresh')
          .send({ organizationId: orgAlphaId });
        expect(refreshed.status).toBe(200);
        expect(refreshed.body.organizationId).toBe(orgAlphaId);

        const allowed = await request(app.getHttpServer())
          .get('/api/v1/sites')
          .set(
            'Authorization',
            `Bearer ${refreshed.body.accessToken as string}`,
          );
        expect(allowed.status).toBe(200);
      },
    );

    maybe(
      'multi-tab isolation: two tabs sharing one refresh cookie each keep their own organization on refresh',
      async () => {
        const agent = request.agent(app.getHttpServer());
        await agent
          .post('/api/v1/auth/login')
          .send({ email: 'multi@kylum.co', password: 'password-123' })
          .expect(200);

        // Tab A refreshes into Alpha, Tab B refreshes into Beta — both
        // requests race against the same underlying refresh-token cookie,
        // exactly like two real browser tabs would.
        const [tabA, tabB] = await Promise.all([
          agent
            .post('/api/v1/auth/refresh')
            .send({ organizationId: orgAlphaId }),
          agent
            .post('/api/v1/auth/refresh')
            .send({ organizationId: orgBetaId }),
        ]);

        expect([tabA.status, tabB.status]).toEqual([200, 200]);
        expect(tabA.body.organizationId).toBe(orgAlphaId);
        expect(tabB.body.organizationId).toBe(orgBetaId);
        expect(tabA.body.accessToken).not.toBe(tabB.body.accessToken);
      },
    );

    maybe(
      'X-Organization-Id header has no effect on organization resolution',
      async () => {
        const login = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 'user@kylum.co', password: 'password-123' });

        const res = await request(app.getHttpServer())
          .get('/api/v1/sites')
          .set('Authorization', `Bearer ${login.body.accessToken as string}`)
          .set('X-Organization-Id', orgAlphaId);
        // The token is bound to `orgId` (single-membership org), not the
        // header's orgAlphaId — this must succeed via the token alone,
        // proving the header was never consulted.
        expect(res.status).toBe(200);
      },
    );
  });
});
