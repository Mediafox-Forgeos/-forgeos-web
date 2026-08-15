import { Test } from '@nestjs/testing';

import { WorkOrderAutomationService } from './work-order-automation.service';
import { WorkOrderService } from './work-order.service';
import { PrismaService } from '../prisma/prisma.service';

type PrismaMock = {
  chargingStation: { findMany: jest.Mock };
  workOrder: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingStation: { findMany: jest.fn() },
    workOrder: { findFirst: jest.fn() },
  };
}

function staleStation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'station-1',
    name: 'Station 1',
    lastDisconnectedAt: new Date('2026-08-01T00:00:00.000Z'),
    site: { organizationId: 'org-1' },
    ...overrides,
  };
}

describe('WorkOrderAutomationService', () => {
  let service: WorkOrderAutomationService;
  let prisma: PrismaMock;
  let workOrders: { create: jest.Mock };

  beforeEach(async () => {
    prisma = createPrismaMock();
    workOrders = { create: jest.fn().mockResolvedValue({ id: 'wo-new' }) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkOrderAutomationService,
        { provide: PrismaService, useValue: prisma },
        { provide: WorkOrderService, useValue: workOrders },
      ],
    }).compile();
    service = moduleRef.get(WorkOrderAutomationService);
  });

  afterEach(() => {
    // The service schedules a real setInterval in its constructor —
    // release it so Jest doesn't warn about an open handle.
    service.onModuleDestroy();
  });

  it('queries only ACTIVE, OFFLINE, past-threshold stations', async () => {
    prisma.chargingStation.findMany.mockResolvedValue([]);

    await service.sweepOfflineStations();

    expect(prisma.chargingStation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          connectivityStatus: 'OFFLINE',
        }),
      }),
    );
  });

  it('creates a WorkOrder for a station with no prior CONNECTIVITY_LOSS WorkOrder', async () => {
    prisma.chargingStation.findMany.mockResolvedValue([staleStation()]);
    prisma.workOrder.findFirst.mockResolvedValue(null);

    await service.sweepOfflineStations();

    expect(workOrders.create).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        source: 'CONNECTIVITY_LOSS',
        stationId: 'station-1',
        actorId: null,
      }),
    );
  });

  it('does not create a duplicate while an OPEN WorkOrder already covers this episode', async () => {
    prisma.chargingStation.findMany.mockResolvedValue([staleStation()]);
    prisma.workOrder.findFirst.mockResolvedValue({
      id: 'wo-existing',
      status: 'OPEN',
      createdAt: new Date('2026-08-01T00:20:00.000Z'), // after lastDisconnectedAt
    });

    await service.sweepOfflineStations();

    expect(workOrders.create).not.toHaveBeenCalled();
  });

  it('THE FIX: does not create a duplicate when the covering WorkOrder was already RESOLVED', async () => {
    // This is the exact HIGH-severity bug from the checkpoint: the old
    // check filtered on status in [OPEN, ASSIGNED, IN_PROGRESS], so a
    // RESOLVED WorkOrder for the same still-offline station no longer
    // counted as "existing" and a duplicate got created. The fix compares
    // against the station's own lastDisconnectedAt instead of status.
    prisma.chargingStation.findMany.mockResolvedValue([staleStation()]);
    prisma.workOrder.findFirst.mockResolvedValue({
      id: 'wo-existing',
      status: 'RESOLVED',
      createdAt: new Date('2026-08-01T00:20:00.000Z'), // after lastDisconnectedAt
    });

    await service.sweepOfflineStations();

    expect(workOrders.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate when the covering WorkOrder was CANCELLED', async () => {
    prisma.chargingStation.findMany.mockResolvedValue([staleStation()]);
    prisma.workOrder.findFirst.mockResolvedValue({
      id: 'wo-existing',
      status: 'CANCELLED',
      createdAt: new Date('2026-08-01T00:20:00.000Z'),
    });

    await service.sweepOfflineStations();

    expect(workOrders.create).not.toHaveBeenCalled();
  });

  it('creates a new WorkOrder once the station reconnected and disconnected again', async () => {
    // The "existing" WorkOrder was created BEFORE the station's current
    // lastDisconnectedAt — meaning the station reconnected (which never
    // touches lastDisconnectedAt) and then genuinely went offline again
    // (which does). This is a new, later episode and must be eligible.
    const station = staleStation({
      lastDisconnectedAt: new Date('2026-08-05T00:00:00.000Z'),
    });
    prisma.chargingStation.findMany.mockResolvedValue([station]);
    prisma.workOrder.findFirst.mockImplementation(({ where }) => {
      // Simulate Prisma's own `createdAt: { gte }` filtering: the
      // previous episode's WorkOrder does not satisfy the new gte bound.
      const gte = where.createdAt?.gte as Date | undefined;
      const previous = {
        id: 'wo-previous-episode',
        status: 'RESOLVED',
        createdAt: new Date('2026-08-01T00:20:00.000Z'),
      };
      return Promise.resolve(
        gte && previous.createdAt >= gte ? previous : null,
      );
    });

    await service.sweepOfflineStations();

    expect(workOrders.create).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ stationId: 'station-1' }),
    );
  });

  it('one failing station does not block the rest of the sweep', async () => {
    prisma.chargingStation.findMany.mockResolvedValue([
      staleStation({ id: 'station-1' }),
      staleStation({ id: 'station-2' }),
    ]);
    prisma.workOrder.findFirst.mockResolvedValue(null);
    workOrders.create
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ id: 'wo-2' });

    await expect(service.sweepOfflineStations()).resolves.not.toThrow();
    expect(workOrders.create).toHaveBeenCalledTimes(2);
  });
});
