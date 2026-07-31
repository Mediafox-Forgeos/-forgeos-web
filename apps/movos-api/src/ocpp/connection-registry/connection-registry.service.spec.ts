import { ConnectionRegistryService } from './connection-registry.service';

function fakeSocket() {
  return { close: jest.fn() } as unknown as import('ws').WebSocket;
}

describe('ConnectionRegistryService', () => {
  let registry: ConnectionRegistryService;

  beforeEach(() => {
    registry = new ConnectionRegistryService();
  });

  afterEach(() => {
    registry.onModuleDestroy();
  });

  // Test 6: Duplicate connection behavior.
  it('closes the previous socket and replaces it when a second connection registers for the same identity', () => {
    const first = fakeSocket();
    const second = fakeSocket();

    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: first,
    });
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: second,
    });

    expect(first.close).toHaveBeenCalledWith(
      1000,
      'replaced-by-new-connection',
    );
    expect(second.close).not.toHaveBeenCalled();
    expect(registry.get('movos-abc123')?.socket).toBe(second);
    expect(registry.listConnected()).toHaveLength(1);
  });

  // Test 17 (connection-layer half): reconnecting does not create any
  // extra state beyond the single connection record — there is no session
  // concept at this layer to spuriously create, and only one entry ever
  // exists for a given identity regardless of how many times it reconnects.
  it('reconnecting repeatedly never accumulates more than one connection record', () => {
    for (let i = 0; i < 5; i += 1) {
      registry.register({
        ocppIdentity: 'movos-abc123',
        chargingStationId: 'cs1',
        protocolVersion: 'OCPP1_6J',
        socket: fakeSocket(),
      });
    }
    expect(registry.listConnected()).toHaveLength(1);
  });

  it('unregister only removes the record if the closing socket matches the one on file', () => {
    const first = fakeSocket();
    const second = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: first,
    });
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: second,
    });

    // A stale close event from the replaced (first) socket must not evict
    // the newer, live (second) connection.
    registry.unregister('movos-abc123', first);
    expect(registry.get('movos-abc123')?.socket).toBe(second);

    registry.unregister('movos-abc123', second);
    expect(registry.get('movos-abc123')).toBeUndefined();
  });

  it('forceDisconnect closes the socket and removes the record', () => {
    const socket = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket,
    });

    registry.forceDisconnect('movos-abc123', 'revoked');

    expect(socket.close).toHaveBeenCalledWith(1000, 'revoked');
    expect(registry.isConnected('movos-abc123')).toBe(false);
  });

  it('listConnected never exposes the raw socket', () => {
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: fakeSocket(),
    });

    const [summary] = registry.listConnected();
    expect(summary).not.toHaveProperty('socket');
    expect(summary.ocppIdentity).toBe('movos-abc123');
    expect(summary.protocolVersion).toBe('OCPP1_6J');
  });
});

// WO-ARGOS-008 Phase 6: deterministic coverage for the stale-connection
// sweep, previously implemented but untested. Uses fake timers to advance
// virtual time rather than changing the production SWEEP_INTERVAL_MS /
// STALE_THRESHOLD_MS constants, which this suite does not alter.
describe('ConnectionRegistryService — stale connection sweep', () => {
  let registry: ConnectionRegistryService;

  const SWEEP_INTERVAL_MS = 60_000;

  beforeEach(() => {
    jest.useFakeTimers();
    registry = new ConnectionRegistryService();
  });

  afterEach(() => {
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('removes a connection idle past the stale threshold and closes its socket', () => {
    const socket = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-stale',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket,
    });

    // Sweep runs every 60s; staleness requires >5min idle. The 6th tick
    // (t=360s) is the first sweep strictly past the 300s threshold.
    jest.advanceTimersByTime(6 * SWEEP_INTERVAL_MS);

    expect(socket.close).toHaveBeenCalledWith(1001, 'stale-connection');
    expect(registry.isConnected('movos-stale')).toBe(false);
  });

  it('retains a connection that is touched before it goes stale', () => {
    const socket = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-active',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket,
    });

    jest.advanceTimersByTime(4 * SWEEP_INTERVAL_MS); // t=240s
    registry.touch('movos-active'); // simulates an inbound message, e.g. Heartbeat
    jest.advanceTimersByTime(2 * SWEEP_INTERVAL_MS); // t=360s, but only 120s since touch

    expect(socket.close).not.toHaveBeenCalled();
    expect(registry.isConnected('movos-active')).toBe(true);
  });

  it('does not evict a newer replacement connection when the older socket it replaced goes stale', () => {
    const older = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-replaced',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: older,
    });

    jest.advanceTimersByTime(2 * SWEEP_INTERVAL_MS); // t=120s
    const newer = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-replaced',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: newer,
    });
    expect(older.close).toHaveBeenCalledWith(
      1000,
      'replaced-by-new-connection',
    );

    // The older socket's own 'close' handler firing late (after
    // replacement) must not evict the newer record — same guard as the
    // duplicate-connection unit test above, exercised here alongside the
    // sweep timer rather than in isolation.
    registry.unregister('movos-replaced', older);
    expect(registry.get('movos-replaced')?.socket).toBe(newer);

    // t=360s total: the OLD record's original lastMessageAt (t=0) would
    // have been stale by now, but the live record tracks the NEWER
    // connection's own fresh timestamp (t=120s) and must survive.
    jest.advanceTimersByTime(4 * SWEEP_INTERVAL_MS);

    expect(newer.close).not.toHaveBeenCalled();
    expect(registry.isConnected('movos-replaced')).toBe(true);
  });

  it('clears the sweep timer on module destroy, leaving no pending timers', () => {
    registry.register({
      ocppIdentity: 'movos-cleanup',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: fakeSocket(),
    });

    registry.onModuleDestroy();

    expect(jest.getTimerCount()).toBe(0);
  });
});
