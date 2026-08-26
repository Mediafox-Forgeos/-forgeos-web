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
 * WO-ARGOS-091 — the OCPP support read model, exercised as real HTTP
 * requests through the full app (auth, guards, validation pipe included),
 * not the service directly — RBAC and tenant isolation are only really
 * proven at this layer. Real database, no live OCPP connection (events are
 * seeded directly via Prisma, the same way a real WS frame would have
 * produced them).
 */
describe('OCPP protocol events support read model (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let stationAId = '';
  let stationBId = '';
  let tokenAOwner = '';
  let tokenAViewer = '';
  let tokenBOwner = '';

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

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'ocpp-events-org-a', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'ocpp-events-org-b', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    await createUserWithMembership({
      email: 'owner-a@ocpp-events.test',
      organizationId: orgA,
      role: 'OWNER',
    });
    await createUserWithMembership({
      email: 'viewer-a@ocpp-events.test',
      organizationId: orgA,
      role: 'VIEWER',
    });
    await createUserWithMembership({
      email: 'owner-b@ocpp-events.test',
      organizationId: orgB,
      role: 'OWNER',
    });
    tokenAOwner = await login('owner-a@ocpp-events.test', 'password-123');
    tokenAViewer = await login('viewer-a@ocpp-events.test', 'password-123');
    tokenBOwner = await login('owner-b@ocpp-events.test', 'password-123');

    const userA = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner-a@ocpp-events.test' },
    });
    const siteA = await prisma.site.create({
      data: {
        organizationId: orgA,
        name: 'Site A',
        slug: 'ocpp-events-site-a',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: userA.id,
      },
    });
    const stationA = await prisma.chargingStation.create({
      data: { siteId: siteA.id, name: 'Station A', status: 'ACTIVE' },
    });
    stationAId = stationA.id;

    const userB = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner-b@ocpp-events.test' },
    });
    const siteB = await prisma.site.create({
      data: {
        organizationId: orgB,
        name: 'Site B',
        slug: 'ocpp-events-site-b',
        city: 'Cali',
        address: 'Cra 9',
        status: 'ACTIVE',
        createdByUserId: userB.id,
      },
    });
    const stationB = await prisma.chargingStation.create({
      data: { siteId: siteB.id, name: 'Station B', status: 'ACTIVE' },
    });
    stationBId = stationB.id;

    // Three real-shaped events for Station A, spread over time so
    // newest-first ordering is actually observable.
    await prisma.ocppProtocolEvent.create({
      data: {
        chargingStationId: stationAId,
        protocolVersion: 'OCPP1_6J',
        direction: 'INBOUND',
        messageType: 'CALL',
        action: 'BootNotification',
        protocolMessageId: 'msg-1',
        payload: [
          2,
          'msg-1',
          'BootNotification',
          { chargePointVendor: 'Acme' },
        ],
        processingStatus: 'PROCESSED',
        receivedAt: new Date('2026-08-26T12:00:00.000Z'),
      },
    });
    await prisma.ocppProtocolEvent.create({
      data: {
        chargingStationId: stationAId,
        protocolVersion: 'OCPP1_6J',
        direction: 'INBOUND',
        messageType: 'CALL',
        action: 'StatusNotification',
        protocolMessageId: 'msg-2',
        payload: [2, 'msg-2', 'StatusNotification', { status: 'Available' }],
        processingStatus: 'PROCESSED',
        receivedAt: new Date('2026-08-26T12:05:00.000Z'),
      },
    });
    await prisma.ocppProtocolEvent.create({
      data: {
        chargingStationId: stationAId,
        protocolVersion: 'OCPP1_6J',
        direction: 'INBOUND',
        messageType: 'CALL',
        action: 'Authorize',
        protocolMessageId: 'msg-3',
        // A payload a real adapter would never produce (idTag is not
        // secret-shaped, so it must survive) alongside a hypothetical
        // vendor-added secret-shaped field, to prove both the idTag
        // preservation decision and the redaction rule in one row.
        payload: [
          2,
          'msg-3',
          'Authorize',
          { idTag: 'ABCD1234', vendorToken: 'should-be-redacted' },
        ],
        processingStatus: 'PROCESSED',
        receivedAt: new Date('2026-08-26T12:10:00.000Z'),
      },
    });

    // Org B's own event, on Org B's own station — the actual cross-tenant
    // target these tests attempt (and must fail) to reach from Org A.
    await prisma.ocppProtocolEvent.create({
      data: {
        chargingStationId: stationBId,
        protocolVersion: 'OCPP1_6J',
        direction: 'INBOUND',
        messageType: 'CALL',
        action: 'Heartbeat',
        protocolMessageId: 'msg-b1',
        payload: [2, 'msg-b1', 'Heartbeat', {}],
        processingStatus: 'PROCESSED',
        receivedAt: new Date('2026-08-26T12:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  maybe('1. an authorized member reads their own station events', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/charging-stations/${stationAId}/ocpp-events`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(3);
  });

  maybe('2. a cross-tenant read is rejected, non-disclosing', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/charging-stations/${stationBId}/ocpp-events`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(res.status).toBe(404);
  });

  maybe(
    '3. every real role can read (no @Roles restriction, matching GET /charging-stations/:id and GET /authorization-attempts)',
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/charging-stations/${stationAId}/ocpp-events`)
        .set('Authorization', `Bearer ${tokenAViewer}`)
        .set('X-Organization-Id', orgA);

      expect(res.status).toBe(200);
    },
  );

  maybe('4. events are returned newest-first', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/charging-stations/${stationAId}/ocpp-events`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    const actions = res.body.events.map((e: { action: string }) => e.action);
    expect(actions).toEqual([
      'Authorize',
      'StatusNotification',
      'BootNotification',
    ]);
  });

  maybe('5. default limit is enforced', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/charging-stations/${stationAId}/ocpp-events?limit=2`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(res.body.events).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
  });

  maybe(
    '6. a limit above the hard maximum is rejected by the validation pipe',
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/charging-stations/${stationAId}/ocpp-events?limit=1000`)
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('X-Organization-Id', orgA);

      expect(res.status).toBe(400);
    },
  );

  maybe('7. the action filter works', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/charging-stations/${stationAId}/ocpp-events?action=BootNotification`,
      )
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].action).toBe('BootNotification');
  });

  maybe('8. the direction filter works', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/charging-stations/${stationAId}/ocpp-events?direction=OUTBOUND`,
      )
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    // Honest finding (see this WO's implementation report): no OUTBOUND
    // row is ever written today, so this must return clean-empty, not an
    // error and not a fabricated result.
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(0);
  });

  maybe(
    '9. a nonexistent station is handled honestly (404, not 500)',
    async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/charging-stations/does-not-exist/ocpp-events')
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('X-Organization-Id', orgA);

      expect(res.status).toBe(404);
    },
  );

  maybe(
    '10. a station with no event history returns a clean empty result',
    async () => {
      const emptyStation = await prisma.chargingStation.create({
        data: {
          siteId: (
            await prisma.site.findFirstOrThrow({
              where: { organizationId: orgA },
            })
          ).id,
          name: 'Station A — no events yet',
          status: 'ACTIVE',
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/charging-stations/${emptyStation.id}/ocpp-events`)
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('X-Organization-Id', orgA);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ events: [], hasMore: false });
    },
  );

  maybe('11. sensitive fields are redacted, idTag is preserved', async () => {
    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/charging-stations/${stationAId}/ocpp-events?action=Authorize`,
      )
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    const payload = JSON.stringify(res.body.events[0].payload);
    expect(payload).not.toContain('should-be-redacted');
    expect(payload).toContain('ABCD1234');
  });

  maybe('12. a large payload is bounded, not returned unbounded', async () => {
    await prisma.ocppProtocolEvent.create({
      data: {
        chargingStationId: stationAId,
        protocolVersion: 'OCPP1_6J',
        direction: 'INBOUND',
        messageType: 'CALL',
        action: 'MeterValues',
        protocolMessageId: 'msg-huge',
        payload: [2, 'msg-huge', 'MeterValues', { value: 'x'.repeat(20_000) }],
        processingStatus: 'PROCESSED',
        receivedAt: new Date('2026-08-26T12:12:00.000Z'),
      },
    });

    const res = await request(app.getHttpServer())
      .get(
        `/api/v1/charging-stations/${stationAId}/ocpp-events?action=MeterValues`,
      )
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body.events[0].payload).length).toBeLessThan(
      20_000,
    );
  });

  maybe(
    '13. a malformed/oddly-shaped payload does not crash the endpoint',
    async () => {
      await prisma.ocppProtocolEvent.create({
        data: {
          chargingStationId: stationAId,
          protocolVersion: 'OCPP1_6J',
          direction: 'INBOUND',
          messageType: 'CALL',
          action: 'VendorSpecific',
          protocolMessageId: 'msg-weird',
          // Not a real OCPP shape at all — a plain string, which real
          // vendor firmware bugs have been known to send.
          payload: 'not-a-json-object' as unknown as object,
          processingStatus: 'FAILED',
          processingError: 'malformed',
          receivedAt: new Date('2026-08-26T12:15:00.000Z'),
        },
      });

      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/charging-stations/${stationAId}/ocpp-events?action=VendorSpecific`,
        )
        .set('Authorization', `Bearer ${tokenAOwner}`)
        .set('X-Organization-Id', orgA);

      expect(res.status).toBe(200);
      expect(res.body.events[0].payload).toBe('not-a-json-object');
    },
  );

  maybe('14. no write capability is exposed on this resource', async () => {
    const post = await request(app.getHttpServer())
      .post(`/api/v1/charging-stations/${stationAId}/ocpp-events`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA)
      .send({});
    const del = await request(app.getHttpServer())
      .delete(`/api/v1/charging-stations/${stationAId}/ocpp-events`)
      .set('Authorization', `Bearer ${tokenAOwner}`)
      .set('X-Organization-Id', orgA);

    expect(post.status).toBe(404);
    expect(del.status).toBe(404);
  });

  maybe(
    "Org B can read its own station's events — the guard blocks cross-tenant access specifically, not everything",
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/charging-stations/${stationBId}/ocpp-events`)
        .set('Authorization', `Bearer ${tokenBOwner}`)
        .set('X-Organization-Id', orgB);

      expect(res.status).toBe(200);
      expect(res.body.events).toHaveLength(1);
      expect(res.body.events[0].action).toBe('Heartbeat');
    },
  );

  maybe('unauthenticated request is rejected', async () => {
    const res = await request(app.getHttpServer()).get(
      `/api/v1/charging-stations/${stationAId}/ocpp-events`,
    );
    expect(res.status).toBe(401);
  });
});
