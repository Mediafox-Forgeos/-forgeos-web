import { Test } from '@nestjs/testing';

import { AuthorizationAttemptsService } from './authorization-attempts.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  authorizationCredential: { findUnique: jest.Mock };
  authorizationAttempt: { create: jest.Mock; findMany: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    authorizationCredential: { findUnique: jest.fn() },
    authorizationAttempt: { create: jest.fn(), findMany: jest.fn() },
  };
}

function credential(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cred-1',
    organizationId: 'org-1',
    type: 'RFID',
    externalIdentifier: 'ABC123',
    status: 'ACTIVE',
    expiresAt: null,
    ...overrides,
  };
}

describe('AuthorizationAttemptsService', () => {
  let service: AuthorizationAttemptsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    prisma.authorizationAttempt.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'attempt-1', ...data }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthorizationAttemptsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(AuthorizationAttemptsService);
  });

  it('resolves a valid, active credential to ACCEPTED', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(credential());

    const { attempt } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'ABC123',
    });

    expect(attempt.result).toBe('ACCEPTED');
    expect(attempt.authorizationCredentialId).toBe('cred-1');
  });

  it('resolves a revoked credential to REVOKED', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(
      credential({ status: 'REVOKED' }),
    );

    const { attempt } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'ABC123',
    });

    expect(attempt.result).toBe('REVOKED');
  });

  it('resolves an expired credential (past expiresAt) to EXPIRED', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(
      credential({ expiresAt: new Date('2020-01-01') }),
    );

    const { attempt } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'ABC123',
    });

    expect(attempt.result).toBe('EXPIRED');
  });

  it('resolves an unknown identifier (no matching credential) to UNKNOWN', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(null);

    const { attempt, credential: resolved } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'NOPE',
    });

    expect(attempt.result).toBe('UNKNOWN');
    expect(attempt.authorizationCredentialId).toBeNull();
    expect(resolved).toBeNull();
  });

  it('resolves a blocked credential to REJECTED', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(
      credential({ status: 'BLOCKED' }),
    );

    const { attempt } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'ABC123',
    });

    expect(attempt.result).toBe('REJECTED');
  });

  it('records OFFLINE_ACCEPTED instead of ACCEPTED when offline is true', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(credential());

    const { attempt } = await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'ABC123',
      offline: true,
    });

    expect(attempt.result).toBe('OFFLINE_ACCEPTED');
  });

  it('stores every attempt unconditionally, including rejections', async () => {
    prisma.authorizationCredential.findUnique.mockResolvedValue(null);

    await service.recordAttempt({
      organizationId: 'org-1',
      chargingStationId: 'cs1',
      presentedIdentifier: 'NOPE',
    });

    expect(prisma.authorizationAttempt.create).toHaveBeenCalledTimes(1);
    expect(prisma.authorizationAttempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ presentedIdentifier: 'NOPE' }),
      }),
    );
  });
});
