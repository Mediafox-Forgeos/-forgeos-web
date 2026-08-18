import { Test } from '@nestjs/testing';
import { OcppProcessingStatus } from '@prisma/client';

import { OcppMessageRouterService } from './ocpp-message-router.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { PendingCallRegistryService } from '../outbound/pending-call-registry.service';
import { OcppProtocolEventService } from '../persistence/ocpp-protocol-event.service';
import { BootNotificationHandler } from '../handlers/boot-notification.handler';
import { HeartbeatHandler } from '../handlers/heartbeat.handler';
import { StatusNotificationHandler } from '../handlers/status-notification.handler';
import { AuthorizationHandler } from '../handlers/authorization.handler';
import { TransactionStartHandler } from '../handlers/transaction-start.handler';
import { TransactionUpdateHandler } from '../handlers/transaction-update.handler';
import { TransactionEndHandler } from '../handlers/transaction-end.handler';
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
  let pendingCalls: { has: jest.Mock; resolve: jest.Mock };
  let protocolEvents: { record: jest.Mock };
  let bootHandler: { handle: jest.Mock };
  let heartbeatHandler: { handle: jest.Mock };
  let statusHandler: { handle: jest.Mock };
  let authorizationHandler: { handle: jest.Mock };
  let transactionStartHandler: { handle: jest.Mock };
  let transactionUpdateHandler: { handle: jest.Mock };
  let transactionEndHandler: { handle: jest.Mock };
  let adapter: Ocpp16Adapter;

  beforeEach(async () => {
    connectionRegistry = { touch: jest.fn() };
    pendingCalls = {
      has: jest.fn().mockReturnValue(false),
      resolve: jest.fn(),
    };
    protocolEvents = { record: jest.fn().mockResolvedValue(undefined) };
    bootHandler = { handle: jest.fn().mockReturnValue({ status: 'Accepted' }) };
    heartbeatHandler = {
      handle: jest.fn().mockReturnValue({ status: 'Accepted' }),
    };
    statusHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };
    authorizationHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };
    transactionStartHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };
    transactionUpdateHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };
    transactionEndHandler = {
      handle: jest.fn().mockResolvedValue({ status: 'Accepted' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OcppMessageRouterService,
        Ocpp16Adapter,
        { provide: ConnectionRegistryService, useValue: connectionRegistry },
        { provide: PendingCallRegistryService, useValue: pendingCalls },
        { provide: OcppProtocolEventService, useValue: protocolEvents },
        { provide: BootNotificationHandler, useValue: bootHandler },
        { provide: HeartbeatHandler, useValue: heartbeatHandler },
        { provide: StatusNotificationHandler, useValue: statusHandler },
        { provide: AuthorizationHandler, useValue: authorizationHandler },
        {
          provide: TransactionStartHandler,
          useValue: transactionStartHandler,
        },
        {
          provide: TransactionUpdateHandler,
          useValue: transactionUpdateHandler,
        },
        { provide: TransactionEndHandler, useValue: transactionEndHandler },
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
  // RemoteStartTransaction remains unimplemented even after CAP-004
  // (WO-ARGOS-009), which implemented Authorize/StartTransaction/
  // MeterValues/StopTransaction — see the `it.each` block below for those.
  it('returns a CALLERROR and records UNSUPPORTED for an unimplemented action', async () => {
    const response = await router.handleInboundFrame(
      adapter,
      station,
      call('RemoteStartTransaction', { idTag: 'ABC' }),
    );

    expect(response?.raw).toEqual([
      4,
      'msg-1',
      'NotImplemented',
      'RemoteStartTransaction is not implemented',
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

  it('does not respond to an unexpected CALLRESULT/CALLERROR from a device (no pending call)', async () => {
    pendingCalls.has.mockReturnValue(false);
    const response = await router.handleInboundFrame(adapter, station, {
      raw: [3, 'msg-1', {}],
    });
    expect(response).toBeNull();
    expect(pendingCalls.resolve).not.toHaveBeenCalled();
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.UNSUPPORTED,
      }),
    );
  });

  // WO-ARGOS-059 — CALLRESULT/CALLERROR correlation. This router never
  // interprets Accepted/Rejected itself — it only forwards the raw
  // resolution to whoever registered the pending call.
  it('correlates a CALLRESULT to a matching pending call and records PROCESSED, not UNSUPPORTED', async () => {
    pendingCalls.has.mockReturnValue(true);
    const response = await router.handleInboundFrame(adapter, station, {
      raw: [3, 'msg-1', { status: 'Accepted' }],
    });

    expect(response).toBeNull(); // OCPP never responds to a response
    expect(pendingCalls.resolve).toHaveBeenCalledWith('msg-1', {
      kind: 'CALLRESULT',
      payload: { status: 'Accepted' },
    });
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.PROCESSED,
        correlationId: 'msg-1',
      }),
    );
  });

  it('correlates a CALLERROR to a matching pending call', async () => {
    pendingCalls.has.mockReturnValue(true);
    await router.handleInboundFrame(adapter, station, {
      raw: [4, 'msg-1', 'NotSupported', 'nope', {}],
    });

    expect(pendingCalls.resolve).toHaveBeenCalledWith('msg-1', {
      kind: 'CALLERROR',
      errorCode: 'NotSupported',
      errorDescription: 'nope',
      details: {},
    });
    expect(protocolEvents.record).toHaveBeenCalledWith(
      expect.objectContaining({
        processingStatus: OcppProcessingStatus.PROCESSED,
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

  // CAP-004 (WO-ARGOS-009): the four new event types route to their own
  // dedicated handlers, same as Boot/Heartbeat/Status do.
  it.each([
    ['Authorize', { idTag: 'ABC123' }, 'authorizationHandler'] as const,
    [
      'StartTransaction',
      { connectorId: 1, idTag: 'ABC123', meterStart: 0, timestamp: 'x' },
      'transactionStartHandler',
    ] as const,
    [
      'MeterValues',
      {
        connectorId: 1,
        transactionId: 42,
        meterValue: [
          {
            sampledValue: [
              { value: '100', measurand: 'Energy.Active.Import.Register' },
            ],
          },
        ],
      },
      'transactionUpdateHandler',
    ] as const,
    [
      'StopTransaction',
      { transactionId: 42, meterStop: 100, timestamp: 'x' },
      'transactionEndHandler',
    ] as const,
  ])(
    'routes %s to its dedicated handler',
    async (action, payload, handlerKey) => {
      const handlers = {
        authorizationHandler,
        transactionStartHandler,
        transactionUpdateHandler,
        transactionEndHandler,
      };
      await router.handleInboundFrame(adapter, station, call(action, payload));
      expect(handlers[handlerKey].handle).toHaveBeenCalledTimes(1);
    },
  );
});
