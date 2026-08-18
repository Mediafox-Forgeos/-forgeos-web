import { Ocpp16Adapter } from './ocpp16-adapter';
import type {
  NormalizedInboundEvent,
  RawFrame,
} from '../common/normalized-events';

function call(
  action: string,
  payload: Record<string, unknown>,
  messageId = 'msg-1',
): RawFrame {
  return { raw: [2, messageId, action, payload] };
}

describe('Ocpp16Adapter', () => {
  let adapter: Ocpp16Adapter;

  beforeEach(() => {
    adapter = new Ocpp16Adapter();
  });

  // Test 7: BootNotification accepted flow.
  describe('BootNotification', () => {
    it('parses a valid BootNotification into a DeviceBoot event', () => {
      const event = adapter.parseInbound(
        call('BootNotification', {
          chargePointVendor: 'Kempower',
          chargePointModel: 'Satellite 400',
          firmwareVersion: '2.14.3',
        }),
        { stationIdentity: 'movos-abc123' },
      );

      expect(event).toEqual({
        type: 'DeviceBoot',
        stationIdentity: 'movos-abc123',
        vendor: 'Kempower',
        model: 'Satellite 400',
        firmwareVersion: '2.14.3',
        protocolVersion: 'OCPP1_6J',
      });
    });

    it('formats an Accepted CALLRESULT with the protocol-required fields', () => {
      const event: NormalizedInboundEvent = {
        type: 'DeviceBoot',
        stationIdentity: 'movos-abc123',
        vendor: 'Kempower',
        model: 'Satellite 400',
        protocolVersion: 'OCPP1_6J',
      };
      const frame = adapter.formatResponse(
        event,
        { status: 'Accepted' },
        'msg-1',
      );

      expect(frame.raw).toEqual([
        3,
        'msg-1',
        expect.objectContaining({ status: 'Accepted', interval: 300 }),
      ]);
    });

    // Test 11 (part 1): Malformed frame handling — valid JSON, invalid payload.
    it('rejects a BootNotification missing required fields as malformed', () => {
      const event = adapter.parseInbound(
        call('BootNotification', { onlyAnUnrelatedField: true }),
        { stationIdentity: 'movos-abc123' },
      );

      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });
  });

  // Test 8: Heartbeat response.
  describe('Heartbeat', () => {
    it('parses Heartbeat with no payload requirements', () => {
      const event = adapter.parseInbound(call('Heartbeat', {}), {
        stationIdentity: 'movos-abc123',
      });
      expect(event).toEqual({
        type: 'Heartbeat',
        stationIdentity: 'movos-abc123',
      });
    });

    it('formats a CALLRESULT carrying currentTime', () => {
      const frame = adapter.formatResponse(
        { type: 'Heartbeat', stationIdentity: 'movos-abc123' },
        { status: 'Accepted' },
        'msg-2',
      );
      const [messageTypeId, messageId, payload] = frame.raw as [
        number,
        string,
        { currentTime: string },
      ];
      expect(messageTypeId).toBe(3);
      expect(messageId).toBe('msg-2');
      expect(typeof payload.currentTime).toBe('string');
    });
  });

  // Test 9: StatusNotification mapping.
  describe('StatusNotification', () => {
    it('maps a known OCPP status string to the normalized vocabulary', () => {
      const event = adapter.parseInbound(
        call('StatusNotification', {
          connectorId: 1,
          status: 'Charging',
          errorCode: 'NoError',
          timestamp: '2026-07-30T00:00:00.000Z',
        }),
        { stationIdentity: 'movos-abc123' },
      );

      expect(event).toEqual({
        type: 'ConnectorStatus',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '1',
        status: 'CHARGING',
        errorCode: 'NoError',
        timestamp: '2026-07-30T00:00:00.000Z',
      });
    });

    it('rejects an unrecognized status value as malformed', () => {
      const event = adapter.parseInbound(
        call('StatusNotification', {
          connectorId: 1,
          status: 'NotARealOcppStatus',
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });
  });

  // Test 11 (part 2): Malformed frame handling — envelope-level.
  describe('malformed envelopes', () => {
    it('rejects a frame that is not an array', () => {
      const event = adapter.parseInbound(
        { raw: { not: 'an array' } },
        {
          stationIdentity: 'movos-abc123',
        },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });

    it('rejects a frame with too few elements', () => {
      const event = adapter.parseInbound(
        { raw: [2, 'msg-1'] },
        {
          stationIdentity: 'movos-abc123',
        },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });
  });

  describe('Authorize', () => {
    it('parses a valid Authorize into an Authorization event', () => {
      const event = adapter.parseInbound(
        call('Authorize', { idTag: 'ABC123' }),
        {
          stationIdentity: 'movos-abc123',
        },
      );
      expect(event).toEqual({
        type: 'Authorization',
        stationIdentity: 'movos-abc123',
        idTag: 'ABC123',
      });
    });

    it('rejects an Authorize with a missing idTag as malformed', () => {
      const event = adapter.parseInbound(call('Authorize', {}), {
        stationIdentity: 'movos-abc123',
      });
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });

    it('formats an accepted Authorize as a CALLRESULT carrying idTagInfo.status', () => {
      const frame = adapter.formatResponse(
        {
          type: 'Authorization',
          stationIdentity: 'movos-abc123',
          idTag: 'ABC123',
        },
        { status: 'Accepted', payload: { idTagStatus: 'Accepted' } },
        'msg-1',
      );
      expect(frame.raw).toEqual([
        3,
        'msg-1',
        { idTagInfo: { status: 'Accepted' } },
      ]);
    });

    it('formats a rejected Authorize as a CALLRESULT, never a CALLERROR', () => {
      const frame = adapter.formatResponse(
        {
          type: 'Authorization',
          stationIdentity: 'movos-abc123',
          idTag: 'BAD',
        },
        { status: 'Rejected', payload: { idTagStatus: 'Invalid' } },
        'msg-1',
      );
      expect((frame.raw as unknown[])[0]).toBe(3); // CALLRESULT, not CALLERROR
      expect(frame.raw).toEqual([
        3,
        'msg-1',
        { idTagInfo: { status: 'Invalid' } },
      ]);
    });
  });

  describe('StartTransaction', () => {
    it('parses a valid StartTransaction into a TransactionStart event', () => {
      const event = adapter.parseInbound(
        call('StartTransaction', {
          connectorId: 1,
          idTag: 'ABC123',
          meterStart: 1000,
          timestamp: '2026-07-31T00:00:00.000Z',
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toEqual({
        type: 'TransactionStart',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '1',
        idTag: 'ABC123',
        meterStart: 1000,
        timestamp: '2026-07-31T00:00:00.000Z',
        protocolVersion: 'OCPP1_6J',
      });
    });

    it('rejects a StartTransaction missing required fields as malformed', () => {
      const event = adapter.parseInbound(
        call('StartTransaction', { connectorId: 1 }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });

    it('formats an accepted StartTransaction as a CALLRESULT with transactionId and idTagInfo', () => {
      const frame = adapter.formatResponse(
        {
          type: 'TransactionStart',
          stationIdentity: 'movos-abc123',
          connectorExternalId: '1',
          idTag: 'ABC123',
          meterStart: 1000,
          timestamp: '2026-07-31T00:00:00.000Z',
          protocolVersion: 'OCPP1_6J',
        },
        {
          status: 'Accepted',
          payload: { protocolTransactionId: '12345', idTagStatus: 'Accepted' },
        },
        'msg-2',
      );
      expect(frame.raw).toEqual([
        3,
        'msg-2',
        { transactionId: 12345, idTagInfo: { status: 'Accepted' } },
      ]);
    });

    it('formats a rejected StartTransaction as a CALLRESULT, never a CALLERROR', () => {
      const frame = adapter.formatResponse(
        {
          type: 'TransactionStart',
          stationIdentity: 'movos-abc123',
          connectorExternalId: '1',
          idTag: 'UNKNOWN',
          meterStart: 1000,
          timestamp: '2026-07-31T00:00:00.000Z',
          protocolVersion: 'OCPP1_6J',
        },
        { status: 'Rejected', payload: { idTagStatus: 'Invalid' } },
        'msg-2',
      );
      expect((frame.raw as unknown[])[0]).toBe(3);
      expect(frame.raw).toEqual([
        3,
        'msg-2',
        { transactionId: 0, idTagInfo: { status: 'Invalid' } },
      ]);
    });
  });

  describe('MeterValues', () => {
    it('parses a valid MeterValues (with transactionId) into a TransactionUpdate event', () => {
      const event = adapter.parseInbound(
        call('MeterValues', {
          connectorId: 1,
          transactionId: 12345,
          meterValue: [
            {
              timestamp: '2026-07-31T00:05:00.000Z',
              sampledValue: [
                {
                  value: '1500',
                  measurand: 'Energy.Active.Import.Register',
                  unit: 'Wh',
                },
              ],
            },
          ],
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toEqual({
        type: 'TransactionUpdate',
        stationIdentity: 'movos-abc123',
        transactionRef: '12345',
        values: [
          {
            measurand: 'Energy.Active.Import.Register',
            value: 1500,
            unit: 'Wh',
          },
        ],
        timestamp: '2026-07-31T00:05:00.000Z',
      });
    });

    it('returns UnsupportedMessage for MeterValues with no transactionId', () => {
      const event = adapter.parseInbound(
        call('MeterValues', {
          connectorId: 1,
          meterValue: [{ sampledValue: [{ value: '10' }] }],
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toEqual({
        kind: 'UnsupportedMessage',
        action: 'MeterValues',
        reason: 'not_implemented',
      });
    });

    it('drops individually unparseable sampledValue entries without failing the message', () => {
      const event = adapter.parseInbound(
        call('MeterValues', {
          connectorId: 1,
          transactionId: 12345,
          meterValue: [
            {
              sampledValue: [{ value: 'not-a-number' }, { value: '2000' }],
            },
          ],
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({
        type: 'TransactionUpdate',
        values: [{ value: 2000 }],
      });
    });

    it('rejects MeterValues with no usable samples at all as malformed', () => {
      const event = adapter.parseInbound(
        call('MeterValues', {
          connectorId: 1,
          transactionId: 12345,
          meterValue: [{ sampledValue: [{ value: 'garbage' }] }],
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });

    it('formats a MeterValues response as an empty CALLRESULT', () => {
      const frame = adapter.formatResponse(
        {
          type: 'TransactionUpdate',
          stationIdentity: 'movos-abc123',
          transactionRef: '12345',
          values: [],
          timestamp: '2026-07-31T00:05:00.000Z',
        },
        { status: 'Accepted' },
        'msg-3',
      );
      expect(frame.raw).toEqual([3, 'msg-3', {}]);
    });
  });

  describe('StopTransaction', () => {
    it('parses a valid StopTransaction into a TransactionEnd event', () => {
      const event = adapter.parseInbound(
        call('StopTransaction', {
          transactionId: 12345,
          meterStop: 2000,
          timestamp: '2026-07-31T01:00:00.000Z',
          reason: 'Local',
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toEqual({
        type: 'TransactionEnd',
        stationIdentity: 'movos-abc123',
        transactionRef: '12345',
        meterStop: 2000,
        reason: 'Local',
        timestamp: '2026-07-31T01:00:00.000Z',
      });
    });

    it('parses a StopTransaction with no reason (absent means normal stop)', () => {
      const event = adapter.parseInbound(
        call('StopTransaction', {
          transactionId: 12345,
          meterStop: 2000,
          timestamp: '2026-07-31T01:00:00.000Z',
        }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({
        type: 'TransactionEnd',
        reason: undefined,
      });
    });

    it('rejects a StopTransaction missing required fields as malformed', () => {
      const event = adapter.parseInbound(
        call('StopTransaction', { transactionId: 12345 }),
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toMatchObject({ kind: 'MalformedFrame' });
    });

    it('formats a StopTransaction response as an empty CALLRESULT', () => {
      const frame = adapter.formatResponse(
        {
          type: 'TransactionEnd',
          stationIdentity: 'movos-abc123',
          transactionRef: '12345',
          meterStop: 2000,
          timestamp: '2026-07-31T01:00:00.000Z',
        },
        { status: 'Accepted' },
        'msg-4',
      );
      expect(frame.raw).toEqual([3, 'msg-4', {}]);
    });
  });

  // Test 13: Unsupported OCPP action handling. Authorize/StartTransaction/
  // MeterValues/StopTransaction were implemented by CAP-004 (WO-ARGOS-009)
  // — RemoteStartTransaction remains a genuinely unimplemented action.
  describe('unsupported actions', () => {
    it('returns UnsupportedMessage for a recognized-but-unimplemented 1.6J action', () => {
      const event = adapter.parseInbound(
        call('RemoteStartTransaction', { idTag: 'ABC123' }),
        {
          stationIdentity: 'movos-abc123',
        },
      );
      expect(event).toEqual({
        kind: 'UnsupportedMessage',
        action: 'RemoteStartTransaction',
        reason: 'not_implemented',
      });
    });

    it('formats an error response for an unsupported action', () => {
      const frame = adapter.formatErrorResponse('msg-3', {
        code: 'NotImplemented',
        description: 'RemoteStartTransaction is not implemented',
        category: 'unsupported',
      });
      expect(frame.raw).toEqual([
        4,
        'msg-3',
        'NotImplemented',
        'RemoteStartTransaction is not implemented',
        {},
      ]);
    });
  });

  // Test 22 (adapter-level contribution): vendor value is opaque pass-through
  // data — the adapter's behavior must not change based on what vendor
  // string is present.
  it('treats the vendor field as opaque data, never branching on its value', () => {
    const vendors = ['Kempower', 'ABB', 'Alpitronic', 'SomeUnknownVendor', ''];
    const events = vendors.map((vendor) =>
      adapter.parseInbound(
        call('BootNotification', {
          chargePointVendor: vendor || 'X',
          chargePointModel: 'Model',
        }),
        { stationIdentity: 'movos-abc123' },
      ),
    );
    for (const event of events) {
      expect(event).toMatchObject({ type: 'DeviceBoot' });
    }
  });

  it('declares its capabilities as exactly Boot/Heartbeat/Status/Authorization/Transaction* inbound, and RemoteStart/RemoteStop outbound (WO-ARGOS-059 Phase A)', () => {
    expect(Array.from(adapter.capabilities.supportedInbound).sort()).toEqual(
      [
        'Authorization',
        'ConnectorStatus',
        'DeviceBoot',
        'Heartbeat',
        'TransactionEnd',
        'TransactionStart',
        'TransactionUpdate',
      ].sort(),
    );
    expect(Array.from(adapter.capabilities.supportedOutbound).sort()).toEqual(
      ['RemoteStart', 'RemoteStop'].sort(),
    );
  });

  // WO-ARGOS-059 — Remote Operations / Control Plane Foundation. Only
  // RemoteStart/RemoteStop are implemented (ARGOS's WO-058 review, Phase A);
  // Reset/UnlockConnector/ChangeAvailability remain reserved-but-unbuilt.
  describe('outbound commands (WO-ARGOS-059)', () => {
    it('formats a RemoteStart command as RemoteStartTransaction.req', () => {
      const frame = adapter.formatOutbound({
        type: 'RemoteStart',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '1',
        idTag: 'ABC123',
      });
      expect(frame.raw).toEqual({ connectorId: 1, idTag: 'ABC123' });
      expect(adapter.outboundActionName('RemoteStart')).toBe(
        'RemoteStartTransaction',
      );
    });

    it('formats a RemoteStop command as RemoteStopTransaction.req', () => {
      const frame = adapter.formatOutbound({
        type: 'RemoteStop',
        stationIdentity: 'movos-abc123',
        transactionRef: '55526',
      });
      expect(frame.raw).toEqual({ transactionId: 55526 });
      expect(adapter.outboundActionName('RemoteStop')).toBe(
        'RemoteStopTransaction',
      );
    });

    it('parses an Accepted RemoteStart/RemoteStop CALLRESULT as accepted: true', () => {
      expect(
        adapter.parseOutboundResult(
          {
            type: 'RemoteStart',
            stationIdentity: 'x',
            connectorExternalId: '1',
            idTag: 'A',
          },
          { status: 'Accepted' },
        ),
      ).toEqual({ accepted: true });
      expect(
        adapter.parseOutboundResult(
          { type: 'RemoteStop', stationIdentity: 'x', transactionRef: '1' },
          { status: 'Accepted' },
        ),
      ).toEqual({ accepted: true });
    });

    it('parses a Rejected CALLRESULT as accepted: false — never inferred as physical outcome, only protocol acceptance', () => {
      expect(
        adapter.parseOutboundResult(
          {
            type: 'RemoteStart',
            stationIdentity: 'x',
            connectorExternalId: '1',
            idTag: 'A',
          },
          { status: 'Rejected' },
        ),
      ).toEqual({ accepted: false });
    });

    it.each(['Reset', 'UnlockConnector', 'ChangeAvailability'] as const)(
      '%s remains unimplemented — formatOutbound/outboundActionName/parseOutboundResult all throw CapabilityNotSupportedError',
      (type) => {
        const command =
          type === 'Reset'
            ? ({ type, stationIdentity: 'x', mode: 'Soft' } as const)
            : type === 'UnlockConnector'
              ? ({
                  type,
                  stationIdentity: 'x',
                  connectorExternalId: '1',
                } as const)
              : ({
                  type,
                  stationIdentity: 'x',
                  availability: 'Operative',
                } as const);

        expect(() => adapter.formatOutbound(command)).toThrow(
          'is not supported by the OCPP1_6J adapter',
        );
        expect(() => adapter.outboundActionName(type)).toThrow(
          'is not supported by the OCPP1_6J adapter',
        );
        expect(() => adapter.parseOutboundResult(command, {})).toThrow(
          'is not supported by the OCPP1_6J adapter',
        );
      },
    );
  });
});
