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
