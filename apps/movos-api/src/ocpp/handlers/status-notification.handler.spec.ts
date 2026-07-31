import { Test } from '@nestjs/testing';

import { StatusNotificationHandler } from './status-notification.handler';
import { PrismaService } from '../../prisma/prisma.service';
import type { NormalizedInboundEvent } from '../protocol/common/normalized-events';

type PrismaMock = {
  connector: { findFirst: jest.Mock; update: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return { connector: { findFirst: jest.fn(), update: jest.fn() } };
}

const station = { id: 'cs1' } as import('@prisma/client').ChargingStation;

describe('StatusNotificationHandler', () => {
  let handler: StatusNotificationHandler;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        StatusNotificationHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    handler = moduleRef.get(StatusNotificationHandler);
  });

  // Test 9 (domain level): StatusNotification mapping.
  it('updates the matching connector with the mapped status', async () => {
    prisma.connector.findFirst.mockResolvedValue({
      id: 'conn1',
      evseId: 'evse1',
    });
    prisma.connector.update.mockResolvedValue({});

    const event: Extract<NormalizedInboundEvent, { type: 'ConnectorStatus' }> =
      {
        type: 'ConnectorStatus',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '1',
        status: 'CHARGING',
        timestamp: '2026-07-30T00:00:00.000Z',
      };

    const result = await handler.handle(event, station);

    expect(result).toEqual({ status: 'Accepted' });
    expect(prisma.connector.findFirst).toHaveBeenCalledWith({
      where: { externalId: '1', evse: { chargingStationId: 'cs1' } },
    });
    expect(prisma.connector.update).toHaveBeenCalledWith({
      where: { id: 'conn1' },
      data: { status: 'CHARGING' },
    });
  });

  // Test 10: Invalid connector mapping.
  it('rejects a status update for a connector externalId that does not exist under this station', async () => {
    prisma.connector.findFirst.mockResolvedValue(null);

    const event: Extract<NormalizedInboundEvent, { type: 'ConnectorStatus' }> =
      {
        type: 'ConnectorStatus',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '99',
        status: 'AVAILABLE',
        timestamp: '2026-07-30T00:00:00.000Z',
      };

    const result = await handler.handle(event, station);

    expect(result).toEqual({ status: 'Rejected' });
    expect(prisma.connector.update).not.toHaveBeenCalled();
  });

  it('accepts a whole-station report (connectorId 0) as a no-op, never resolving a connector', async () => {
    const event: Extract<NormalizedInboundEvent, { type: 'ConnectorStatus' }> =
      {
        type: 'ConnectorStatus',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '0',
        status: 'AVAILABLE',
        timestamp: '2026-07-30T00:00:00.000Z',
      };

    const result = await handler.handle(event, station);

    expect(result).toEqual({ status: 'Accepted' });
    expect(prisma.connector.findFirst).not.toHaveBeenCalled();
  });
});
