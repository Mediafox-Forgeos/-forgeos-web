import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  OcppMessageDirection,
  OcppMessageType,
  OcppProcessingStatus,
} from '@prisma/client';

import {
  OcppProtocolEventService,
  OCPP_EVENTS_DEFAULT_LIMIT,
  OCPP_EVENTS_MAX_LIMIT,
  boundPayload,
} from './ocpp-protocol-event.service';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaMock = {
  ocppProtocolEvent: { create: jest.Mock; findMany: jest.Mock };
  chargingStation: { findFirst: jest.Mock };
};

function createPrismaMock(): PrismaMock {
  return {
    ocppProtocolEvent: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    chargingStation: { findFirst: jest.fn() },
  };
}

function eventRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    chargingStationId: 'cs-1',
    protocolVersion: 'OCPP1_6J',
    direction: 'INBOUND',
    messageType: 'CALL',
    action: 'Heartbeat',
    protocolMessageId: 'msg-1',
    payload: {},
    processingStatus: 'PROCESSED',
    processingError: null,
    correlationId: 'msg-1',
    receivedAt: new Date('2026-08-26T12:00:00.000Z'),
    ...overrides,
  };
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

  describe('listForStation', () => {
    it('throws NotFoundException — never leaks existence — for a station outside the caller org', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue(null);

      await expect(
        service.listForStation('org-1', 'cs-other-org'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.ocppProtocolEvent.findMany).not.toHaveBeenCalled();
    });

    it('re-resolves the station within the caller organization before querying events', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1');

      expect(prisma.chargingStation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cs-1', site: { organizationId: 'org-1' } },
        }),
      );
    });

    it('orders newest-first', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1');

      expect(prisma.ocppProtocolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { receivedAt: 'desc' } }),
      );
    });

    it('applies the default limit when none is given', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1');

      expect(prisma.ocppProtocolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: OCPP_EVENTS_DEFAULT_LIMIT + 1 }),
      );
    });

    it('clamps a caller-requested limit to the hard maximum', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1', { limit: 10_000 });

      expect(prisma.ocppProtocolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: OCPP_EVENTS_MAX_LIMIT + 1 }),
      );
    });

    it('applies the action filter when provided', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1', { action: 'MeterValues' });

      expect(prisma.ocppProtocolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'MeterValues' }),
        }),
      );
    });

    it('applies the direction filter when provided', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      await service.listForStation('org-1', 'cs-1', {
        direction: OcppMessageDirection.OUTBOUND,
      });

      expect(prisma.ocppProtocolEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ direction: 'OUTBOUND' }),
        }),
      );
    });

    it('returns a clean empty result for a station with no event history', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([]);

      const result = await service.listForStation('org-1', 'cs-1');

      expect(result).toEqual({ events: [], hasMore: false });
    });

    it('reports hasMore and trims the extra probe row when more events exist than the limit', async () => {
      prisma.chargingStation.findFirst.mockResolvedValue({ id: 'cs-1' });
      prisma.ocppProtocolEvent.findMany.mockResolvedValue([
        eventRow({ id: 'evt-1' }),
        eventRow({ id: 'evt-2' }),
      ]);

      const result = await service.listForStation('org-1', 'cs-1', {
        limit: 1,
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].id).toBe('evt-1');
      expect(result.hasMore).toBe(true);
    });
  });

  describe('boundPayload', () => {
    it('redacts secret-shaped keys again at read time (defense in depth)', () => {
      const result = boundPayload({
        password: 'x',
        nested: { token: 'y' },
      }) as Record<string, unknown>;

      expect(JSON.stringify(result)).not.toContain('"x"');
      expect(JSON.stringify(result)).not.toContain('"y"');
    });

    it('preserves idTag — an OCPP identifier, not a secret, per existing product policy', () => {
      const result = boundPayload({
        idTag: 'ABCD1234',
      }) as Record<string, unknown>;

      expect(result.idTag).toBe('ABCD1234');
    });

    it('truncates an oversized payload instead of returning it unbounded', () => {
      const huge = { values: 'x'.repeat(10_000) };

      const result = boundPayload(huge) as Record<string, unknown>;

      expect(result.truncated).toBe(true);
      expect(typeof result.preview).toBe('string');
      expect((result.preview as string).length).toBeLessThan(10_000);
    });

    it('never throws on a malformed/circular-shaped input', () => {
      const circular: Record<string, unknown> = { a: 1 };
      circular.self = circular;

      expect(() => boundPayload(circular)).not.toThrow();
    });
  });
});
