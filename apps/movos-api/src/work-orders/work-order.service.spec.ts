import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { WorkOrderService } from './work-order.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  workOrder: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  workOrderEvent: { create: jest.Mock; findMany: jest.Mock };
  chargingStation: { findFirst: jest.Mock };
  membership: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    workOrder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workOrderEvent: { create: jest.fn(), findMany: jest.fn() },
    chargingStation: { findFirst: jest.fn() },
    membership: { findFirst: jest.fn() },
  };
}

function workOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wo-1',
    organizationId: 'org-1',
    stationId: 'station-1',
    title: 'Estación sin conexión: Station 1',
    description: 'Sin conexión hace 20 minutos.',
    status: 'OPEN',
    priority: 'HIGH',
    source: 'CONNECTIVITY_LOSS',
    assignedMemberId: null,
    assignedAt: null,
    startedAt: null,
    resolvedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    station: { name: 'Station 1' },
    assignedMember: null,
    ...overrides,
  };
}

describe('WorkOrderService', () => {
  let service: WorkOrderService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkOrderService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(WorkOrderService);
  });

  describe('create', () => {
    it('creates a work order and a CREATED event when the station exists', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'station-1' });
      prisma.workOrder.create.mockResolvedValue(workOrderRow());

      const result = await service.create('org-1', {
        title: 'Estación sin conexión: Station 1',
        description: 'Sin conexión hace 20 minutos.',
        priority: 'HIGH',
        source: 'CONNECTIVITY_LOSS',
        stationId: 'station-1',
        actorId: null,
      });

      expect(result.status).toBe('OPEN');
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'CREATED', actorId: null }),
        }),
      );
    });

    it('throws NotFoundException when the station does not belong to the organization', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(
        service.create('org-1', {
          title: 't',
          description: 'd',
          priority: 'MEDIUM',
          source: 'MANUAL',
          stationId: 'missing-station',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('transition', () => {
    it('throws NotFoundException for a work order that does not exist', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('org-1', 'missing', {
          transition: 'assign',
          assignedMemberId: 'user-1',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('assign moves OPEN to ASSIGNED and records assignedAt', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', assignedMemberId: 'user-2' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'assign',
        assignedMemberId: 'user-2',
        actorId: 'user-1',
      });

      expect(result.status).toBe('ASSIGNED');
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ASSIGNED',
            assignedMemberId: 'user-2',
          }),
        }),
      );
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'ASSIGNED' }),
        }),
      );
    });

    it('assign without assignedMemberId throws BadRequestException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'assign',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('assign to a user with no active membership throws BadRequestException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'assign',
          assignedMemberId: 'not-a-member',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('reassigning while ASSIGNED stays ASSIGNED and updates the assignee', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', assignedMemberId: 'user-2' }),
      );
      prisma.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', assignedMemberId: 'user-3' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'assign',
        assignedMemberId: 'user-3',
        actorId: 'user-1',
      });

      expect(result.status).toBe('ASSIGNED');
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ASSIGNED' }),
        }),
      );
    });

    it('start moves ASSIGNED to IN_PROGRESS and records startedAt', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', assignedMemberId: 'user-2' }),
      );
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'start',
        actorId: 'user-1',
      });

      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'STARTED' }),
        }),
      );
    });

    it('start is not valid directly from OPEN', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'start',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('comment requires text and updates notes', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ notes: 'Revisando en sitio.' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'comment',
        comment: 'Revisando en sitio.',
        actorId: 'user-1',
      });

      expect(result.notes).toBe('Revisando en sitio.');
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'COMMENTED' }),
        }),
      );
    });

    it('comment without text throws BadRequestException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'comment',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolve requires a note, moves IN_PROGRESS to RESOLVED, and sets resolvedAt', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS' }),
      );
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'RESOLVED', resolvedAt: new Date() }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'resolve',
        comment: 'Se reemplazó el cable del conector.',
        actorId: 'user-1',
      });

      expect(result.status).toBe('RESOLVED');
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'RESOLVED' }),
        }),
      );
    });

    it('resolve without a note throws BadRequestException', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS' }),
      );

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'resolve',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancel requires a reason and is valid from OPEN', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'CANCELLED' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'cancel',
        comment: 'Duplicada de otra orden.',
        actorId: 'user-1',
      });

      expect(result.status).toBe('CANCELLED');
    });

    it('no transition is valid from RESOLVED (terminal)', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'RESOLVED' }),
      );

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'comment',
          comment: 'demasiado tarde',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('no transition is valid from CANCELLED (terminal)', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'CANCELLED' }),
      );

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'assign',
          assignedMemberId: 'user-2',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('list', () => {
    it('scopes to the organization and filters by status when provided', async () => {
      prisma.workOrder.findMany.mockResolvedValue([workOrderRow()]);

      await service.list('org-1', 'OPEN');

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'OPEN' },
        }),
      );
    });
  });

  describe('getById', () => {
    it('throws NotFoundException when the work order does not exist in this organization', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(service.getById('org-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listEvents', () => {
    it('returns events ordered chronologically once tenant ownership is confirmed', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrderEvent.findMany.mockResolvedValue([
        { id: 'evt-1', type: 'CREATED', createdAt: new Date(), actor: null },
      ]);

      const events = await service.listEvents('org-1', 'wo-1');

      expect(events).toHaveLength(1);
      expect(prisma.workOrderEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workOrderId: 'wo-1' },
          orderBy: { createdAt: 'asc' },
        }),
      );
    });
  });
});
