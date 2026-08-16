import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { WorkOrderService } from './work-order.service';
import { WorkOrderAttachmentService } from './work-order-attachment.service';
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
  membership: { findFirst: jest.Mock; findMany: jest.Mock };
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
    membership: { findFirst: jest.fn(), findMany: jest.fn() },
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
    scheduledAt: null,
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
        WorkOrderAttachmentService,
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

    it('resolve rejects a resolution summary shorter than the minimum (the "OK" pattern from PILOT-WO-01/02)', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS' }),
      );

      await expect(
        service.transition('org-1', 'wo-1', {
          transition: 'resolve',
          comment: 'OK',
          actorId: 'user-1',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.workOrder.update).not.toHaveBeenCalled();
    });

    it('resolve accepts a resolution summary right at the minimum length', async () => {
      const twentyChars = 'x'.repeat(20);
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS' }),
      );
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'RESOLVED', resolvedAt: new Date() }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'resolve',
        comment: twentyChars,
        actorId: 'user-1',
      });
      expect(result.status).toBe('RESOLVED');
    });

    it('the minimum-length rule does not apply to cancel', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'CANCELLED' }),
      );

      const result = await service.transition('org-1', 'wo-1', {
        transition: 'cancel',
        comment: 'Duplicada',
        actorId: 'user-1',
      });
      expect(result.status).toBe('CANCELLED');
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

  describe('schedule', () => {
    it('sets scheduledAt and logs a SCHEDULED event with actor attribution', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED' }),
      );
      const scheduledAt = new Date('2026-08-20T15:00:00.000Z');
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', scheduledAt }),
      );

      const result = await service.schedule(
        'org-1',
        'wo-1',
        scheduledAt,
        'user-1',
      );

      expect(result.scheduledAt).toEqual(scheduledAt);
      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { scheduledAt } }),
      );
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workOrderId: 'wo-1',
          type: 'SCHEDULED',
          actorId: 'user-1',
          payload: { scheduledAt: scheduledAt.toISOString() },
        }),
      });
    });

    it('clears scheduledAt when passed null', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', scheduledAt: new Date() }),
      );
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'ASSIGNED', scheduledAt: null }),
      );

      await service.schedule('org-1', 'wo-1', null, 'user-1');

      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { scheduledAt: null } }),
      );
    });

    it('never touches WorkOrderStatus', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'OPEN' }),
      );
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'OPEN' }),
      );

      await service.schedule('org-1', 'wo-1', new Date(), 'user-1');

      const updateCall = prisma.workOrder.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('status');
    });

    it('rejects scheduling a RESOLVED work order', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'RESOLVED' }),
      );

      await expect(
        service.schedule('org-1', 'wo-1', new Date(), 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.workOrder.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a work order outside the organization', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.schedule('org-1', 'wo-1', new Date(), 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('scopes to the organization and filters by status when provided', async () => {
      prisma.workOrder.findMany.mockResolvedValue([workOrderRow()]);

      await service.list('org-1', { status: 'OPEN' });

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'OPEN' },
        }),
      );
    });
  });

  // WO-ARGOS-051 — Requires Attention V1. Boundary cases explicitly
  // required by the approved implementation spec.
  describe('listAttentionItems', () => {
    it('queries with an OR of exactly the 4 approved rules, scoped to the org', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);

      await service.listAttentionItems('org-1');

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
            OR: expect.arrayContaining([
              expect.objectContaining({
                priority: { in: ['HIGH', 'CRITICAL'] },
              }),
              expect.objectContaining({
                status: 'OPEN',
                assignedMemberId: null,
              }),
              expect.objectContaining({ status: 'IN_PROGRESS' }),
            ]),
          }),
        }),
      );
      expect(
        (
          prisma.workOrder.findMany.mock.calls[0][0] as {
            where: { OR: unknown[] };
          }
        ).where.OR,
      ).toHaveLength(4);
    });

    it('tags a HIGH/CRITICAL unresolved work order with HIGH_PRIORITY_UNRESOLVED', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({ priority: 'CRITICAL', status: 'ASSIGNED' }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toContain('HIGH_PRIORITY_UNRESOLVED');
    });

    it('does not tag a RESOLVED/CANCELLED work order, even at CRITICAL priority', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({ priority: 'CRITICAL', status: 'RESOLVED' }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual([]);
    });

    it('tags an OPEN, unassigned work order with UNASSIGNED', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({
          priority: 'LOW',
          status: 'OPEN',
          assignedMemberId: null,
        }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual(['UNASSIGNED']);
    });

    it('tags a work order scheduled in the past (not terminal) with SCHEDULED_OVERDUE', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({
          priority: 'LOW',
          status: 'ASSIGNED',
          scheduledAt: new Date(Date.now() - 60 * 60 * 1000),
        }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual(['SCHEDULED_OVERDUE']);
    });

    it('tags an IN_PROGRESS work order started more than 4 hours ago with STALLED_IN_PROGRESS', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({
          priority: 'LOW',
          status: 'IN_PROGRESS',
          startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 - 60_000),
        }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual(['STALLED_IN_PROGRESS']);
    });

    it('does not tag an IN_PROGRESS work order started less than 4 hours ago', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({
          priority: 'LOW',
          status: 'IN_PROGRESS',
          startedAt: new Date(Date.now() - 4 * 60 * 60 * 1000 + 60_000),
        }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual([]);
    });

    it('can tag a single work order with multiple reasons at once', async () => {
      prisma.workOrder.findMany.mockResolvedValue([
        workOrderRow({
          priority: 'HIGH',
          status: 'OPEN',
          assignedMemberId: null,
        }),
      ]);

      const [item] = await service.listAttentionItems('org-1');

      expect(item.reasons).toEqual(
        expect.arrayContaining(['HIGH_PRIORITY_UNRESOLVED', 'UNASSIGNED']),
      );
    });
  });

  describe('getTechnicianWorkload', () => {
    it('returns zero counts for a roster technician with no work orders', async () => {
      prisma.membership.findMany.mockResolvedValue([
        {
          user: { id: 'tech-1', displayName: 'Ana' },
        },
      ]);
      prisma.workOrder.findMany.mockResolvedValue([]);

      const result = await service.getTechnicianWorkload('org-1');

      expect(result).toEqual([
        {
          userId: 'tech-1',
          displayName: 'Ana',
          unresolvedCount: 0,
          inProgressCount: 0,
          scheduledTodayCount: 0,
        },
      ]);
    });

    it('counts unresolved and in-progress work orders per technician independently', async () => {
      prisma.membership.findMany.mockResolvedValue([
        { user: { id: 'tech-1', displayName: 'Ana' } },
        { user: { id: 'tech-2', displayName: 'Beto' } },
      ]);
      prisma.workOrder.findMany.mockResolvedValue([
        { assignedMemberId: 'tech-1', status: 'ASSIGNED', scheduledAt: null },
        {
          assignedMemberId: 'tech-1',
          status: 'IN_PROGRESS',
          scheduledAt: null,
        },
        {
          assignedMemberId: 'tech-2',
          status: 'IN_PROGRESS',
          scheduledAt: null,
        },
      ]);

      const result = await service.getTechnicianWorkload('org-1');

      expect(result).toEqual([
        {
          userId: 'tech-1',
          displayName: 'Ana',
          unresolvedCount: 2,
          inProgressCount: 1,
          scheduledTodayCount: 0,
        },
        {
          userId: 'tech-2',
          displayName: 'Beto',
          unresolvedCount: 1,
          inProgressCount: 1,
          scheduledTodayCount: 0,
        },
      ]);
    });

    it('returns an empty list without querying work orders when there are no ACTIVE technicians', async () => {
      prisma.membership.findMany.mockResolvedValue([]);

      const result = await service.getTechnicianWorkload('org-1');

      expect(result).toEqual([]);
      expect(prisma.workOrder.findMany).not.toHaveBeenCalled();
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
