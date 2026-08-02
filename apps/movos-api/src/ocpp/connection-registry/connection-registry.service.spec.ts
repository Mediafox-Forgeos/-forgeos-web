import { ConnectionRegistryService } from './connection-registry.service';
import type { ConnectivityCoordinator } from '../connectivity/connectivity-coordinator.service';

function fakeSocket() {
  return { close: jest.fn() } as unknown as import('ws').WebSocket;
}

// CAP-006A: connectivity notifications now route through a
// ConcurrencyLimiter (real microtask hops even when under the limit), so
// asserting on the mock immediately after a synchronous register()/
// unregister() call requires flushing the microtask queue first.
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function fakeConnectivityCoordinator(): jest.Mocked<
  Pick<
    ConnectivityCoordinator,
    'handleConnectionEstablished' | 'handleConnectionClosed'
  >
> {
  return {
    handleConnectionEstablished: jest.fn().mockResolvedValue(undefined),
    handleConnectionClosed: jest.fn().mockResolvedValue(undefined),
  };
}

describe('ConnectionRegistryService', () => {
  let registry: ConnectionRegistryService;
  let connectivity: ReturnType<typeof fakeConnectivityCoordinator>;

  beforeEach(() => {
    connectivity = fakeConnectivityCoordinator();
    registry = new ConnectionRegistryService(
      connectivity as unknown as ConnectivityCoordinator,
    );
  });

  afterEach(() => {
    registry.onModuleDestroy();
  });

  // Test 6: Duplicate connection behavior.
  it('closes the previous socket and replaces it when a second connection registers for the same identity', async () => {
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
    await flush();

    expect(first.close).toHaveBeenCalledWith(
      1000,
      'replaced-by-new-connection',
    );
    expect(second.close).not.toHaveBeenCalled();
    expect(registry.get('movos-abc123')?.socket).toBe(second);
    expect(registry.listConnected()).toHaveLength(1);

    // CAP-005 scenario 10: a socket replacement is two genuine connection
    // events (register, register), never a spurious extra transition — the
    // replaced socket's own close is a direct WebSocket call, not routed
    // through unregister(), so it never produces a second
    // handleConnectionClosed call of its own.
    expect(connectivity.handleConnectionEstablished).toHaveBeenCalledTimes(2);
    expect(connectivity.handleConnectionClosed).not.toHaveBeenCalled();
  });

  // CAP-005 scenario 1: a valid connection is reported to the coordinator
  // with exactly the identity/station/protocol it registered with.
  it('notifies ConnectivityCoordinator of a new connection on register', async () => {
    registry.register({
      ocppIdentity: 'movos-abc123',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: fakeSocket(),
    });
    await flush();

    expect(connectivity.handleConnectionEstablished).toHaveBeenCalledWith({
      chargingStationId: 'cs1',
      ocppIdentity: 'movos-abc123',
      protocolVersion: 'OCPP1_6J',
    });
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

  it('unregister only removes the record if the closing socket matches the one on file', async () => {
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
    await flush();
    expect(registry.get('movos-abc123')?.socket).toBe(second);
    // CAP-005 scenario 11: the mismatched-socket close must not notify the
    // coordinator either — nothing actually disconnected.
    expect(connectivity.handleConnectionClosed).not.toHaveBeenCalled();

    // CAP-005 scenario 2: a genuine (matching-socket) close does notify,
    // with reason 'clean'.
    registry.unregister('movos-abc123', second);
    await flush();
    expect(registry.get('movos-abc123')).toBeUndefined();
    expect(connectivity.handleConnectionClosed).toHaveBeenCalledTimes(1);
    expect(connectivity.handleConnectionClosed).toHaveBeenCalledWith({
      chargingStationId: 'cs1',
      ocppIdentity: 'movos-abc123',
      reason: 'clean',
    });
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
  let connectivity: ReturnType<typeof fakeConnectivityCoordinator>;

  const SWEEP_INTERVAL_MS = 60_000;

  beforeEach(() => {
    jest.useFakeTimers();
    connectivity = fakeConnectivityCoordinator();
    registry = new ConnectionRegistryService(
      connectivity as unknown as ConnectivityCoordinator,
    );
  });

  afterEach(() => {
    registry.onModuleDestroy();
    jest.useRealTimers();
  });

  it('removes a connection idle past the stale threshold and closes its socket', async () => {
    const socket = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-stale',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket,
    });

    // Sweep runs every 60s; staleness requires >5min idle. The 6th tick
    // (t=360s) is the first sweep strictly past the 300s threshold. The
    // async variant also flushes the ConcurrencyLimiter's microtask hop
    // (CAP-006A) between fake-timer advances.
    await jest.advanceTimersByTimeAsync(6 * SWEEP_INTERVAL_MS);

    expect(socket.close).toHaveBeenCalledWith(1001, 'stale-connection');
    expect(registry.isConnected('movos-stale')).toBe(false);
    // CAP-005 scenario 3: only the stale sweep (not a clean close) reports
    // reason 'stale' — this is what lets ConnectivityCoordinator distinguish
    // "should move an ACTIVE/SUSPENDED session to OFFLINE" from a clean
    // disconnect, which must not.
    expect(connectivity.handleConnectionClosed).toHaveBeenCalledWith({
      chargingStationId: 'cs1',
      ocppIdentity: 'movos-stale',
      reason: 'stale',
    });
  });

  it('retains a connection that is touched before it goes stale', async () => {
    const socket = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-active',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket,
    });

    await jest.advanceTimersByTimeAsync(4 * SWEEP_INTERVAL_MS); // t=240s
    registry.touch('movos-active'); // simulates an inbound message, e.g. Heartbeat
    await jest.advanceTimersByTimeAsync(2 * SWEEP_INTERVAL_MS); // t=360s, but only 120s since touch

    expect(socket.close).not.toHaveBeenCalled();
    expect(registry.isConnected('movos-active')).toBe(true);
  });

  it('does not evict a newer replacement connection when the older socket it replaced goes stale', async () => {
    const older = fakeSocket();
    registry.register({
      ocppIdentity: 'movos-replaced',
      chargingStationId: 'cs1',
      protocolVersion: 'OCPP1_6J',
      socket: older,
    });

    await jest.advanceTimersByTimeAsync(2 * SWEEP_INTERVAL_MS); // t=120s
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
    await jest.advanceTimersByTimeAsync(0);
    expect(registry.get('movos-replaced')?.socket).toBe(newer);
    // CAP-005 scenario 11 (sweep-adjacent variant): the old socket's late
    // close must not tell the coordinator anything closed — the live
    // (newer) connection is unaffected and still ONLINE.
    expect(connectivity.handleConnectionClosed).not.toHaveBeenCalled();

    // t=360s total: the OLD record's original lastMessageAt (t=0) would
    // have been stale by now, but the live record tracks the NEWER
    // connection's own fresh timestamp (t=120s) and must survive.
    await jest.advanceTimersByTimeAsync(4 * SWEEP_INTERVAL_MS);

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

  // CAP-006A (WO-ARGOS-012) Objective 3 — closes RA-003: a correlated mass
  // disconnect (e.g. a shared upstream network incident) must not fire an
  // unbounded burst of concurrent connectivity notifications. Registers
  // far more stale connections than NOTIFY_CONCURRENCY_LIMIT (25), then
  // proves via a concurrency-tracking mock that no more than the limit
  // were ever in flight at once — while every single one still eventually
  // completes.
  it('bounds concurrent connectivity notifications during a mass stale-disconnect event', async () => {
    const STATION_COUNT = 60;
    let active = 0;
    let maxActive = 0;
    connectivity.handleConnectionClosed.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      // A few microtask hops so overlapping calls actually overlap in
      // time, without depending on any real or fake timer delay.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      active -= 1;
    });

    for (let i = 0; i < STATION_COUNT; i += 1) {
      registry.register({
        ocppIdentity: `movos-mass-${i}`,
        chargingStationId: `cs-${i}`,
        protocolVersion: 'OCPP1_6J',
        socket: fakeSocket(),
      });
    }
    // Drain the registration notifications first so this test isolates
    // the disconnect-side burst.
    await jest.advanceTimersByTimeAsync(0);

    await jest.advanceTimersByTimeAsync(6 * SWEEP_INTERVAL_MS);

    expect(connectivity.handleConnectionClosed).toHaveBeenCalledTimes(
      STATION_COUNT,
    );
    expect(maxActive).toBeLessThanOrEqual(25); // NOTIFY_CONCURRENCY_LIMIT
    expect(maxActive).toBeGreaterThan(1); // proves it's actually concurrent, not serialized to 1
  });
});
