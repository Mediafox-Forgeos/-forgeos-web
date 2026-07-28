import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set to run the seed.',
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const organization = await prisma.organization.upsert({
    where: { slug: 'kylum-energy' },
    update: {},
    create: {
      name: 'Kylum Energy',
      slug: 'kylum-energy',
      status: 'ACTIVE',
    },
  });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: { passwordHash, status: 'ACTIVE' },
    create: {
      email: normalizedEmail,
      passwordHash,
      displayName: 'Administrador Kylum',
      status: 'ACTIVE',
    },
  });

  await prisma.membership.upsert({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: organization.id,
      },
    },
    update: { role: 'OWNER', status: 'ACTIVE' },
    create: {
      userId: user.id,
      organizationId: organization.id,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  if (process.env.NODE_ENV === 'development') {
    const demoSites = [
      {
        slug: 'bogota-centro',
        name: 'Bogotá Centro',
        city: 'Bogotá',
        address: 'Cra 7 # 32-16',
        latitude: 4.6097,
        longitude: -74.0817,
      },
      {
        slug: 'medellin-poblado',
        name: 'Medellín El Poblado',
        city: 'Medellín',
        address: 'Cra 43A # 7-50',
        latitude: 6.2088,
        longitude: -75.5648,
      },
    ];

    let bogotaCentroSiteId: string | undefined;
    for (const site of demoSites) {
      const createdSite = await prisma.site.upsert({
        where: {
          organizationId_slug: {
            organizationId: organization.id,
            slug: site.slug,
          },
        },
        update: {},
        create: {
          organizationId: organization.id,
          createdByUserId: user.id,
          name: site.name,
          slug: site.slug,
          city: site.city,
          address: site.address,
          latitude: site.latitude,
          longitude: site.longitude,
          status: 'ACTIVE',
        },
      });
      if (site.slug === 'bogota-centro') {
        bogotaCentroSiteId = createdSite.id;
      }
    }

    // CAP-002 — one realistic ChargingStation -> EVSE -> Connector chain at
    // the Bogotá Centro site, deterministic and safe to rerun (upsert on the
    // [siteId, code] / [chargingStationId, externalId] / [evseId, externalId]
    // unique constraints, matching the Site seeding pattern above).
    if (bogotaCentroSiteId) {
      const station = await prisma.chargingStation.upsert({
        where: {
          siteId_code: { siteId: bogotaCentroSiteId, code: 'BOG-CTR-01' },
        },
        update: {},
        create: {
          siteId: bogotaCentroSiteId,
          name: 'Estación Bogotá Centro 01',
          code: 'BOG-CTR-01',
          manufacturer: 'Kempower',
          model: 'Satellite 400',
          serialNumber: 'KMP-400-0001',
          protocol: 'OCPP 1.6J',
          status: 'ACTIVE',
          commissionedAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      });

      const evse = await prisma.evse.upsert({
        where: {
          chargingStationId_externalId: {
            chargingStationId: station.id,
            externalId: '1',
          },
        },
        update: {},
        create: {
          chargingStationId: station.id,
          externalId: '1',
          name: 'EVSE 1',
          status: 'AVAILABLE',
          maxPowerKw: 180,
          currentType: 'DC',
        },
      });

      await prisma.connector.upsert({
        where: {
          evseId_externalId: { evseId: evse.id, externalId: '1' },
        },
        update: {},
        create: {
          evseId: evse.id,
          externalId: '1',
          type: 'CCS2',
          status: 'AVAILABLE',
          maxPowerKw: 180,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `Seed complete: organization=${organization.slug} owner=${normalizedEmail}`,
  );
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
