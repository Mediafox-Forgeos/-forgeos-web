import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ChargingStationsService } from './charging-stations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  site: { findFirst: jest.Mock };
  chargingStation: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    site: { findFirst: jest.fn() },
    chargingStation: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ChargingStationsService', () => {
  let service: ChargingStationsService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChargingStationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(ChargingStationsService);
  });

  describe('listBySite', () => {
    it('lists stations after verifying the site belongs to the org', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 's1' });
      prisma.chargingStation.findMany.mockResolvedValue([]);

      await service.listBySite('o1', 's1');

      expect(prisma.site.findFirst).toHaveBeenCalledWith({
        where: { id: 's1', organizationId: 'o1' },
      });
      expect(prisma.chargingStation.findMany).toHaveBeenCalledWith({
        where: { siteId: 's1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('throws NotFound when the site is not accessible (tenant isolation)', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(service.listBySite('o1', 's1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.chargingStation.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns a station owned by the organization', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        siteId: 's1',
      });

      const station = await service.getById('o1', 'cs1');

      expect(prisma.chargingStation.findFirst).toHaveBeenCalledWith({
        where: { id: 'cs1', site: { organizationId: 'o1' } },
      });
      expect(station.id).toBe('cs1');
    });

    it('throws NotFound for a station belonging to another organization', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(service.getById('o1', 'cs1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a station under an owned site and audits', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 's1' });
      prisma.chargingStation.create.mockResolvedValue({
        id: 'cs1',
        siteId: 's1',
        name: 'Estación Bogotá Centro 01',
        code: 'BOG-CTR-01',
      });

      const station = await service.create('o1', 's1', 'u1', {
        name: 'Estación Bogotá Centro 01',
        code: 'BOG-CTR-01',
      });

      expect(prisma.chargingStation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            siteId: 's1',
            name: 'Estación Bogotá Centro 01',
            code: 'BOG-CTR-01',
          }),
        }),
      );
      expect(station.id).toBe('cs1');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHARGING_STATION_CREATED' }),
      );
    });

    it('cannot create a station under a site inaccessible to the org', async () => {
      prisma.site.findFirst.mockResolvedValue(null);

      await expect(
        service.create('o1', 's1', 'u1', { name: 'X' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.chargingStation.create).not.toHaveBeenCalled();
    });

    it('maps a duplicate code within a site to a conflict', async () => {
      prisma.site.findFirst.mockResolvedValue({ id: 's1' });
      prisma.chargingStation.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.create('o1', 's1', 'u1', { name: 'X', code: 'BOG-CTR-01' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('applies a partial update and audits', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({
        id: 'cs1',
        siteId: 's1',
      });
      prisma.chargingStation.update.mockResolvedValue({
        id: 'cs1',
        status: 'ACTIVE',
      });

      await service.update('o1', 'u1', 'cs1', { status: 'ACTIVE' });

      expect(prisma.chargingStation.update).toHaveBeenCalledWith({
        where: { id: 'cs1' },
        data: { status: 'ACTIVE' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CHARGING_STATION_UPDATED' }),
      );
    });

    it('cannot update a station belonging to another organization', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(
        service.update('o1', 'u1', 'cs1', { status: 'ACTIVE' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.chargingStation.update).not.toHaveBeenCalled();
    });
  });
});
