import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
  membership: { findMany: jest.Mock; findUnique: jest.Mock };
  refreshSession: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    user: { findUnique: jest.fn() },
    membership: { findMany: jest.fn(), findUnique: jest.fn() },
    refreshSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

const config: Record<string, string | number> = {
  JWT_ACCESS_SECRET: 'access-secret-that-is-at-least-32-chars!!',
  JWT_REFRESH_SECRET: 'refresh-secret-that-is-at-least-32-chars!',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 604800,
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => config[key] },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('validateCredentials', () => {
    it('returns the principal for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 8);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
        passwordHash,
        status: 'ACTIVE',
      });

      const result = await service.validateCredentials(
        'Admin@Kylum.co',
        'correct-password',
      );

      expect(result).toEqual({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@kylum.co' },
      });
    });

    it('returns null for an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const result = await service.validateCredentials(
        'nobody@kylum.co',
        'whatever',
      );
      expect(result).toBeNull();
    });

    it('returns null for an invalid password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 8);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
        passwordHash,
        status: 'ACTIVE',
      });
      const result = await service.validateCredentials(
        'admin@kylum.co',
        'wrong-password',
      );
      expect(result).toBeNull();
    });

    it('returns null for a suspended user', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 8);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
        passwordHash,
        status: 'SUSPENDED',
      });
      const result = await service.validateCredentials(
        'admin@kylum.co',
        'correct-password',
      );
      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('issues tokens and records a success audit event', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
        status: 'ACTIVE',
      });
      prisma.membership.findMany.mockResolvedValue([
        {
          id: 'm1',
          userId: 'u1',
          organizationId: 'o1',
          role: 'OWNER',
          status: 'ACTIVE',
          organization: { id: 'o1', name: 'Kylum', slug: 'kylum' },
        },
      ]);
      prisma.refreshSession.create.mockResolvedValue({});

      const result = await service.login({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refresh.token).toBeDefined();
      expect(result.organizations).toHaveLength(1);
      expect(result.memberships[0]).not.toHaveProperty('organization');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCEEDED' }),
      );
    });
  });

  describe('refresh', () => {
    it('rotates a valid refresh token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        status: 'ACTIVE',
      });
      prisma.refreshSession.update.mockResolvedValue({});
      prisma.refreshSession.create.mockResolvedValue({});

      const result = await service.refresh('some-token');

      expect(prisma.refreshSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: { revokedAt: expect.any(Date) },
        }),
      );
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refresh.token).toBeDefined();
    });

    it('rejects a revoked token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(service.refresh('some-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an expired token', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('some-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects a missing token', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes the session and records an audit event', async () => {
      prisma.refreshSession.updateMany.mockResolvedValue({ count: 1 });
      await service.logout('u1', 'some-token');
      expect(prisma.refreshSession.updateMany).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGOUT' }),
      );
    });
  });
});
