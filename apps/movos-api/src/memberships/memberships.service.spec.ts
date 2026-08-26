import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@prisma/client';

import { MembershipsService } from './memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
  membership: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    user: { findUnique: jest.fn() },
    membership: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
}

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const ACTOR = 'user-actor';

function membershipRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1',
    role: MemberRole.OPERATOR,
    status: MemberStatus.ACTIVE,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    user: {
      id: 'user-1',
      email: 'operador@kylumenergy.com',
      displayName: 'Operador',
    },
    ...overrides,
  };
}

describe('MembershipsService', () => {
  let service: MembershipsService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MembershipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(MembershipsService);
  });

  describe('list', () => {
    it('scopes strictly to the given organizationId', async () => {
      prisma.membership.findMany.mockResolvedValue([membershipRow()]);
      await service.list(ORG);
      expect(prisma.membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: ORG } }),
      );
    });
  });

  describe('create — adding an existing user', () => {
    it('OWNER can add a member with any role', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.membership.create.mockResolvedValue(membershipRow());

      await service.create(ORG, ACTOR, MemberRole.OWNER, {
        email: 'x@kylumenergy.com',
        role: MemberRole.ADMIN,
      });

      expect(prisma.membership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: MemberRole.ADMIN,
            status: MemberStatus.ACTIVE,
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MEMBERSHIP_CREATED' }),
      );
    });

    it('ADMIN cannot create another ADMIN', async () => {
      await expect(
        service.create(ORG, ACTOR, MemberRole.ADMIN, {
          email: 'x@kylumenergy.com',
          role: MemberRole.ADMIN,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('ADMIN cannot create an OWNER', async () => {
      await expect(
        service.create(ORG, ACTOR, MemberRole.ADMIN, {
          email: 'x@kylumenergy.com',
          role: MemberRole.OWNER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN can add an OPERATOR', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.membership.findUnique.mockResolvedValue(null);
      prisma.membership.create.mockResolvedValue(membershipRow());

      await expect(
        service.create(ORG, ACTOR, MemberRole.ADMIN, {
          email: 'x@kylumenergy.com',
          role: MemberRole.OPERATOR,
        }),
      ).resolves.toBeDefined();
    });

    it('rejects with an actionable message when no User exists for the email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.create(ORG, ACTOR, MemberRole.OWNER, {
          email: 'nadie@kylumenergy.com',
          role: MemberRole.VIEWER,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });

    it('rejects adding the same user twice', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
      prisma.membership.findUnique.mockResolvedValue(membershipRow());

      await expect(
        service.create(ORG, ACTOR, MemberRole.OWNER, {
          email: 'operador@kylumenergy.com',
          role: MemberRole.VIEWER,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membership.create).not.toHaveBeenCalled();
    });
  });

  describe('update — cross-tenant isolation', () => {
    it('a membership id belonging to another organization is treated as not found', async () => {
      prisma.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
          role: MemberRole.VIEWER,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.membership.findFirst).toHaveBeenCalledWith({
        where: { id: 'mem-1', organizationId: OTHER_ORG },
      });
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });
  });

  describe('update — role/status changes', () => {
    it('requires at least one of role/status', async () => {
      await expect(
        service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {}),
      ).rejects.toThrow(BadRequestException);
    });

    it('OWNER can change an OPERATOR to ADMIN', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OPERATOR }),
      );
      prisma.membership.update.mockResolvedValue(
        membershipRow({ role: MemberRole.ADMIN }),
      );

      await service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
        role: MemberRole.ADMIN,
      });

      expect(prisma.membership.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { role: MemberRole.ADMIN, status: MemberStatus.ACTIVE },
        }),
      );
    });

    it('ADMIN cannot modify an OWNER membership', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OWNER }),
      );

      await expect(
        service.update(ORG, ACTOR, MemberRole.ADMIN, 'mem-1', {
          status: MemberStatus.SUSPENDED,
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('ADMIN cannot promote someone to OWNER', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OPERATOR }),
      );

      await expect(
        service.update(ORG, ACTOR, MemberRole.ADMIN, 'mem-1', {
          role: MemberRole.OWNER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ADMIN can suspend an OPERATOR', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OPERATOR }),
      );
      prisma.membership.update.mockResolvedValue(
        membershipRow({ status: MemberStatus.SUSPENDED }),
      );

      await expect(
        service.update(ORG, ACTOR, MemberRole.ADMIN, 'mem-1', {
          status: MemberStatus.SUSPENDED,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('update — final OWNER invariant', () => {
    it('rejects demoting the last active OWNER', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OWNER, status: MemberStatus.ACTIVE }),
      );
      prisma.membership.count.mockResolvedValue(0);

      await expect(
        service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
          role: MemberRole.ADMIN,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.membership.update).not.toHaveBeenCalled();
    });

    it('rejects deactivating the last active OWNER (self-removal included)', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OWNER, status: MemberStatus.ACTIVE }),
      );
      prisma.membership.count.mockResolvedValue(0);

      await expect(
        service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
          status: MemberStatus.SUSPENDED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows demoting an OWNER when another active OWNER remains', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.OWNER, status: MemberStatus.ACTIVE }),
      );
      prisma.membership.count.mockResolvedValue(1);
      prisma.membership.update.mockResolvedValue(
        membershipRow({ role: MemberRole.ADMIN }),
      );

      await expect(
        service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
          role: MemberRole.ADMIN,
        }),
      ).resolves.toBeDefined();
    });

    it('does not run the owner-count check for a non-owner target', async () => {
      prisma.membership.findFirst.mockResolvedValue(
        membershipRow({ role: MemberRole.VIEWER, status: MemberStatus.ACTIVE }),
      );
      prisma.membership.update.mockResolvedValue(
        membershipRow({ status: MemberStatus.SUSPENDED }),
      );

      await service.update(ORG, ACTOR, MemberRole.OWNER, 'mem-1', {
        status: MemberStatus.SUSPENDED,
      });

      expect(prisma.membership.count).not.toHaveBeenCalled();
    });
  });
});
