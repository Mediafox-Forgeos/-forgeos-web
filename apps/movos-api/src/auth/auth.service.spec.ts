import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
  let signAsync: jest.Mock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    signAsync = jest.fn().mockResolvedValue('signed.jwt.token');

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        {
          provide: JwtService,
          useValue: { signAsync },
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
    const principal = {
      id: 'u1',
      email: 'admin@kylum.co',
      displayName: 'Admin',
    };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        displayName: 'Admin',
        status: 'ACTIVE',
      });
      prisma.refreshSession.create.mockResolvedValue({});
    });

    it('issues tokens and records a success audit event', async () => {
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

      const result = await service.login(principal);

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refresh.token).toBeDefined();
      expect(result.organizations).toHaveLength(1);
      expect(result.memberships[0]).not.toHaveProperty('organization');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'LOGIN_SUCCEEDED' }),
      );
    });

    // DEC-022 (WO-ARGOS-015) Objective 2: a user with exactly one ACTIVE
    // membership is auto-selected into it at login — no separate
    // select-organization round trip needed for the common case.
    it('auto-selects and audits a single active membership', async () => {
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

      const result = await service.login(principal);

      expect(result.organizationId).toBe('o1');
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'o1' }),
        expect.anything(),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORGANIZATION_SELECTED',
          organizationId: 'o1',
          metadata: { trigger: 'auto', reason: 'single-membership-at-login' },
        }),
      );
    });

    // DEC-022 Invariant 1 / Objective 1: never guess which of several
    // memberships to bind — issue a "pre-selection" token with no orgId.
    it('issues a token with no orgId for multiple active memberships', async () => {
      prisma.membership.findMany.mockResolvedValue([
        {
          id: 'm1',
          userId: 'u1',
          organizationId: 'o1',
          role: 'OWNER',
          status: 'ACTIVE',
          organization: { id: 'o1', name: 'Alpha', slug: 'alpha' },
        },
        {
          id: 'm2',
          userId: 'u1',
          organizationId: 'o2',
          role: 'MEMBER',
          status: 'ACTIVE',
          organization: { id: 'o2', name: 'Beta', slug: 'beta' },
        },
      ]);

      const result = await service.login(principal);

      expect(result.organizationId).toBeNull();
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: undefined }),
        expect.anything(),
      );
      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORGANIZATION_SELECTED' }),
      );
    });

    it('issues a token with no orgId for zero active memberships', async () => {
      prisma.membership.findMany.mockResolvedValue([]);

      const result = await service.login(principal);

      expect(result.organizationId).toBeNull();
      expect(result.organizations).toHaveLength(0);
    });
  });

  describe('refresh', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        status: 'ACTIVE',
      });
      prisma.refreshSession.update.mockResolvedValue({});
      prisma.refreshSession.create.mockResolvedValue({});
    });

    it('rotates a valid refresh token, pointing the old session at its replacement', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });

      const result = await service.refresh('some-token');

      expect(prisma.refreshSession.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: {
          revokedAt: expect.any(Date),
          replacedByTokenHash: expect.any(String),
        },
      });
      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.refresh.token).toBeDefined();
      expect(result.organizationId).toBeNull();
    });

    // Outside REFRESH_GRACE_WINDOW_MS: a revoked token is a real replay
    // attempt (or a stale session), not a racing duplicate — hard-reject.
    it('rejects a token revoked well outside the grace window', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(Date.now() - 20_000),
        expiresAt: new Date(Date.now() + 100000),
      });
      await expect(service.refresh('some-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshSession.create).not.toHaveBeenCalled();
    });

    // DEC-022 Objective 5: absorbs the refresh-rotation race (two tabs
    // refreshing near-simultaneously against the same shared cookie) —
    // the loser gets its own fresh session instead of a spurious 401.
    it('tolerates a token revoked within the grace window as a racing duplicate', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: new Date(Date.now() - 2_000),
        expiresAt: new Date(Date.now() + 100000),
      });

      const result = await service.refresh('some-token');

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(prisma.refreshSession.create).toHaveBeenCalled();
      // The already-revoked session is not written to again.
      expect(prisma.refreshSession.update).not.toHaveBeenCalled();
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

    // DEC-022 Objective 1 / rule: "refresh must preserve organization
    // affinity" — re-validated fresh, exactly like select-organization.
    it('preserves organization affinity when the membership is still active', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'u1',
        organizationId: 'o1',
        status: 'ACTIVE',
      });

      const result = await service.refresh('some-token', {}, 'o1');

      expect(result.organizationId).toBe('o1');
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'o1' }),
        expect.anything(),
      );
    });

    // Membership revoked since the last refresh: degrade to no orgId
    // rather than failing the whole refresh — the session itself is still
    // legitimate, only that one organization is no longer available.
    it('omits orgId when the requested organization membership is no longer active', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'u1',
        organizationId: 'o1',
        status: 'SUSPENDED',
      });

      const result = await service.refresh('some-token', {}, 'o1');

      expect(result.organizationId).toBeNull();
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: undefined }),
        expect.anything(),
      );
    });

    it('omits orgId when the requested organization does not exist for the user', async () => {
      prisma.refreshSession.findUnique.mockResolvedValue({
        id: 's1',
        userId: 'u1',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      prisma.membership.findUnique.mockResolvedValue(null);

      const result = await service.refresh('some-token', {}, 'o-invalid');

      expect(result.organizationId).toBeNull();
    });
  });

  describe('selectOrganization', () => {
    // DEC-022 Invariant 4: the explicit switch. Membership is re-validated
    // fresh, a new token is minted, and the switch is audited.
    it('mints a token and audits the switch for an active membership', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'u1',
        organizationId: 'o1',
        status: 'ACTIVE',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'admin@kylum.co',
        status: 'ACTIVE',
      });

      const result = await service.selectOrganization('u1', 'o1');

      expect(result).toEqual({
        accessToken: 'signed.jwt.token',
        organizationId: 'o1',
      });
      expect(signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ orgId: 'o1' }),
        expect.anything(),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ORGANIZATION_SELECTED',
          organizationId: 'o1',
          metadata: { trigger: 'explicit' },
        }),
      );
    });

    // Unlike refresh's graceful degrade, an explicit selection of an
    // organization the user cannot access fails loudly.
    it('rejects selecting an organization with no active membership', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        service.selectOrganization('u1', 'o-invalid'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects selecting an organization with a revoked membership', async () => {
      prisma.membership.findUnique.mockResolvedValue({
        userId: 'u1',
        organizationId: 'o1',
        status: 'SUSPENDED',
      });
      await expect(
        service.selectOrganization('u1', 'o1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
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
