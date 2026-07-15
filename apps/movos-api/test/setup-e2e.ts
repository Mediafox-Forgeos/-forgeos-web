import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Shared e2e bootstrap. Requires a reachable PostgreSQL (DATABASE_URL). Set
 * TEST_DATABASE_URL to point at an isolated test database. When no database is
 * reachable, isDatabaseAvailable() returns false so suites can skip cleanly
 * instead of failing the pipeline in environments without Docker.
 */

export function ensureTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL =
    process.env.TEST_DATABASE_URL ??
    process.env.DATABASE_URL ??
    'postgresql://movos:movos@localhost:5432/movos_test';
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-that-is-at-least-32c!';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-that-is-at-least-32c';
  process.env.JWT_ACCESS_TTL ??= '900';
  process.env.JWT_REFRESH_TTL ??= '604800';
  process.env.CORS_ORIGINS ??= 'http://localhost:3002';
  process.env.SEED_ADMIN_EMAIL ??= 'admin@kylum.co';
  process.env.SEED_ADMIN_PASSWORD ??= 'test-password-123';
}

export async function isDatabaseAvailable(): Promise<boolean> {
  ensureTestEnv();
  const client = new PrismaClient();
  try {
    await client.$connect();
    await client.$queryRawUnsafe('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await client.$disconnect();
  }
}

export async function createTestApp(): Promise<INestApplication> {
  ensureTestEnv();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.refreshSession.deleteMany();
  await prisma.site.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();
}

export async function seedUser(
  prisma: PrismaService,
  params: { email: string; password: string; displayName: string },
): Promise<{ id: string }> {
  const passwordHash = await bcrypt.hash(params.password, 8);
  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase(),
      passwordHash,
      displayName: params.displayName,
      status: 'ACTIVE',
    },
  });
  return { id: user.id };
}
