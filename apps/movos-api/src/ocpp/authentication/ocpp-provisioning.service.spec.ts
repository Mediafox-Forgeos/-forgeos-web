import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';

import { OcppProvisioningService } from './ocpp-provisioning.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';

type PrismaMock = {
  chargingStation: { findFirst: jest.Mock; update: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingStation: { findFirst: jest.fn(), update: jest.fn() },
  };
}

describe('OcppProvisioningService', () => {
  let service: OcppProvisioningService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };
  let connectionRegistry: { forceDisconnect: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    connectionRegistry = { forceDisconnect: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppProvisioningService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
        { provide: ConnectionRegistryService, useValue: connectionRegistry },
      ],
    }).compile();

    service = moduleRef.get(OcppProvisioningService);
  });

  describe('provision', () => {
    it('generates an identity and a plaintext secret, storing only the hash', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        ocppIdentity: null,
      });
      prisma.chargingStation.update.mockResolvedValue({});

      const result = await service.provision('o1', 'u1', 'cs1');

      expect(result.ocppIdentity).toMatch(/^movos-/);
      expect(result.plaintextSecret).toBeTruthy();

      const updateCall = prisma.chargingStation.update.mock.calls[0][0];
      // Test 15: the plaintext secret is never persisted — only a hash.
      expect(updateCall.data.ocppSecretHash).not.toBe(result.plaintextSecret);
      expect(updateCall.data.ocppSecretHash).toEqual(expect.any(String));
      expect(JSON.stringify(updateCall)).not.toContain(result.plaintextSecret);

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OCPP_STATION_PROVISIONED' }),
      );
      // The audit metadata carries the identity, never the secret.
      const auditCall = audit.record.mock.calls[0][0];
      expect(JSON.stringify(auditCall.metadata)).not.toContain(
        result.plaintextSecret,
      );
    });

    it('rejects re-provisioning a station that already has an identity', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        ocppIdentity: 'movos-existing',
      });

      await expect(service.provision('o1', 'u1', 'cs1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.chargingStation.update).not.toHaveBeenCalled();
    });

    // Test 16: cross-organization access remains blocked.
    it('cannot provision a station belonging to another organization', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(service.provision('o1', 'u1', 'cs1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.chargingStation.findFirst).toHaveBeenCalledWith({
        where: { id: 'cs1', site: { organizationId: 'o1' } },
      });
    });
  });

  describe('rotateSecret', () => {
    // Test 4: Secret rotation.
    it('generates a new secret distinct from any previous one and updates the hash', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        ocppIdentity: 'movos-existing',
      });
      prisma.chargingStation.update.mockResolvedValue({});

      const first = await service.rotateSecret('o1', 'u1', 'cs1');
      const second = await service.rotateSecret('o1', 'u1', 'cs1');

      expect(first.plaintextSecret).not.toEqual(second.plaintextSecret);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OCPP_SECRET_ROTATED' }),
      );
    });

    it('cannot rotate a secret for a station never provisioned', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        ocppIdentity: null,
      });

      await expect(
        service.rotateSecret('o1', 'u1', 'cs1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('revoke', () => {
    // Test 5: Secret revocation.
    it('sets ocppRevokedAt and forcibly disconnects any live connection', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        ocppIdentity: 'movos-existing',
      });
      prisma.chargingStation.update.mockResolvedValue({});

      await service.revoke('o1', 'u1', 'cs1');

      expect(prisma.chargingStation.update).toHaveBeenCalledWith({
        where: { id: 'cs1' },
        data: { ocppRevokedAt: expect.any(Date) as unknown as Date },
      });
      expect(connectionRegistry.forceDisconnect).toHaveBeenCalledWith(
        'movos-existing',
        'revoked',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'OCPP_STATION_REVOKED' }),
      );
    });
  });
});
