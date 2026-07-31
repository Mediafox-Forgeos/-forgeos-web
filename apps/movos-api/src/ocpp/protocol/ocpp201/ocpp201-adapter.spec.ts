import { Ocpp201Adapter } from './ocpp201-adapter';

// Test 19: OCPP 2.0.1 unsupported behavior fails explicitly.
describe('Ocpp201Adapter', () => {
  let adapter: Ocpp201Adapter;

  beforeEach(() => {
    adapter = new Ocpp201Adapter();
  });

  it('declares zero supported inbound or outbound message types', () => {
    expect(adapter.capabilities.supportedInbound.size).toBe(0);
    expect(adapter.capabilities.supportedOutbound.size).toBe(0);
  });

  it('resolves every CALL to UnsupportedMessage, never a normalized event or silent accept', () => {
    const actions = [
      'BootNotification',
      'Heartbeat',
      'StatusNotification',
      'Authorize',
    ];
    for (const action of actions) {
      const event = adapter.parseInbound(
        { raw: [2, 'msg-1', action, {}] },
        { stationIdentity: 'movos-abc123' },
      );
      expect(event).toEqual({
        kind: 'UnsupportedMessage',
        action,
        reason: 'not_implemented',
      });
    }
  });

  it('formats every response as an explicit CALLERROR, never a CALLRESULT/Accepted', () => {
    const frame = adapter.formatResponse(
      { type: 'Heartbeat', stationIdentity: 'movos-abc123' },
      { status: 'Accepted' },
      'msg-1',
    );
    const [messageTypeId, messageId, errorCode] = frame.raw as [
      number,
      string,
      string,
    ];
    expect(messageTypeId).toBe(4); // CALLERROR, never 3 (CALLRESULT)
    expect(messageId).toBe('msg-1');
    expect(errorCode).toBe('NotImplemented');
  });

  it('still surfaces a MalformedFrame for a structurally invalid envelope, not a generic unsupported response', () => {
    const event = adapter.parseInbound(
      { raw: 'not an array' },
      {
        stationIdentity: 'movos-abc123',
      },
    );
    expect(event).toMatchObject({ kind: 'MalformedFrame' });
  });

  it('throws CapabilityNotSupportedError for any outbound command', () => {
    expect(() =>
      adapter.formatOutbound({
        type: 'RemoteStart',
        stationIdentity: 'movos-abc123',
        connectorExternalId: '1',
        idTag: 'ABC',
      }),
    ).toThrow(/not supported/);
  });
});
