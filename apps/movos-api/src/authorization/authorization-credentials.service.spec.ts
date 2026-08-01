import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthorizationCredentialsService } from './authorization-credentials.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  authorizationCredential: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    authorizationCredential: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('AuthorizationCredentialsService', () => {
  let service: AuthorizationCredentialsService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthorizationCredentialsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(AuthorizationCredentialsService);
  });

  it('creates a credential and records an audit event', async () => {
    prisma.authorizationCredential.create.mockResolvedValue({
      id: 'cred-1',
      type: 'RFID',
    });

    await service.create('org-1', 'user-1', {
      type: 'RFID' as never,
      externalIdentifier: 'ABC123',
    });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHORIZATION_CREDENTIAL_ISSUED' }),
    );
  });

  it('rejects a duplicate externalIdentifier within the same organization', async () => {
    prisma.authorizationCredential.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.create('org-1', 'user-1', {
        type: 'RFID' as never,
        externalIdentifier: 'ABC123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('revokes a credential, setting status and revokedAt, and audits it', async () => {
    prisma.authorizationCredential.findFirst.mockResolvedValue({
      id: 'cred-1',
    });
    prisma.authorizationCredential.update.mockResolvedValue({
      id: 'cred-1',
      status: 'REVOKED',
    });

    const result = await service.revoke('org-1', 'cred-1', 'user-1');

    expect(prisma.authorizationCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cred-1' },
        data: expect.objectContaining({ status: 'REVOKED' }),
      }),
    );
    expect(result.status).toBe('REVOKED');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTHORIZATION_CREDENTIAL_REVOKED' }),
    );
  });

  it('throws NotFoundException when revoking a credential outside the organization', async () => {
    prisma.authorizationCredential.findFirst.mockResolvedValue(null);

    await expect(
      service.revoke('org-1', 'cred-in-other-org', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
