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

    for (const site of demoSites) {
      await prisma.site.upsert({
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
