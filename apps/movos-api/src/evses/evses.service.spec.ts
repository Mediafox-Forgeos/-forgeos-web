import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EvsesService, EVSE_WITH_NAMES_INCLUDE } from './evses.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  chargingStation: { findFirst: jest.Mock };
  evse: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingStation: { findFirst: jest.fn() },
    evse: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('EvsesService', () => {
  let service: EvsesService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EvsesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(EvsesService);
  });

  describe('listByChargingStation', () => {
    it('lists EVSEs after verifying the station belongs to the org', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs1' });
      prisma.evse.findMany.mockResolvedValue([]);

      await service.listByChargingStation('o1', 'cs1');

      expect(prisma.chargingStation.findFirst).toHaveBeenCalledWith({
        where: { id: 'cs1', site: { organizationId: 'o1' } },
      });
      expect(prisma.evse.findMany).toHaveBeenCalledWith({
        where: { chargingStationId: 'cs1' },
        include: EVSE_WITH_NAMES_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws NotFound when the station is not accessible (tenant isolation)', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(
        service.listByChargingStation('o1', 'cs1'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.evse.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns an EVSE owned by the organization via the full chain', async () => {
      prisma.evse.findFirst.mockResolvedValue({
        id: 'e1',
        chargingStationId: 'cs1',
      });

      const evse = await service.getById('o1', 'e1');

      expect(prisma.evse.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'e1',
          chargingStation: { site: { organizationId: 'o1' } },
        },
        include: EVSE_WITH_NAMES_INCLUDE,
      });
      expect(evse.id).toBe('e1');
    });

    it('throws NotFound for an EVSE belonging to another organization', async () => {
      prisma.evse.findFirst.mockResolvedValue(null);

      await expect(service.getById('o1', 'e1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates an EVSE under an owned station and audits', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs1' });
      prisma.evse.create.mockResolvedValue({
        id: 'e1',
        chargingStationId: 'cs1',
        externalId: '1',
      });

      const evse = await service.create('o1', 'cs1', 'u1', { externalId: '1' });

      expect(prisma.evse.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargingStationId: 'cs1',
            externalId: '1',
          }),
        }),
      );
      expect(evse.id).toBe('e1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EVSE_CREATED' }),
      );
    });

    it('cannot create an EVSE under a station inaccessible to the org', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(
        service.create('o1', 'cs1', 'u1', { externalId: '1' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.evse.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate externalId within a station to a conflict', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs1' });
      prisma.evse.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.create('o1', 'cs1', 'u1', { externalId: '1' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('applies a partial update and audits', async () => {
      prisma.evse.findFirst.mockResolvedValue({
        id: 'e1',
        chargingStationId: 'cs1',
      });
      prisma.evse.update.mockResolvedValue({ id: 'e1', status: 'AVAILABLE' });

      await service.update('o1', 'u1', 'e1', { status: 'AVAILABLE' });

      expect(prisma.evse.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { status: 'AVAILABLE' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'EVSE_UPDATED' }),
      );
    });

    it('cannot update an EVSE belonging to another organization', async () => {
      prisma.evse.findFirst.mockResolvedValue(null);

      await expect(
        service.update('o1', 'u1', 'e1', { status: 'AVAILABLE' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.evse.update).not.toHaveBeenCalled();
    });

    it('cannot be reassigned to a chargingStation in another organization', async () => {
      // UpdateEvseDto has no chargingStationId field at all, so ownership
      // reassignment across stations/organizations is impossible through
      // this API surface — the update() call site never accepts one.
      prisma.evse.findFirst.mockResolvedValue({
        id: 'e1',
        chargingStationId: 'cs1',
      });
      prisma.evse.update.mockResolvedValue({
        id: 'e1',
        chargingStationId: 'cs1',
      });

      await service.update('o1', 'u1', 'e1', { status: 'AVAILABLE' });

      const updateCall = prisma.evse.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('chargingStationId');
    });
  });
});
