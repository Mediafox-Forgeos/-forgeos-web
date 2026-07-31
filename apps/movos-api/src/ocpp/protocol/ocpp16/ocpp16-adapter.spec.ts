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

  // Test 13: Unsupported OCPP action handling.
  describe('unsupported actions', () => {
    it('returns UnsupportedMessage for a recognized-but-unimplemented 1.6J action', () => {
      const event = adapter.parseInbound(
        call('Authorize', { idTag: 'ABC123' }),
        {
          stationIdentity: 'movos-abc123',
        },
      );
      expect(event).toEqual({
        kind: 'UnsupportedMessage',
        action: 'Authorize',
        reason: 'not_implemented',
      });
    });

    it('formats an error response for an unsupported action', () => {
      const frame = adapter.formatErrorResponse('msg-3', {
        code: 'NotImplemented',
        description: 'Authorize is not implemented',
        category: 'unsupported',
      });
      expect(frame.raw).toEqual([
        4,
        'msg-3',
        'NotImplemented',
        'Authorize is not implemented',
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

  it('declares its capabilities as exactly Boot/Heartbeat/Status inbound and no outbound', () => {
    expect(Array.from(adapter.capabilities.supportedInbound).sort()).toEqual(
      ['ConnectorStatus', 'DeviceBoot', 'Heartbeat'].sort(),
    );
    expect(adapter.capabilities.supportedOutbound.size).toBe(0);
  });
});
