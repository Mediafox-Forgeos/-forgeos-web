import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ConnectorsService } from './connectors.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  evse: { findFirst: jest.Mock };
  connector: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    evse: { findFirst: jest.fn() },
    connector: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ConnectorsService', () => {
  let service: ConnectorsService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectorsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(ConnectorsService);
  });

  describe('listByEvse', () => {
    it('lists connectors after verifying the EVSE belongs to the org', async () => {
      prisma.evse.findFirst.mockResolvedValue({ id: 'e1' });
      prisma.connector.findMany.mockResolvedValue([]);

      await service.listByEvse('o1', 'e1');

      expect(prisma.evse.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'e1',
          chargingStation: { site: { organizationId: 'o1' } },
        },
      });
      expect(prisma.connector.findMany).toHaveBeenCalledWith({
        where: { evseId: 'e1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws NotFound when the EVSE is not accessible (tenant isolation)', async () => {
      prisma.evse.findFirst.mockResolvedValue(null);

      await expect(service.listByEvse('o1', 'e1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.connector.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns a connector owned by the organization via the full chain', async () => {
      prisma.connector.findFirst.mockResolvedValue({ id: 'c1', evseId: 'e1' });

      const connector = await service.getById('o1', 'c1');

      expect(prisma.connector.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'c1',
          evse: { chargingStation: { site: { organizationId: 'o1' } } },
        },
      });
      expect(connector.id).toBe('c1');
    });

    it('throws NotFound for a connector belonging to another organization', async () => {
      prisma.connector.findFirst.mockResolvedValue(null);

      await expect(service.getById('o1', 'c1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a connector under an owned EVSE and audits', async () => {
      prisma.evse.findFirst.mockResolvedValue({ id: 'e1' });
      prisma.connector.create.mockResolvedValue({
        id: 'c1',
        evseId: 'e1',
        type: 'CCS2',
      });

      const connector = await service.create('o1', 'e1', 'u1', {
        externalId: '1',
        type: 'CCS2',
      });

      expect(prisma.connector.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ evseId: 'e1', type: 'CCS2' }),
        }),
      );
      expect(connector.id).toBe('c1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONNECTOR_CREATED' }),
      );
    });

    it('cannot create a connector under an EVSE inaccessible to the org', async () => {
      prisma.evse.findFirst.mockResolvedValue(null);

      await expect(
        service.create('o1', 'e1', 'u1', { externalId: '1', type: 'CCS2' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.connector.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate externalId within an EVSE to a conflict', async () => {
      prisma.evse.findFirst.mockResolvedValue({ id: 'e1' });
      prisma.connector.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.create('o1', 'e1', 'u1', { externalId: '1', type: 'CCS2' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('applies a partial update and audits', async () => {
      prisma.connector.findFirst.mockResolvedValue({ id: 'c1', evseId: 'e1' });
      prisma.connector.update.mockResolvedValue({
        id: 'c1',
        status: 'AVAILABLE',
      });

      await service.update('o1', 'u1', 'c1', { status: 'AVAILABLE' });

      expect(prisma.connector.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { status: 'AVAILABLE' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CONNECTOR_UPDATED' }),
      );
    });

    it('cannot update a connector belonging to another organization', async () => {
      prisma.connector.findFirst.mockResolvedValue(null);

      await expect(
        service.update('o1', 'u1', 'c1', { status: 'AVAILABLE' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.connector.update).not.toHaveBeenCalled();
    });

    it('cannot be reassigned to an EVSE in another organization', async () => {
      // UpdateConnectorDto has no evseId field, so ownership reassignment
      // across EVSEs/organizations is impossible through this API surface.
      prisma.connector.findFirst.mockResolvedValue({ id: 'c1', evseId: 'e1' });
      prisma.connector.update.mockResolvedValue({ id: 'c1', evseId: 'e1' });

      await service.update('o1', 'u1', 'c1', { status: 'AVAILABLE' });

      const updateCall = prisma.connector.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('evseId');
    });
  });
});
