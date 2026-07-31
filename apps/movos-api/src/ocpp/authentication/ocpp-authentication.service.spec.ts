import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';

import { OcppAuthenticationService } from './ocpp-authentication.service';
import { PrismaService } from '../../prisma/prisma.service';

// Real bcrypt, low cost factor for test speed — matches the convention
// already established in auth.service.spec.ts (no bcrypt mock).
const TEST_BCRYPT_ROUNDS = 4;

type PrismaMock = {
  chargingStation: { findUnique: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return { chargingStation: { findUnique: jest.fn() } };
}

describe('OcppAuthenticationService', () => {
  let service: OcppAuthenticationService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppAuthenticationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = moduleRef.get(OcppAuthenticationService);
  });

  // Test 1: Valid station authentication.
  it('authenticates a valid station with matching credentials', async () => {
    const secretHash = await bcrypt.hash('correct-secret', TEST_BCRYPT_ROUNDS);
    const station = {
      id: 'cs1',
      ocppIdentity: 'movos-abc123',
      ocppSecretHash: secretHash,
      ocppRevokedAt: null,
    };
    prisma.chargingStation.findUnique.mockResolvedValue(station);

    const result = await service.authenticate('movos-abc123', 'correct-secret');

    expect(result).toEqual({ ok: true, station });
  });

  // Test 2: Unknown station rejection.
  it('rejects an unknown ocppIdentity', async () => {
    prisma.chargingStation.findUnique.mockResolvedValue(null);

    const result = await service.authenticate('unknown-identity', 'any-secret');

    expect(result).toEqual({ ok: false, reason: 'unknown_identity' });
  });

  // Test 3: Invalid secret rejection.
  it('rejects a known station with an incorrect secret', async () => {
    const secretHash = await bcrypt.hash('correct-secret', TEST_BCRYPT_ROUNDS);
    prisma.chargingStation.findUnique.mockResolvedValue({
      id: 'cs1',
      ocppIdentity: 'movos-abc123',
      ocppSecretHash: secretHash,
      ocppRevokedAt: null,
    });

    const result = await service.authenticate('movos-abc123', 'wrong-secret');

    expect(result).toEqual({ ok: false, reason: 'invalid_credentials' });
  });

  it('rejects a revoked station even with the correct secret', async () => {
    const secretHash = await bcrypt.hash('correct-secret', TEST_BCRYPT_ROUNDS);
    prisma.chargingStation.findUnique.mockResolvedValue({
      id: 'cs1',
      ocppIdentity: 'movos-abc123',
      ocppSecretHash: secretHash,
      ocppRevokedAt: new Date(),
    });

    const result = await service.authenticate('movos-abc123', 'correct-secret');

    expect(result).toEqual({ ok: false, reason: 'revoked' });
  });

  it('rejects a station that has never been provisioned with a secret', async () => {
    prisma.chargingStation.findUnique.mockResolvedValue({
      id: 'cs1',
      ocppIdentity: 'movos-abc123',
      ocppSecretHash: null,
      ocppRevokedAt: null,
    });

    const result = await service.authenticate('movos-abc123', 'anything');

    expect(result).toEqual({ ok: false, reason: 'not_provisioned' });
  });

  describe('parseBasicAuthHeader', () => {
    it('decodes a valid Basic Auth header', () => {
      const encoded = Buffer.from('movos-abc123:s3cret').toString('base64');
      expect(
        OcppAuthenticationService.parseBasicAuthHeader(`Basic ${encoded}`),
      ).toEqual({ identity: 'movos-abc123', secret: 's3cret' });
    });

    it('returns null for a missing header', () => {
      expect(
        OcppAuthenticationService.parseBasicAuthHeader(undefined),
      ).toBeNull();
    });

    it('returns null for a non-Basic scheme', () => {
      expect(
        OcppAuthenticationService.parseBasicAuthHeader('Bearer xyz'),
      ).toBeNull();
    });

    it('returns null for a malformed Basic payload with no colon', () => {
      const encoded = Buffer.from('no-colon-here').toString('base64');
      expect(
        OcppAuthenticationService.parseBasicAuthHeader(`Basic ${encoded}`),
      ).toBeNull();
    });
  });
});
