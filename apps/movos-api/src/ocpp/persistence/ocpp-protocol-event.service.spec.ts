import { Test } from '@nestjs/testing';
import {
  OcppMessageDirection,
  OcppMessageType,
  OcppProcessingStatus,
} from '@prisma/client';

import { OcppProtocolEventService } from './ocpp-protocol-event.service';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaMock = { ocppProtocolEvent: { create: jest.Mock } };

function createPrismaMock(): PrismaMock {
  return { ocppProtocolEvent: { create: jest.fn().mockResolvedValue({}) } };
}

describe('OcppProtocolEventService', () => {
  let service: OcppProtocolEventService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = createPrismaMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppProtocolEventService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OcppProtocolEventService);
  });

  // Test 14: Append-only raw-event persistence.
  it('writes a row for every recorded event', async () => {
    await service.record({
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      direction: OcppMessageDirection.INBOUND,
      messageType: OcppMessageType.CALL,
      action: 'Heartbeat',
      payload: { foo: 'bar' },
      processingStatus: OcppProcessingStatus.PROCESSED,
    });

    expect(prisma.ocppProtocolEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.ocppProtocolEvent.create.mock.calls[0][0].data).toMatchObject(
      {
        chargingStationId: 'cs1',
        action: 'Heartbeat',
        processingStatus: OcppProcessingStatus.PROCESSED,
      },
    );
  });

  it('redacts any secret-shaped key in the payload defensively, as a structural safety net', async () => {
    await service.record({
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      direction: OcppMessageDirection.INBOUND,
      messageType: OcppMessageType.CALL,
      payload: {
        password: 'should-never-be-stored',
        nested: { authorization: 'also-hidden' },
      },
      processingStatus: OcppProcessingStatus.PROCESSED,
    });

    const stored =
      prisma.ocppProtocolEvent.create.mock.calls[0][0].data.payload;
    expect(JSON.stringify(stored)).not.toContain('should-never-be-stored');
    expect(JSON.stringify(stored)).not.toContain('also-hidden');
  });

  it('logs but never throws when the write fails', async () => {
    prisma.ocppProtocolEvent.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.record({
        chargingStationId: null,
        protocolVersion: 'OCPP1_6J',
        direction: OcppMessageDirection.INBOUND,
        messageType: OcppMessageType.CALL,
        payload: {},
        processingStatus: OcppProcessingStatus.FAILED,
      }),
    ).resolves.toBeUndefined();
  });
});
