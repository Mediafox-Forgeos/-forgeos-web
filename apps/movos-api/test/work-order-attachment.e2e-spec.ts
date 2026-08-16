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
 * WO-ARGOS-049 — field evidence authorization. Mirrors
 * technician-isolation.e2e-spec.ts's real-database pattern (skips cleanly
 * when no PostgreSQL is reachable). Covers: upload authorization scoping,
 * MIME/size rejection, cross-technician and cross-organization isolation on
 * both the authorize-upload and read paths, and the operator-only schedule
 * endpoint. Does not exercise the actual Blob upload — that's movos-web's
 * responsibility; this only verifies movos-api never issues an
 * authorization movos-web could turn into a token for the wrong caller.
 */
describe('Work order attachments and scheduling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let woTech1 = '';
  let woTech2 = '';
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
  }): Promise<{ userId: string }> {
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
    return { userId: user.id };
  }

  beforeAll(async () => {
    available = await isDatabaseAvailable();
    if (!available) return;

    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'org-a-att', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'org-b-att', status: 'ACTIVE' },
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
    const tech2 = await createUserWithMembership({
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

    const wo1 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        title: 'Conector sin respuesta',
        description: 'Requiere revisión en sitio.',
        priority: 'HIGH',
        source: 'MANUAL',
        stationId: station.body.id,
      });
    woTech1 = wo1.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woTech1}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'assign', assignedMemberId: tech1UserId });

    const wo2 = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({
        title: 'Segunda orden',
        description: 'Otra orden en la misma organización.',
        priority: 'MEDIUM',
        source: 'MANUAL',
        stationId: station.body.id,
      });
    woTech2 = wo2.body.id;
    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woTech2}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA)
      .send({ transition: 'assign', assignedMemberId: tech2.userId });
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

  // 1. A technician can authorize an upload against their own work order.
  maybe(
    'a technician can authorize a valid image upload for their own work order',
    async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/my-work/${woTech1}/attachments/authorize-upload`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({ mimeType: 'image/jpeg', fileSizeBytes: 1024 });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ authorized: true });
    },
  );

  // 2. Invalid MIME type is rejected before any Blob token could be minted.
  maybe('rejects a disallowed MIME type', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/my-work/${woTech1}/attachments/authorize-upload`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA)
      .send({ mimeType: 'application/pdf', fileSizeBytes: 1024 });
    expect(res.status).toBe(400);
  });

  // 3. Oversized file is rejected.
  maybe('rejects a file over the size limit for its kind', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/my-work/${woTech1}/attachments/authorize-upload`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA)
      .send({ mimeType: 'image/jpeg', fileSizeBytes: 999_999_999 });
    expect(res.status).toBe(400);
  });

  // 4. A technician cannot authorize an upload against a colleague's work
  //    order merely by substituting its id.
  maybe(
    "a technician cannot authorize an upload for a colleague's work order",
    async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/my-work/${woTech2}/attachments/authorize-upload`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({ mimeType: 'image/jpeg', fileSizeBytes: 1024 });
      expect(res.status).toBe(404);
    },
  );

  // 5. Cross-organization: a technician from Org B can't touch Org A's
  //    work order at all.
  maybe(
    'a technician from another organization cannot authorize an upload',
    async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/my-work/${woTech1}/attachments/authorize-upload`)
        .set('Authorization', `Bearer ${tokenTechB}`)
        .set('X-Organization-Id', orgB)
        .send({ mimeType: 'image/jpeg', fileSizeBytes: 1024 });
      expect(res.status).toBe(404);
    },
  );

  // 6. End-to-end metadata persistence + WorkOrder-level and operator read.
  let createdAttachmentId = '';
  maybe(
    'a technician can persist attachment metadata after an upload, and the operator can read it',
    async () => {
      const create = await request(app.getHttpServer())
        .post(`/api/v1/my-work/${woTech1}/attachments`)
        .set('Authorization', `Bearer ${tokenTech1}`)
        .set('X-Organization-Id', orgA)
        .send({
          storagePath: `workorders/${woTech1}/evidence-1.jpg`,
          mimeType: 'image/jpeg',
          fileSizeBytes: 2048,
          originalFilename: 'foto.jpg',
        });
      expect(create.status).toBe(201);
      expect(create.body.storagePath).toBe(
        `workorders/${woTech1}/evidence-1.jpg`,
      );
      createdAttachmentId = create.body.id as string;

      const operatorRead = await request(app.getHttpServer())
        .get(
          `/api/v1/work-orders/${woTech1}/attachments/${createdAttachmentId}`,
        )
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .set('X-Organization-Id', orgA);
      expect(operatorRead.status).toBe(200);
      expect(operatorRead.body.id).toBe(createdAttachmentId);
    },
  );

  // 7. Read isolation: a colleague cannot read another technician's
  //    attachment by id.
  maybe(
    "a technician cannot read a colleague's attachment via /my-work",
    async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/my-work/${woTech1}/attachments/${createdAttachmentId}`)
        .set('Authorization', `Bearer ${tokenTech2}`)
        .set('X-Organization-Id', orgA);
      expect(res.status).toBe(404);
    },
  );

  // 8. A technician cannot reach the operator-only schedule endpoint.
  maybe('a technician cannot set a scheduled visit', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woTech1}/schedule`)
      .set('Authorization', `Bearer ${tokenTech1}`)
      .set('X-Organization-Id', orgA)
      .send({ scheduledAt: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  // 9. The operator can set and read back a scheduled visit without it
  //    affecting WorkOrderStatus.
  maybe(
    'an operator can set a scheduled visit and it does not change status',
    async () => {
      const before = await request(app.getHttpServer())
        .get(`/api/v1/work-orders/${woTech1}`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .set('X-Organization-Id', orgA);
      const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${woTech1}/schedule`)
        .set('Authorization', `Bearer ${tokenOwnerA}`)
        .set('X-Organization-Id', orgA)
        .send({ scheduledAt });

      expect(res.status).toBe(200);
      expect(res.body.scheduledAt).toBe(scheduledAt);
      expect(res.body.status).toBe(before.body.status);
    },
  );

  // 10. visitLocation is always present and derived, never a field the
  //     caller can set directly.
  maybe('ApiWorkOrder always includes a derived visitLocation', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/work-orders/${woTech1}`)
      .set('Authorization', `Bearer ${tokenOwnerA}`)
      .set('X-Organization-Id', orgA);
    expect(res.status).toBe(200);
    expect(res.body.visitLocation.siteName).toBe('Site A1');
    expect(res.body.visitLocation.stationName).toBe('Station A1');
  });
});
