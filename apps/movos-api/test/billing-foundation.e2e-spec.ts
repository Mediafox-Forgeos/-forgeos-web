import type { INestApplication } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../src/prisma/prisma.service';
import { SessionLifecycleService } from '../src/sessions/session-lifecycle.service';
import {
  createTestApp,
  isDatabaseAvailable,
  resetDatabase,
  seedUser,
} from './setup-e2e';

/**
 * CAP-009 (WO-ARGOS-017/017A) — BillingAccount and TariffSnapshot
 * foundation, hardened. Requires a reachable PostgreSQL; skips cleanly
 * otherwise, matching every other e2e suite in this repository.
 */
describe('Billing foundation: BillingAccount & TariffSnapshot (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let available = false;

  let orgA = '';
  let orgB = '';
  let siteA = '';
  let stationA = '';
  let evseA = '';
  let connectorA = '';
  let credentialA = '';
  let billingAccountA = '';
  let billingAccountB = '';

  async function createChargingSession(params: {
    organizationId: string;
    billingAccountId: string;
    protocolTransactionId: string;
  }) {
    return prisma.chargingSession.create({
      data: {
        organizationId: params.organizationId,
        siteId: siteA,
        chargingStationId: stationA,
        evseId: evseA,
        connectorId: connectorA,
        authorizationCredentialId: credentialA,
        billingAccountId: params.billingAccountId,
        protocolVersion: 'OCPP1_6J',
        protocolTransactionId: params.protocolTransactionId,
        status: 'COMPLETED',
        meterStart: 1000,
        meterStop: 1500,
        energyWh: 500,
        startedAt: new Date(),
        endedAt: new Date(),
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
      data: { name: 'Org A', slug: 'billing-org-a', status: 'ACTIVE' },
    });
    const b = await prisma.organization.create({
      data: { name: 'Org B', slug: 'billing-org-b', status: 'ACTIVE' },
    });
    orgA = a.id;
    orgB = b.id;

    const user = await seedUser(prisma, {
      email: 'billing-fixture@kylum.co',
      password: 'password-123',
      displayName: 'Fixture User',
    });

    const site = await prisma.site.create({
      data: {
        organizationId: orgA,
        name: 'Site A',
        slug: 'site-a',
        city: 'Bogotá',
        address: 'Cra 1',
        status: 'ACTIVE',
        createdByUserId: user.id,
      },
    });
    siteA = site.id;

    const station = await prisma.chargingStation.create({
      data: { siteId: siteA, name: 'Station A', status: 'ACTIVE' },
    });
    stationA = station.id;

    const evse = await prisma.evse.create({
      data: { chargingStationId: stationA, status: 'AVAILABLE' },
    });
    evseA = evse.id;

    const connector = await prisma.connector.create({
      data: { evseId: evseA, type: 'CCS2', status: 'AVAILABLE' },
    });
    connectorA = connector.id;

    const credential = await prisma.authorizationCredential.create({
      data: {
        organizationId: orgA,
        type: 'RFID',
        externalIdentifier: 'BILLING-TEST-CRED',
        status: 'ACTIVE',
      },
    });
    credentialA = credential.id;

    const accountA = await prisma.billingAccount.create({
      data: {
        organizationId: orgA,
        type: 'INDIVIDUAL',
        displayName: 'Billing Account A',
        currency: 'USD',
      },
    });
    billingAccountA = accountA.id;

    const accountB = await prisma.billingAccount.create({
      data: {
        organizationId: orgB,
        type: 'INDIVIDUAL',
        displayName: 'Billing Account B',
        currency: 'USD',
      },
    });
    billingAccountB = accountB.id;
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

  describe('Objective 1: every ChargingSession has exactly one BillingAccount', () => {
    maybe(
      'rejects creating a ChargingSession with no billingAccountId at the database level',
      async () => {
        await expect(
          prisma.chargingSession.create({
            data: {
              organizationId: orgA,
              siteId: siteA,
              chargingStationId: stationA,
              evseId: evseA,
              connectorId: connectorA,
              authorizationCredentialId: credentialA,
              protocolVersion: 'OCPP1_6J',
              protocolTransactionId: 'no-billing-account',
              status: 'ACTIVE',
              meterStart: 0,
              startedAt: new Date(),
              // billingAccountId intentionally omitted
            } as Prisma.ChargingSessionUncheckedCreateInput,
          }),
        ).rejects.toThrow();
      },
    );

    maybe(
      'rejects assigning a BillingAccount belonging to a different organization (tenant isolation)',
      async () => {
        await expect(
          createChargingSession({
            organizationId: orgA,
            billingAccountId: billingAccountB, // wrong org
            protocolTransactionId: 'cross-tenant-attempt',
          }),
        ).rejects.toThrow();
      },
    );

    maybe(
      'accepts a ChargingSession whose BillingAccount belongs to the same organization',
      async () => {
        const session = await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'same-tenant-ok',
        });
        expect(session.billingAccountId).toBe(billingAccountA);
      },
    );

    maybe(
      "SessionLifecycleService auto-resolves a brand-new organization's SYSTEM_DEFAULT account exactly once, even across concurrent first sessions",
      async () => {
        const freshOrg = await prisma.organization.create({
          data: {
            name: 'Fresh Org',
            slug: 'fresh-org-concurrency',
            status: 'ACTIVE',
          },
        });
        const freshSite = await prisma.site.create({
          data: {
            organizationId: freshOrg.id,
            name: 'Fresh Site',
            slug: 'fresh-site',
            city: 'Bogotá',
            address: 'Cra 1',
            status: 'ACTIVE',
            createdByUserId: (
              await seedUser(prisma, {
                email: 'fresh-org-user@kylum.co',
                password: 'password-123',
                displayName: 'Fresh Org User',
              })
            ).id,
          },
        });
        const freshStation = await prisma.chargingStation.create({
          data: {
            siteId: freshSite.id,
            name: 'Fresh Station',
            status: 'ACTIVE',
          },
        });
        const freshEvse = await prisma.evse.create({
          data: { chargingStationId: freshStation.id, status: 'AVAILABLE' },
        });
        const freshConnectorA = await prisma.connector.create({
          data: { evseId: freshEvse.id, type: 'CCS2', status: 'AVAILABLE' },
        });
        const freshConnectorB = await prisma.connector.create({
          data: { evseId: freshEvse.id, type: 'CCS2', status: 'AVAILABLE' },
        });
        const freshCredential = await prisma.authorizationCredential.create({
          data: {
            organizationId: freshOrg.id,
            type: 'RFID',
            externalIdentifier: 'FRESH-ORG-CRED',
            status: 'ACTIVE',
          },
        });

        const sessionLifecycle = app.get(SessionLifecycleService);

        const [sessionA, sessionB] = await Promise.all([
          sessionLifecycle.createSession({
            organizationId: freshOrg.id,
            siteId: freshSite.id,
            chargingStationId: freshStation.id,
            evseId: freshEvse.id,
            connectorId: freshConnectorA.id,
            authorizationCredentialId: freshCredential.id,
            protocolVersion: 'OCPP1_6J',
            meterStart: 0,
            startedAt: new Date(),
          }),
          sessionLifecycle.createSession({
            organizationId: freshOrg.id,
            siteId: freshSite.id,
            chargingStationId: freshStation.id,
            evseId: freshEvse.id,
            connectorId: freshConnectorB.id,
            authorizationCredentialId: freshCredential.id,
            protocolVersion: 'OCPP1_6J',
            meterStart: 0,
            startedAt: new Date(),
          }),
        ]);

        expect(sessionA.billingAccountId).toBeTruthy();
        expect(sessionA.billingAccountId).toBe(sessionB.billingAccountId);

        const systemDefaults = await prisma.billingAccount.findMany({
          where: { organizationId: freshOrg.id, type: 'SYSTEM_DEFAULT' },
        });
        expect(systemDefaults).toHaveLength(1);
      },
    );
  });

  describe('Objective 2: cross-snapshot currency consistency', () => {
    maybe('same-currency snapshots for one session succeed', async () => {
      const session = await createChargingSession({
        organizationId: orgA,
        billingAccountId: billingAccountA,
        protocolTransactionId: 'currency-ok',
      });

      await prisma.tariffSnapshot.create({
        data: {
          chargingSessionId: session.id,
          organizationId: orgA,
          energyPricePerKwh: '0.25',
          pricePerMinute: '0.01',
          fixedFee: '1.00',
          currency: 'USD',
          timezone: 'America/Bogota',
          effectiveAt: new Date(),
        },
      });

      const second = await prisma.tariffSnapshot.create({
        data: {
          chargingSessionId: session.id,
          organizationId: orgA,
          energyPricePerKwh: '0.30',
          pricePerMinute: '0.01',
          fixedFee: '1.00',
          currency: 'USD',
          timezone: 'America/Bogota',
          effectiveAt: new Date(),
        },
      });

      expect(second.currency).toBe('USD');
      const snapshots = await prisma.tariffSnapshot.findMany({
        where: { chargingSessionId: session.id },
      });
      expect(snapshots).toHaveLength(2);
    });

    maybe(
      'a mismatched-currency snapshot for the same session is rejected by the database trigger',
      async () => {
        const session = await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'currency-mismatch',
        });

        await prisma.tariffSnapshot.create({
          data: {
            chargingSessionId: session.id,
            organizationId: orgA,
            energyPricePerKwh: '0.25',
            pricePerMinute: '0.01',
            fixedFee: '1.00',
            currency: 'USD',
            timezone: 'America/Bogota',
            effectiveAt: new Date(),
          },
        });

        await expect(
          prisma.tariffSnapshot.create({
            data: {
              chargingSessionId: session.id,
              organizationId: orgA,
              energyPricePerKwh: '0.25',
              pricePerMinute: '0.01',
              fixedFee: '1.00',
              currency: 'COP',
              timezone: 'America/Bogota',
              effectiveAt: new Date(),
            },
          }),
        ).rejects.toThrow(/currency mismatch/i);
      },
    );

    maybe(
      'different sessions may use different currencies from each other',
      async () => {
        const sessionUsd = await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'currency-independent-usd',
        });
        const sessionCop = await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'currency-independent-cop',
        });

        await prisma.tariffSnapshot.create({
          data: {
            chargingSessionId: sessionUsd.id,
            organizationId: orgA,
            energyPricePerKwh: '0.25',
            pricePerMinute: '0.01',
            fixedFee: '1.00',
            currency: 'USD',
            timezone: 'America/Bogota',
            effectiveAt: new Date(),
          },
        });
        const copSnapshot = await prisma.tariffSnapshot.create({
          data: {
            chargingSessionId: sessionCop.id,
            organizationId: orgA,
            energyPricePerKwh: '900',
            pricePerMinute: '40',
            fixedFee: '2000',
            currency: 'COP',
            timezone: 'America/Bogota',
            effectiveAt: new Date(),
          },
        });

        expect(copSnapshot.currency).toBe('COP');
      },
    );
  });

  describe('Objective 3: archival policy', () => {
    maybe(
      'an archived BillingAccount remains linked to its historical ChargingSession',
      async () => {
        const session = await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'archival-link-check',
        });

        await prisma.billingAccount.update({
          where: { id: billingAccountA },
          data: { status: 'ARCHIVED' },
        });

        const reloaded = await prisma.chargingSession.findUniqueOrThrow({
          where: { id: session.id },
          include: { billingAccount: true },
        });
        expect(reloaded.billingAccountId).toBe(billingAccountA);
        expect(reloaded.billingAccount.status).toBe('ARCHIVED');

        // Restore for any later test relying on billingAccountA being ACTIVE.
        await prisma.billingAccount.update({
          where: { id: billingAccountA },
          data: { status: 'ACTIVE' },
        });
      },
    );

    maybe(
      'hard-deleting a BillingAccount referenced by a ChargingSession is rejected',
      async () => {
        await createChargingSession({
          organizationId: orgA,
          billingAccountId: billingAccountA,
          protocolTransactionId: 'delete-prevention-check',
        });

        await expect(
          prisma.billingAccount.delete({ where: { id: billingAccountA } }),
        ).rejects.toThrow();
      },
    );
  });
});
