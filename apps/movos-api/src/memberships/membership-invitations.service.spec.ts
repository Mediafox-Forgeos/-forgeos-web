import { Test } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { MemberRole } from '@prisma/client';

import { MembershipInvitationsService } from './membership-invitations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type TxMock = {
  membershipInvitation: { findUnique: jest.Mock; update: jest.Mock };
  user: { findUnique: jest.Mock; create: jest.Mock };
  membership: { findUnique: jest.Mock; create: jest.Mock };
};

type PrismaMock = {
  user: { findUnique: jest.Mock };
  membershipInvitation: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    findMany: jest.Mock;
  };
  organization: { findUniqueOrThrow: jest.Mock };
  $transaction: jest.Mock;
};

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const ACTOR = 'user-actor';

function invitationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1',
    organizationId: ORG,
    email: 'nueva@kylumenergy.com',
    role: MemberRole.VIEWER,
    tokenHash: 'hash-does-not-matter-for-these-assertions',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    acceptedAt: null,
    createdByUserId: ACTOR,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('MembershipInvitationsService', () => {
  let service: MembershipInvitationsService;
  let prisma: PrismaMock;
  let tx: TxMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    tx = {
      membershipInvitation: { findUnique: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn(), create: jest.fn() },
      membership: { findUnique: jest.fn(), create: jest.fn() },
    };
    prisma = {
      user: { findUnique: jest.fn() },
      membershipInvitation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      organization: { findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(async (fn: (tx: TxMock) => unknown) => fn(tx)),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MembershipInvitationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();

    service = moduleRef.get(MembershipInvitationsService);
  });

  describe('create', () => {
    it('OWNER invites a brand-new email and the plaintext token is never persisted', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.membershipInvitation.findFirst.mockResolvedValue(null);
      prisma.membershipInvitation.create.mockImplementation(({ data }) =>
        Promise.resolve(invitationRow(data)),
      );

      const { plaintextToken } = await service.create(
        ORG,
        ACTOR,
        MemberRole.OWNER,
        { email: 'Nueva@KylumEnergy.com', role: MemberRole.VIEWER },
      );

      const createCall = prisma.membershipInvitation.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('nueva@kylumenergy.com'); // normalized
      expect(createCall.data.tokenHash).not.toBe(plaintextToken);
      expect(createCall.data.tokenHash).not.toContain(plaintextToken);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MEMBERSHIP_INVITATION_CREATED' }),
      );
      // Never audit the token itself.
      const auditMetadata = audit.record.mock.calls[0][0].metadata;
      expect(JSON.stringify(auditMetadata)).not.toContain(plaintextToken);
    });

    it('ADMIN can invite an allowed (non-OWNER/ADMIN) role', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.membershipInvitation.findFirst.mockResolvedValue(null);
      prisma.membershipInvitation.create.mockResolvedValue(invitationRow());

      await expect(
        service.create(ORG, ACTOR, MemberRole.ADMIN, {
          email: 'x@kylumenergy.com',
          role: MemberRole.OPERATOR,
        }),
      ).resolves.toBeDefined();
    });

    it('ADMIN cannot invite an OWNER or ADMIN', async () => {
      await expect(
        service.create(ORG, ACTOR, MemberRole.ADMIN, {
          email: 'x@kylumenergy.com',
          role: MemberRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects inviting an email that already has a MOVOS account', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });

      await expect(
        service.create(ORG, ACTOR, MemberRole.OWNER, {
          email: 'ya-existe@kylumenergy.com',
          role: MemberRole.VIEWER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membershipInvitation.create).not.toHaveBeenCalled();
    });

    it('rejects a second pending invitation to the same email in the same org', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.membershipInvitation.findFirst.mockResolvedValue(invitationRow());

      await expect(
        service.create(ORG, ACTOR, MemberRole.OWNER, {
          email: 'nueva@kylumenergy.com',
          role: MemberRole.VIEWER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membershipInvitation.create).not.toHaveBeenCalled();
    });
  });

  describe('listPending — tenant isolation', () => {
    it('scopes strictly to the given organizationId', async () => {
      prisma.membershipInvitation.findMany.mockResolvedValue([]);
      await service.listPending(OTHER_ORG);
      expect(prisma.membershipInvitation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: OTHER_ORG }),
        }),
      );
    });
  });

  describe('preview / findValidByToken — invalid token handling', () => {
    it('a nonexistent token is rejected with the generic message', async () => {
      prisma.membershipInvitation.findUnique.mockResolvedValue(null);
      await expect(service.preview('garbage-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('an expired token is rejected identically to a nonexistent one', async () => {
      prisma.membershipInvitation.findUnique.mockResolvedValue(
        invitationRow({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.preview('expired-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('an already-accepted token is rejected identically', async () => {
      prisma.membershipInvitation.findUnique.mockResolvedValue(
        invitationRow({ acceptedAt: new Date() }),
      );
      await expect(service.preview('used-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('a valid token returns the organization name, email, and role', async () => {
      prisma.membershipInvitation.findUnique.mockResolvedValue(invitationRow());
      prisma.organization.findUniqueOrThrow.mockResolvedValue({
        name: 'Kylum Energy',
      });

      await expect(service.preview('valid-token')).resolves.toEqual({
        organizationName: 'Kylum Energy',
        email: 'nueva@kylumenergy.com',
        role: MemberRole.VIEWER,
      });
    });
  });

  describe('accept', () => {
    function mockValidInvitation(overrides: Record<string, unknown> = {}) {
      const row = invitationRow(overrides);
      prisma.membershipInvitation.findUnique.mockResolvedValue(row);
      tx.membershipInvitation.findUnique.mockResolvedValue(row);
      return row;
    }

    it('rejects when password and confirmation do not match, before touching the DB', async () => {
      await expect(
        service.accept('token', {
          displayName: 'Nueva Persona',
          password: 'password123',
          passwordConfirmation: 'different123',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membershipInvitation.findUnique).not.toHaveBeenCalled();
    });

    it('a valid token creates the User and the Membership with the invitation-controlled role, and hashes the password with the standard rounds', async () => {
      mockValidInvitation();
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 'new-user-1' });
      tx.membership.findUnique.mockResolvedValue(null);

      const result = await service.accept('valid-token', {
        displayName: '  Nueva Persona  ',
        password: 'a-real-password',
        passwordConfirmation: 'a-real-password',
      });

      expect(result).toEqual({ email: 'nueva@kylumenergy.com' });
      // bcrypt's native module can't be spied on directly (non-configurable
      // export) — verify the real behavior instead: a genuine 12-round
      // bcrypt hash (rounds are encoded in the hash string itself) that
      // actually verifies against the submitted password.
      const persistedHash: string =
        tx.user.create.mock.calls[0][0].data.passwordHash;
      expect(persistedHash).toMatch(/^\$2[aby]\$12\$/);
      await expect(
        bcrypt.compare('a-real-password', persistedHash),
      ).resolves.toBe(true);
      expect(tx.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'nueva@kylumenergy.com',
            displayName: 'Nueva Persona',
            status: 'ACTIVE',
          }),
        }),
      );
      expect(tx.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'new-user-1',
            organizationId: ORG,
            role: MemberRole.VIEWER, // from the invitation, never the request
            status: 'ACTIVE',
          }),
        }),
      );
      expect(tx.membershipInvitation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-1' },
          data: { acceptedAt: expect.any(Date) },
        }),
      );
    });

    it('an expired token is rejected before any write', async () => {
      mockValidInvitation({ expiresAt: new Date(Date.now() - 1000) });
      // findValidByToken (outside the transaction) already rejects this —
      // prisma.membershipInvitation.findUnique returns the expired row, but
      // the pre-check throws before $transaction is even entered.
      await expect(
        service.accept('expired-token', {
          displayName: 'X',
          password: 'a-real-password',
          passwordConfirmation: 'a-real-password',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('a malformed/nonexistent token is rejected honestly, not as a crash', async () => {
      prisma.membershipInvitation.findUnique.mockResolvedValue(null);
      await expect(
        service.accept('not-a-real-token', {
          displayName: 'X',
          password: 'a-real-password',
          passwordConfirmation: 'a-real-password',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('a retry after successful consumption is rejected, not silently duplicated (idempotent-safe)', async () => {
      // Outer check passes (this is the state right after a first, already
      // successful accept — but the caller retries with the same token).
      mockValidInvitation();
      // Inside the transaction, the fresh read reflects the real
      // now-accepted state — this is what actually prevents the duplicate.
      tx.membershipInvitation.findUnique.mockResolvedValue(
        invitationRow({ acceptedAt: new Date() }),
      );

      await expect(
        service.accept('already-used-token', {
          displayName: 'X',
          password: 'a-real-password',
          passwordConfirmation: 'a-real-password',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(tx.membership.create).not.toHaveBeenCalled();
      expect(tx.user.create).not.toHaveBeenCalled();
    });

    it('reuses an existing User row if one now exists for the email, instead of violating the unique email constraint', async () => {
      mockValidInvitation();
      tx.user.findUnique.mockResolvedValue({ id: 'already-exists-1' });
      tx.membership.findUnique.mockResolvedValue(null);

      await service.accept('valid-token', {
        displayName: 'Nueva Persona',
        password: 'a-real-password',
        passwordConfirmation: 'a-real-password',
      });

      expect(tx.user.create).not.toHaveBeenCalled();
      expect(tx.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'already-exists-1' }),
        }),
      );
    });

    it('rejects if a Membership for this org already exists for the resolved user', async () => {
      mockValidInvitation();
      tx.user.findUnique.mockResolvedValue({ id: 'already-exists-1' });
      tx.membership.findUnique.mockResolvedValue({ id: 'existing-membership' });

      await expect(
        service.accept('valid-token', {
          displayName: 'Nueva Persona',
          password: 'a-real-password',
          passwordConfirmation: 'a-real-password',
        }),
      ).rejects.toThrow(ConflictException);
      expect(tx.membership.create).not.toHaveBeenCalled();
    });

    it('never includes the token or the password in the acceptance audit event', async () => {
      mockValidInvitation();
      tx.user.findUnique.mockResolvedValue(null);
      tx.user.create.mockResolvedValue({ id: 'new-user-1' });
      tx.membership.findUnique.mockResolvedValue(null);

      await service.accept('valid-token', {
        displayName: 'Nueva Persona',
        password: 'a-real-password',
        passwordConfirmation: 'a-real-password',
      });

      const acceptedCall = audit.record.mock.calls.find(
        (call) => call[0].action === 'MEMBERSHIP_INVITATION_ACCEPTED',
      );
      expect(acceptedCall).toBeDefined();
      const serialized = JSON.stringify(acceptedCall[0]);
      expect(serialized).not.toContain('a-real-password');
      expect(serialized).not.toContain('valid-token');
    });
  });
});
