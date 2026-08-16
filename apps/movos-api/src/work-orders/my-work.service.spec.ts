import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { MyWorkService } from './my-work.service';
import { WorkOrderService } from './work-order.service';
import { WorkOrderAttachmentService } from './work-order-attachment.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  workOrder: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  workOrderEvent: { create: jest.Mock; findMany: jest.Mock };
  chargingStation: { findUnique: jest.Mock };
  membership: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    workOrder: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    workOrderEvent: { create: jest.fn(), findMany: jest.fn() },
    chargingStation: { findUnique: jest.fn() },
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
    status: 'ASSIGNED',
    priority: 'HIGH',
    source: 'CONNECTIVITY_LOSS',
    assignedMemberId: 'tech-1',
    assignedAt: new Date(),
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
    assignedMember: { displayName: 'Tech One' },
    ...overrides,
  };
}

describe('MyWorkService', () => {
  let service: MyWorkService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MyWorkService,
        WorkOrderService,
        WorkOrderAttachmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MyWorkService);
  });

  describe('list', () => {
    it('scopes the query to the technician and their organization', async () => {
      prisma.workOrder.findMany.mockResolvedValue([workOrderRow()]);

      await service.list('org-1', 'tech-1');

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', assignedMemberId: 'tech-1' },
        }),
      );
    });

    it('adds a status filter when provided', async () => {
      prisma.workOrder.findMany.mockResolvedValue([]);

      await service.list('org-1', 'tech-1', 'IN_PROGRESS');

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: 'org-1',
            assignedMemberId: 'tech-1',
            status: 'IN_PROGRESS',
          },
        }),
      );
    });
  });

  describe('getOwnWorkOrder', () => {
    it('returns the work order when it is assigned to the technician', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      const result = await service.getOwnWorkOrder('org-1', 'tech-1', 'wo-1');

      expect(result.id).toBe('wo-1');
      expect(prisma.workOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'wo-1',
            organizationId: 'org-1',
            assignedMemberId: 'tech-1',
          },
        }),
      );
    });

    it('throws NotFoundException for a work order assigned to someone else', async () => {
      // A technician substituting another technician's id gets no row back —
      // the where clause itself excludes it, same 404 an unowned/cross-org
      // lookup gets elsewhere in this codebase.
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.getOwnWorkOrder('org-1', 'tech-1', 'someone-elses-wo'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listEvents', () => {
    it('verifies ownership before returning events', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.listEvents('org-1', 'tech-1', 'not-mine'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.workOrderEvent.findMany).not.toHaveBeenCalled();
    });

    it('returns events once ownership is confirmed', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrderEvent.findMany.mockResolvedValue([{ id: 'evt-1' }]);

      const result = await service.listEvents('org-1', 'tech-1', 'wo-1');

      expect(result).toEqual([{ id: 'evt-1' }]);
    });
  });

  describe('transition', () => {
    it('rejects a transition outside the technician-allowed set', async () => {
      await expect(
        service.transition(
          'org-1',
          'tech-1',
          'wo-1',
          'assign' as never,
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
      // Rejected before even checking ownership.
      expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
    });

    it('rejects cancel — a technician executes and closes, does not cancel', async () => {
      await expect(
        service.transition(
          'org-1',
          'tech-1',
          'wo-1',
          'cancel' as never,
          'reason',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when the work order is not assigned to this technician', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.transition('org-1', 'tech-1', 'wo-1', 'start', undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('delegates an allowed transition to WorkOrderService and returns the result', async () => {
      prisma.workOrder.findFirst
        .mockResolvedValueOnce(workOrderRow({ status: 'ASSIGNED' })) // ownership check
        .mockResolvedValueOnce(workOrderRow({ status: 'ASSIGNED' })); // WorkOrderService.transition's own lookup
      prisma.workOrder.update.mockResolvedValue(
        workOrderRow({ status: 'IN_PROGRESS', startedAt: new Date() }),
      );

      const result = await service.transition(
        'org-1',
        'tech-1',
        'wo-1',
        'start',
        undefined,
      );

      expect(result.status).toBe('IN_PROGRESS');
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'STARTED', actorId: 'tech-1' }),
        }),
      );
    });
  });

  describe('recordChecklistEvent', () => {
    it('throws NotFoundException when the work order is not assigned to this technician', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
          type: 'ARRIVAL_CONFIRMED',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects checklist events on a closed work order', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(
        workOrderRow({ status: 'RESOLVED' }),
      );

      await expect(
        service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
          type: 'ARRIVAL_CONFIRMED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records ARRIVAL_CONFIRMED with optional geolocation, no text required', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrderEvent.create.mockResolvedValue({ id: 'evt-1' });

      await service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
        type: 'ARRIVAL_CONFIRMED',
        latitude: 4.6,
        longitude: -74.1,
      });

      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'ARRIVAL_CONFIRMED',
            payload: { latitude: 4.6, longitude: -74.1, accuracy: null },
          }),
        }),
      );
    });

    it('rejects DIAGNOSIS_RECORDED without a finding', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
          type: 'DIAGNOSIS_RECORDED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records DIAGNOSIS_RECORDED with a server-computed station snapshot, never a client-supplied one', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.chargingStation.findUnique.mockResolvedValue({
        connectivityStatus: 'OFFLINE',
        evses: [{ connectors: [{ status: 'UNAVAILABLE' }] }],
      });
      prisma.workOrderEvent.create.mockResolvedValue({ id: 'evt-1' });

      await service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
        type: 'DIAGNOSIS_RECORDED',
        finding: 'Conector no reporta estado.',
        // A malicious/incorrect client-supplied snapshot must be ignored —
        // there is no field on the input type that could even carry one,
        // and the service always recomputes it from the real station.
      });

      expect(prisma.chargingStation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'station-1' } }),
      );
      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'DIAGNOSIS_RECORDED',
            payload: {
              finding: 'Conector no reporta estado.',
              stationSnapshot: {
                connectivityStatus: 'OFFLINE',
                connectorStatuses: ['UNAVAILABLE'],
              },
            },
          }),
        }),
      );
    });

    it('rejects INTERVENTION_RECORDED without a description', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
          type: 'INTERVENTION_RECORDED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records INTERVENTION_RECORDED with an optional actionType', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.workOrderEvent.create.mockResolvedValue({ id: 'evt-1' });

      await service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
        type: 'INTERVENTION_RECORDED',
        description: 'Se reinició el conector.',
        actionType: 'reset',
      });

      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: {
              description: 'Se reinició el conector.',
              actionType: 'reset',
            },
          }),
        }),
      );
    });

    it('rejects VALIDATION_RECORDED without an outcome note', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());

      await expect(
        service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
          type: 'VALIDATION_RECORDED',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('records VALIDATION_RECORDED with a second live station snapshot', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(workOrderRow());
      prisma.chargingStation.findUnique.mockResolvedValue({
        connectivityStatus: 'ONLINE',
        evses: [{ connectors: [{ status: 'AVAILABLE' }] }],
      });
      prisma.workOrderEvent.create.mockResolvedValue({ id: 'evt-1' });

      await service.recordChecklistEvent('org-1', 'tech-1', 'wo-1', {
        type: 'VALIDATION_RECORDED',
        outcomeNote: 'Conector disponible tras el reinicio.',
      });

      expect(prisma.workOrderEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            payload: {
              outcomeNote: 'Conector disponible tras el reinicio.',
              stationSnapshot: {
                connectivityStatus: 'ONLINE',
                connectorStatuses: ['AVAILABLE'],
              },
            },
          }),
        }),
      );
    });
  });
});
