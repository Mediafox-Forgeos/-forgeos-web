import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { WorkOrderAttachmentService } from './work-order-attachment.service';
import { PrismaService } from '../prisma/prisma.service';
import type { WorkOrderWithNames } from './work-order.service';

type PrismaMock = {
  workOrderAttachment: {
    create: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  workOrderEvent: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    workOrderAttachment: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    workOrderEvent: { findFirst: jest.fn() },
  };
}

function workOrderRow(overrides: Partial<WorkOrderWithNames> = {}) {
  return {
    id: 'wo-1',
    organizationId: 'org-1',
    stationId: 'station-1',
    title: 'Estación sin conexión',
    description: 'Sin conexión hace 20 minutos.',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    source: 'MANUAL',
    assignedMemberId: 'tech-1',
    assignedAt: new Date(),
    startedAt: new Date(),
    scheduledAt: null,
    resolvedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    station: {
      name: 'Station 1',
      site: {
        name: 'Site 1',
        formattedAddress: 'Calle 1, Cali',
        address: 'Calle 1',
        latitude: 3.45,
        longitude: -76.53,
      },
    },
    assignedMember: { displayName: 'Tech One' },
    ...overrides,
  } as WorkOrderWithNames;
}

describe('WorkOrderAttachmentService', () => {
  let service: WorkOrderAttachmentService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkOrderAttachmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(WorkOrderAttachmentService);
  });

  describe('authorizeUpload', () => {
    it('rejects a disallowed MIME type', async () => {
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'application/pdf',
          fileSizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an oversized image', async () => {
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'image/jpeg',
          fileSizeBytes: 26 * 1024 * 1024, // over the 25 MB image limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an oversized video', async () => {
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'video/mp4',
          fileSizeBytes: 201 * 1024 * 1024, // over the 200 MB video limit
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-positive declared size', async () => {
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'image/jpeg',
          fileSizeBytes: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects attaching evidence to a closed work order', async () => {
      await expect(
        service.authorizeUpload(workOrderRow({ status: 'RESOLVED' }), {
          mimeType: 'image/jpeg',
          fileSizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an eventId that does not belong to this work order', async () => {
      prisma.workOrderEvent.findFirst.mockResolvedValue(null);
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'image/jpeg',
          fileSizeBytes: 1024,
          eventId: 'evt-from-another-work-order',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a valid image within an open work order', async () => {
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'image/jpeg',
          fileSizeBytes: 1024,
        }),
      ).resolves.toBeUndefined();
    });

    it('accepts a valid video with a real eventId belonging to this work order', async () => {
      prisma.workOrderEvent.findFirst.mockResolvedValue({ id: 'evt-1' });
      await expect(
        service.authorizeUpload(workOrderRow(), {
          mimeType: 'video/mp4',
          fileSizeBytes: 1024,
          eventId: 'evt-1',
        }),
      ).resolves.toBeUndefined();
      expect(prisma.workOrderEvent.findFirst).toHaveBeenCalledWith({
        where: { id: 'evt-1', workOrderId: 'wo-1' },
      });
    });
  });

  describe('createAttachment', () => {
    it('persists opaque storage identity/metadata only, never a URL', async () => {
      prisma.workOrderAttachment.create.mockResolvedValue({
        id: 'att-1',
        workOrderId: 'wo-1',
        eventId: null,
        uploadedById: 'tech-1',
        kind: 'IMAGE',
        mimeType: 'image/jpeg',
        originalFilename: 'foto.jpg',
        fileSizeBytes: 2048,
        storageProvider: 'VERCEL_BLOB',
        storagePath: 'workorders/wo-1/abc123.jpg',
        createdAt: new Date(),
        uploadedBy: { displayName: 'Tech One' },
      });

      const result = await service.createAttachment(workOrderRow(), 'tech-1', {
        storagePath: 'workorders/wo-1/abc123.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 2048,
        originalFilename: 'foto.jpg',
      });

      expect(prisma.workOrderAttachment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          uploadedById: 'tech-1',
          kind: 'IMAGE',
          storageProvider: 'VERCEL_BLOB',
          storagePath: 'workorders/wo-1/abc123.jpg',
        }),
        include: expect.anything(),
      });
      expect(result.storagePath).toBe('workorders/wo-1/abc123.jpg');
    });

    it('rejects an empty storagePath', async () => {
      await expect(
        service.createAttachment(workOrderRow(), 'tech-1', {
          storagePath: '',
          mimeType: 'image/jpeg',
          fileSizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-validates MIME/size even though authorizeUpload already ran once', async () => {
      await expect(
        service.createAttachment(workOrderRow(), 'tech-1', {
          storagePath: 'workorders/wo-1/abc123.exe',
          mimeType: 'application/octet-stream',
          fileSizeBytes: 1024,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.workOrderAttachment.create).not.toHaveBeenCalled();
    });
  });

  describe('getOne', () => {
    it('throws NotFoundException for an attachment outside this work order', async () => {
      prisma.workOrderAttachment.findFirst.mockResolvedValue(null);
      await expect(
        service.getOne('wo-1', 'att-from-elsewhere'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
