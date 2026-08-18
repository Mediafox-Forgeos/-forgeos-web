import type { INestApplication } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { RemoteCommandState, RemoteCommandType } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { RemoteCommandService } from '../src/ocpp/remote-commands/remote-command.service';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';

/**
 * WO-ARGOS-059 scope item 6: "Add a dedicated cross-tenant test for command
 * execution." Real PostgreSQL, real RemoteCommandService pulled from the
 * full app's DI container — not mocked Prisma. No controller exists yet
 * for Remote Operations (deliberately, per this WO's "do not expose to
 * production operators"), so this exercises the service directly, the same
 * way the WO-058 discovery traced the ownership chain: verify a command
 * against another organization's station is rejected via the real DB
 * relation-filter (chargingStation.site.organizationId), before the live
 * OCPP connection is ever resolved. Requires a reachable PostgreSQL; skips
 * cleanly (documented, not silently) when none is available — same
 * convention as tenant-isolation.e2e-spec.ts.
 */
describe('RemoteCommand tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let remoteCommands: RemoteCommandService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let userA = '';
  let stationAId = '';
  let connectorAId = '';
  let credentialAId = '';
  let stationBId = '';

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
    remoteCommands = app.get(RemoteCommandService);
    await resetDatabase(prisma);

    const a = await prisma.organization.create({
      data: { name: 'Org A', slug: 'remote-cmd-org-a', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'remote-cmd-org-b', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    const user = await seedUser(prisma, {
      email: 'owner-a@remote-cmd.test',
      password: 'password-123',
      displayName: 'Owner A',
    });
    userA = user.id;
    await prisma.membership.create({
      data: {
        userId: userA,
        organizationId: orgA,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    // Org A's real infrastructure: Site -> ChargingStation -> Evse -> Connector.
    const siteA = await prisma.site.create({
      data: {
        organizationId: orgA,
        name: 'Site A',
        slug: 'remote-cmd-site-a',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: userA,
      },
    });
    const stationA = await prisma.chargingStation.create({
      data: {
        siteId: siteA.id,
        name: 'Station A',
        status: 'ACTIVE',
        ocppIdentity: 'movos-tenant-iso-059-a',
      },
    });
    stationAId = stationA.id;
    const evseA = await prisma.evse.create({
      data: { chargingStationId: stationAId, status: 'AVAILABLE' },
    });
    const connectorA = await prisma.connector.create({
      data: {
        evseId: evseA.id,
        externalId: '1',
        type: 'CCS2',
        status: 'AVAILABLE',
      },
    });
    connectorAId = connectorA.id;
    const credentialA = await prisma.authorizationCredential.create({
      data: {
        organizationId: orgA,
        type: 'RFID',
        externalIdentifier: 'RFID-REMOTE-CMD-059',
        status: 'ACTIVE',
      },
    });
    credentialAId = credentialA.id;

    // Org B's own station — the actual cross-tenant target these tests
    // attempt (and must fail) to reach from Org A.
    const userB = await seedUser(prisma, {
      email: 'owner-b@remote-cmd.test',
      password: 'password-123',
      displayName: 'Owner B',
    });
    await prisma.membership.create({
      data: {
        userId: userB.id,
        organizationId: orgB,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
    const siteB = await prisma.site.create({
      data: {
        organizationId: orgB,
        name: 'Site B',
        slug: 'remote-cmd-site-b',
        city: 'Cali',
        address: 'Cra 9',
        status: 'ACTIVE',
        createdByUserId: userB.id,
      },
    });
    const stationB = await prisma.chargingStation.create({
      data: {
        siteId: siteB.id,
        name: 'Station B',
        status: 'ACTIVE',
        ocppIdentity: 'movos-tenant-iso-059-b',
      },
    });
    stationBId = stationB.id;
  });

  afterAll(async () => {
    if (app) {
      await resetDatabase(prisma);
      await app.close();
    }
  });

  maybe(
    "Org A cannot target Org B's station — rejected before the live OCPP connection is ever resolved",
    async () => {
      await expect(
        remoteCommands.requestCommand({
          organizationId: orgA,
          actorUserId: userA,
          chargingStationId: stationBId, // real station, real id — just not Org A's
          connectorId: connectorAId,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(NotFoundException);

      // No RemoteCommand row was ever created for the cross-tenant attempt
      // — not "created then rejected," never created at all.
      const commands = await prisma.remoteCommand.findMany({
        where: { chargingStationId: stationBId },
      });
      expect(commands).toHaveLength(0);
    },
  );

  maybe(
    'A forged station id that belongs to no real station in the org is rejected identically',
    async () => {
      await expect(
        remoteCommands.requestCommand({
          organizationId: orgA,
          actorUserId: userA,
          chargingStationId: 'does-not-exist',
          connectorId: connectorAId,
          commandType: RemoteCommandType.REMOTE_START,
        }),
      ).rejects.toThrow(NotFoundException);
    },
  );

  maybe(
    'Org A CAN target its own real station+connector — the guard blocks cross-tenant access specifically, not everything',
    async () => {
      // Station A is not connected in this test (no live WebSocket), so
      // this resolves to REJECTED ("not online") rather than ACCEPTED —
      // the point of this test is that ownership verification succeeds and
      // the request reaches the connectivity check at all, unlike the
      // cross-tenant case above which never gets that far.
      const result = await remoteCommands.requestCommand({
        organizationId: orgA,
        actorUserId: userA,
        chargingStationId: stationAId,
        connectorId: connectorAId,
        authorizationCredentialId: credentialAId,
        commandType: RemoteCommandType.REMOTE_START,
      });

      expect(result.organizationId).toBe(orgA);
      expect(result.chargingStationId).toBe(stationAId);
      expect(result.state).toBe(RemoteCommandState.REJECTED);
      expect(result.rejectionReason).toContain('no está en línea');

      const persisted = await prisma.remoteCommand.findUnique({
        where: { id: result.id },
      });
      expect(persisted).not.toBeNull();
      expect(persisted?.organizationId).toBe(orgA);
    },
  );
});
