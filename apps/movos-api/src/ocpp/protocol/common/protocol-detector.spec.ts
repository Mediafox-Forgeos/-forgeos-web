import { detectProtocolVersion, subprotocolFor } from './protocol-detector';

// Test 18: OCPP 1.6J and 2.0.1 protocol detection.
describe('protocol-detector', () => {
  it('detects OCPP 1.6J from its subprotocol', () => {
    expect(detectProtocolVersion(['ocpp1.6'])).toBe('OCPP1_6J');
  });

  it('detects OCPP 2.0.1 from its subprotocol', () => {
    expect(detectProtocolVersion(['ocpp2.0.1'])).toBe('OCPP2_0_1');
  });

  it('is case-insensitive and tolerant of whitespace', () => {
    expect(detectProtocolVersion([' OCPP1.6 '])).toBe('OCPP1_6J');
  });

  it('picks the first recognized subprotocol when multiple are offered', () => {
    expect(detectProtocolVersion(['unknown', 'ocpp2.0.1'])).toBe('OCPP2_0_1');
  });

  it('returns null for an unrecognized or empty subprotocol list', () => {
    expect(detectProtocolVersion(['unknown-protocol'])).toBeNull();
    expect(detectProtocolVersion([])).toBeNull();
  });

  it('round-trips version -> subprotocol -> version', () => {
    expect(detectProtocolVersion([subprotocolFor('OCPP1_6J')])).toBe(
      'OCPP1_6J',
    );
    expect(detectProtocolVersion([subprotocolFor('OCPP2_0_1')])).toBe(
      'OCPP2_0_1',
    );
  });
});
