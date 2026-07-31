import { Test } from '@nestjs/testing';
import { OcppProcessingStatus } from '@prisma/client';

import { OcppMessageRouterService } from './ocpp-message-router.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { OcppProtocolEventService } from '../persistence/ocpp-protocol-event.service';
import { BootNotificationHandler } from '../handlers/boot-notification.handler';
import { HeartbeatHandler } from '../handlers/heartbeat.handler';
import { StatusNotificationHandler } from '../handlers/status-notification.handler';
import { Ocpp16Adapter } from '../protocol/ocpp16/ocpp16-adapter';
import type { RawFrame } from '../protocol/common/normalized-events';

const station = {
  id: 'cs1',
  ocppIdentity: 'movos-abc123',
} as import('@prisma/client').ChargingStation;

function call(
  action: string,
  payload: Record<string, unknown>,
  messageId = 'msg-1',
): RawFrame {
  return { raw: [2, messageId, action, payload] };
}

describe('OcppMessageRouterService', () => {
  let router: OcppMessageRouterService;
  let connectionRegistry: { touch: jest.Mock };
  let protocolEvents: { record: jest.Mock };
  let bootHandler: { handle: jest.Mock };
  let heartbeatHandler: { handle: jest.Mock };
  let statusHandler: { handle: jest.Mock };
  let adapter: Ocpp16Adapter;

  beforeEach(async () => {
    connectionRegistry = { touch: jest.fn() };
    protocolEvents = { record: jest.fn().mockResolvedValue(undefined) };
    bootHandler = { handle: jest.fn().mockReturnValue({ status: 'Accepted' }) };
    heartbeatHandler = {
      handle: jest.fn().mockReturnValue({ status: 'Accepted' }),
    };
    statusHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppMessageRouterService,
        Ocpp16Adapter,
        { provide: ConnectionRegistryService, useValue: connectionRegistry },
        { provide: OcppProtocolEventService, useValue: protocolEvents },
        { provide: BootNotificationHandler, useValue: bootHandler },
        { provide: HeartbeatHandler, useValue: heartbeatHandler },
        { provide: StatusNotificationHandler, useValue: statusHandler },
      ],
    }).compile();

    router = moduleRef.get(OcppMessageRouterService);
    adapter = moduleRef.get(Ocpp16Adapter);
  });

  it('touches the connection registry on every inbound frame', async () => {
    await router.handleInboundFrame(adapter, station, call('Heartbeat', {}));
    expect(connectionRegistry.touch).toHaveBeenCalledWith('movos-abc123');
  });

  // Test 20: Domain handlers remain isolated from raw protocol DTOs.
  it('passes handlers a normalized event object, never the raw OCPP-J frame', async () => {
    await router.handleInboundFrame(
      adapter,
      station,
      call('BootNotification', {
        chargePointVendor: 'V',
        chargePointModel: 'M',
      }),
    );

    const [passedEvent] = bootHandler.handle.mock.calls[0] as [
      unknown,
      unknown,
    ];
    expect(passedEvent).toMatchObject({ type: 'DeviceBoot' });
    // The raw frame is a bare array; a NormalizedInboundEvent never is.
    expect(Array.isArray(passedEvent)).toBe(false);
    expect(passedEvent).not.toHaveProperty('0');
  });

  // Test 14: Append-only raw-event persistence — every outcome is recorded.
  it('records a protocol event for an accepted message', async () => {
    await router.handleInboundFrame(adapter, station, call('Heartbeat', {}));
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        chargingStationId: 'cs1',
        processingStatus: OcppProcessingStatus.PROCESSED,
        action: 'Heartbeat',
      }),
    );
  });

  // Test 13/12: Unsupported action -> CALLERROR, and it's recorded.
  it('returns a CALLERROR and records UNSUPPORTED for an unimplemented action', async () => {
    const response = await router.handleInboundFrame(
      adapter,
      station,
      call('Authorize', { idTag: 'ABC' }),
    );

    expect(response?.raw).toEqual([
      4,
      'msg-1',
      'NotImplemented',
      'Authorize is not implemented',
      {},
    ]);
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.UNSUPPORTED,
      }),
    );
  });

  // Test 12: CALLERROR behavior for a malformed payload.
  it('returns a CALLERROR and records FAILED for a malformed payload', async () => {
    const response = await router.handleInboundFrame(
      adapter,
      station,
      call('BootNotification', { missingRequiredFields: true }),
    );

    const raw = response?.raw as unknown[];
    expect(raw[0]).toBe(4); // CALLERROR
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.FAILED,
      }),
    );
  });

  // Test 11: Malformed frame handling at the envelope level — no response
  // is possible (no messageId), but the attempt is still logged.
  it('logs and drops a structurally invalid envelope with no messageId to respond to', async () => {
    const response = await router.handleInboundFrame(adapter, station, {
      raw: 'not an array',
    });

    expect(response).toBeNull();
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.FAILED,
      }),
    );
  });

  it('does not respond to an unexpected CALLRESULT/CALLERROR from a device', async () => {
    const response = await router.handleInboundFrame(adapter, station, {
      raw: [3, 'msg-1', {}],
    });
    expect(response).toBeNull();
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.UNSUPPORTED,
      }),
    );
  });

  it('records REJECTED when a domain handler rejects the message', async () => {
    statusHandler.handle.mockResolvedValue({ status: 'Rejected' });

    await router.handleInboundFrame(
      adapter,
      station,
      call('StatusNotification', {
        connectorId: 1,
        status: 'Available',
        timestamp: 'x',
      }),
    );

    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.REJECTED,
      }),
    );
  });
});
