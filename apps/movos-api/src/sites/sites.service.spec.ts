import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { SitesService } from './sites.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type PrismaMock = {
  site: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    site: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('SitesService', () => {
  let service: SitesService;
  let prisma: PrismaMock;
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    audit = { record: jest.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SitesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = moduleRef.get(SitesService);
  });

  describe('list', () => {
    it('excludes archived sites and scopes by organization', async () => {
      prisma.site.findMany.mockResolvedValue([]);
      await service.list('o1');
      expect(prisma.site.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'o1', status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getById', () => {
    it('returns a site owned by the organization', async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: 's1',
        organizationId: 'o1',
      });
      const site = await service.getById('o1', 's1');
      expect(site.id).toBe('s1');
    });

    it('throws NotFound when the site is not in the organization', async () => {
      prisma.site.findFirst.mockResolvedValue(null);
      await expect(service.getById('o1', 's1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('generates a slug, scopes the org and audits', async () => {
      prisma.site.findFirst.mockResolvedValue(null);
      prisma.site.create.mockResolvedValue({
        id: 's1',
        organizationId: 'o1',
        name: 'Bogotá Centro',
        slug: 'bogota-centro',
      });

      const site = await service.create('o1', 'u1', {
        name: 'Bogotá Centro',
        city: 'Bogotá',
        address: 'Cra 7',
      });

      expect(prisma.site.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'o1',
            createdByUserId: 'u1',
            slug: 'bogota-centro',
            status: 'DRAFT',
          }),
        }),
      );
      expect(site.slug).toBe('bogota-centro');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SITE_CREATED' }),
      );
    });

    it('appends a suffix when the slug already exists', async () => {
      prisma.site.findFirst
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);
      prisma.site.create.mockResolvedValue({
        id: 's2',
        slug: 'bogota-centro-2',
      });

      await service.create('o1', 'u1', {
        name: 'Bogotá Centro',
        city: 'Bogotá',
        address: 'Cra 7',
      });

      expect(prisma.site.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ slug: 'bogota-centro-2' }),
        }),
      );
    });

    it('maps a unique-constraint violation to a conflict', async () => {
      prisma.site.findFirst.mockResolvedValue(null);
      prisma.site.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '6.0.0',
        }),
      );

      await expect(
        service.create('o1', 'u1', {
          name: 'Bogotá Centro',
          city: 'Bogotá',
          address: 'Cra 7',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('update', () => {
    it('applies a partial update and audits', async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: 's1',
        organizationId: 'o1',
        name: 'Old',
      });
      prisma.site.update.mockResolvedValue({ id: 's1', city: 'Cali' });

      await service.update('o1', 'u1', 's1', { city: 'Cali' });

      expect(prisma.site.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { city: 'Cali' },
      });
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SITE_UPDATED' }),
      );
    });
  });

  describe('archive', () => {
    it('sets status to ARCHIVED and audits', async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: 's1',
        organizationId: 'o1',
      });
      prisma.site.update.mockResolvedValue({ id: 's1', status: 'ARCHIVED' });

      const site = await service.archive('o1', 'u1', 's1');

      expect(prisma.site.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'ARCHIVED' },
      });
      expect(site.status).toBe('ARCHIVED');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SITE_ARCHIVED' }),
      );
    });
  });
});
