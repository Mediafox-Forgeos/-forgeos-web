import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { WebSocketServer, type WebSocket } from 'ws';

// WO — Digital Twin interactive CLI. Mirrors
// remote-command.digital-twin.spec.ts's own precedent of importing the real
// simulator client directly (apps/movos-api/tsconfig.build.json excludes
// simulator/ from the production build regardless of this import).
import {
  OcppSimulator,
  InteractiveSession,
  describeOutcome,
} from '../../simulator/ocpp-simulator';

const FAKE_TRANSACTION_ID = 4242;
/** A stand-in for a real OCPP Basic Auth secret — used only to prove it
 * never leaks into captured log output (test 10). Not a real credential. */
const FAKE_SECRET = 'unguessable-test-secret-should-never-be-logged';

/**
 * A minimal fake OCPP backend — not the real MOVOS engine (that's already
 * covered by remote-command.digital-twin.spec.ts /
 * remote-operations-phase-a.e2e-spec.ts). This one only proves the CLI's
 * own new interactive layer (InteractiveSession, the onIncomingCall hook,
 * the heartbeat timer) behaves correctly against a real WebSocket, without
 * needing the whole Nest module graph.
 */
class FakeOcppBackend {
  private server: HttpServer | null = null;
  private wss: WebSocketServer | null = null;
  private currentSocket: WebSocket | null = null;
  readonly receivedActions: string[] = [];
  private readonly seenMessages: unknown[] = [];

  async start(): Promise<number> {
    this.server = createServer();
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws) => {
      this.currentSocket = ws;
      ws.on('message', (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          return;
        }
        this.seenMessages.push(parsed);
        if (!Array.isArray(parsed)) return;
        const [typeId, messageId, action] = parsed as unknown[];
        if (typeId !== 2 || typeof messageId !== 'string') return;
        this.receivedActions.push(action as string);
        this.respond(ws, messageId, action as string);
      });
    });
    await new Promise<void>((resolve) =>
      this.server?.listen(0, '127.0.0.1', resolve),
    );
    return (this.server?.address() as AddressInfo).port;
  }

  private respond(ws: WebSocket, messageId: string, action: string): void {
    const payload =
      action === 'StartTransaction'
        ? {
            idTagInfo: { status: 'Accepted' },
            transactionId: FAKE_TRANSACTION_ID,
          }
        : { status: 'Accepted' };
    ws.send(JSON.stringify([3, messageId, payload]));
  }

  /** Sends a server-initiated CALL to the currently-connected client, as
   * MOVOS would when relaying a RemoteStart/RemoteStop command. */
  sendIncomingCall(action: string, payload: Record<string, unknown>): void {
    this.currentSocket?.send(
      JSON.stringify([2, `srv-${action}-${Date.now()}`, action, payload]),
    );
  }

  messagesForAction(action: string): unknown[] {
    return this.seenMessages.filter(
      (m) => Array.isArray(m) && (m as unknown[])[2] === action,
    );
  }

  async stop(): Promise<void> {
    this.currentSocket?.close();
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('OCPP simulator — interactive CLI extension', () => {
  let backend: FakeOcppBackend;
  let port: number;

  beforeEach(async () => {
    backend = new FakeOcppBackend();
    port = await backend.start();
  });

  afterEach(async () => {
    await backend.stop();
  });

  function newSimulator(
    onIncomingCall?: ConstructorParameters<
      typeof OcppSimulator
    >[0]['onIncomingCall'],
  ): OcppSimulator {
    return new OcppSimulator({
      host: '127.0.0.1',
      port,
      ocppIdentity: 'movos-twin-cli-test',
      secret: FAKE_SECRET,
      protocolVersion: 'OCPP1_6J',
      onIncomingCall,
    });
  }

  // 1. Legacy (non-interactive) behavior preserved.
  it('legacy flow: connects, exchanges Boot/Heartbeat/Status, and disconnects — unchanged', async () => {
    const sim = newSimulator();
    await sim.connect();
    await sim.sendBootNotification('Simulator Vendor', 'Simulator Model');
    await sim.sendHeartbeat();
    await sim.sendStatusNotification(1, 'Available');
    expect(sim.isConnected()).toBe(true);

    sim.disconnect();
    await wait(50);
    expect(sim.isConnected()).toBe(false);
  });

  // 2. Interactive mode does not auto-disconnect.
  it('interactive flow: the same sequence does NOT disconnect on its own', async () => {
    const sim = newSimulator();
    await sim.connect();
    await sim.sendBootNotification('Simulator Vendor', 'Simulator Model');
    await sim.sendHeartbeat();
    await sim.sendStatusNotification(1, 'Available');

    await wait(50);
    expect(sim.isConnected()).toBe(true); // no disconnect() call — stays open

    const session = new InteractiveSession(sim, () => {});
    session.shutdown();
    await wait(50);
    expect(sim.isConnected()).toBe(false);
  });

  // 3. Periodic heartbeat while alive.
  it('startHeartbeat sends a real Heartbeat CALL on the configured interval', async () => {
    const sim = newSimulator();
    await sim.connect();
    const logs: string[] = [];
    const session = new InteractiveSession(sim, (m) => logs.push(m));

    session.startHeartbeat(30); // short interval for the test only
    await wait(120); // several ticks

    session.shutdown();
    expect(
      backend.messagesForAction('Heartbeat').length,
    ).toBeGreaterThanOrEqual(2);
    expect(logs.some((l) => l.includes('[heartbeat] ok'))).toBe(true);
  });

  it('shutdown() stops the heartbeat timer — no further ticks after disconnect', async () => {
    const sim = newSimulator();
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});
    session.startHeartbeat(30);
    await wait(80);
    const countBeforeShutdown = backend.messagesForAction('Heartbeat').length;

    session.shutdown();
    await wait(120);
    expect(backend.messagesForAction('Heartbeat').length).toBe(
      countBeforeShutdown,
    );
  });

  // 4 & 12. Incoming RemoteStartTransaction is answered but never triggers
  // a real StartTransaction on its own — a human command is required.
  it('an incoming RemoteStartTransaction is Accepted automatically but does not fabricate a StartTransaction', async () => {
    const incoming: Array<{ action: string; outcome: string }> = [];
    const sim = newSimulator((action, outcome) => {
      incoming.push({ action, outcome: describeOutcome(outcome) });
    });
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});

    backend.sendIncomingCall('RemoteStartTransaction', {
      connectorId: 1,
      idTag: 'RFID-1',
    });
    await wait(50);

    expect(incoming).toEqual([
      { action: 'RemoteStartTransaction', outcome: 'Accepted' },
    ]);
    expect(backend.receivedActions).not.toContain('StartTransaction');

    session.shutdown();
  });

  // 5 & 6 & 7. start -> real transactionId -> meter -> stop, via "last".
  it('start/meter/stop use the real send* methods and the real transactionId end to end', async () => {
    const sim = newSimulator();
    await sim.connect();
    const logs: string[] = [];
    const session = new InteractiveSession(sim, (m) => logs.push(m));

    const startResult = await session.handleLine('start 1 RFID-1 0');
    expect(startResult).toBe('continue');
    expect(
      logs.some((l) => l.includes(`transactionId=${FAKE_TRANSACTION_ID}`)),
    ).toBe(true);

    await session.handleLine('meter 1 last 500');
    const meterCalls = backend.messagesForAction('MeterValues');
    expect(meterCalls).toHaveLength(1);
    expect((meterCalls[0] as unknown[])[3]).toMatchObject({
      connectorId: 1,
      transactionId: FAKE_TRANSACTION_ID,
    });

    await session.handleLine('stop last 1500');
    const stopCalls = backend.messagesForAction('StopTransaction');
    expect(stopCalls).toHaveLength(1);
    expect((stopCalls[0] as unknown[])[3]).toMatchObject({
      transactionId: FAKE_TRANSACTION_ID,
      meterStop: 1500,
    });

    session.shutdown();
  });

  it('meter/stop reject "last" when no transactionId is known yet — never invents one', async () => {
    const sim = newSimulator();
    await sim.connect();
    const logs: string[] = [];
    const session = new InteractiveSession(sim, (m) => logs.push(m));

    await session.handleLine('stop last 100');
    expect(logs.some((l) => l.includes('no transactionId known yet'))).toBe(
      true,
    );
    expect(backend.receivedActions).not.toContain('StopTransaction');

    session.shutdown();
  });

  // 8. "disconnect" command ends the session cleanly.
  it('the "disconnect" command signals exit and shutdown() closes the socket', async () => {
    const sim = newSimulator();
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});

    const result = await session.handleLine('disconnect');
    expect(result).toBe('exit');
    expect(sim.isConnected()).toBe(true); // handleLine itself never closes anything

    session.shutdown(); // this is what the CLI wiring does on 'exit'
    await wait(50);
    expect(sim.isConnected()).toBe(false);
  });

  // 9. Signal-handler cleanup — SIGINT/SIGTERM in the real CLI both call the
  // same shutdown() exercised here; real OS signal delivery isn't exercised
  // in a unit test (matches this file's own precedent: the CLI entry point
  // itself is never invoked by automated tests).
  it('shutdown() is idempotent — safe to call twice (as SIGINT then a stray SIGTERM would)', async () => {
    const sim = newSimulator();
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});
    session.startHeartbeat(30);

    session.shutdown();
    await wait(50);
    expect(sim.isConnected()).toBe(false);

    expect(() => session.shutdown()).not.toThrow();
  });

  // 10. The secret never appears in captured output across a full session.
  it('the OCPP secret never appears in any captured log line', async () => {
    const logs: string[] = [];
    const sim = newSimulator((action, outcome, payload) => {
      logs.push(
        `incoming ${action} ${describeOutcome(outcome)} ${JSON.stringify(payload)}`,
      );
    });
    await sim.connect();
    const session = new InteractiveSession(sim, (m) => logs.push(m));
    session.startHeartbeat(30);

    await session.handleLine('help');
    await session.handleLine('status');
    await session.handleLine('available 1');
    await session.handleLine('start 1 RFID-1 0');
    await session.handleLine('meter 1 last 500');
    backend.sendIncomingCall('RemoteStartTransaction', {
      connectorId: 1,
      idTag: 'RFID-1',
    });
    await wait(50);
    await session.handleLine('stop last 1500');

    session.shutdown();

    const joined = logs.join('\n');
    expect(joined).not.toContain(FAKE_SECRET);
  });

  // 11. commandResponses (Rejected/CALLERROR/silent) still work unchanged —
  // this file's own respondToIncomingCall payload-plumbing change (adding
  // the incoming-payload parameter for the onIncomingCall hook) must not
  // alter which outcome actually gets decided/sent.
  it('commandResponses Rejected is still honored for an incoming call', async () => {
    const incoming: string[] = [];
    const sim = new OcppSimulator({
      host: '127.0.0.1',
      port,
      ocppIdentity: 'movos-twin-cli-test',
      secret: FAKE_SECRET,
      protocolVersion: 'OCPP1_6J',
      commandResponses: { RemoteStopTransaction: { kind: 'reject' } },
      onIncomingCall: (action, outcome) => {
        incoming.push(describeOutcome(outcome));
      },
    });
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});

    backend.sendIncomingCall('RemoteStopTransaction', { transactionId: 1 });
    await wait(50);

    session.shutdown();
    expect(incoming).toEqual(['Rejected']);
  });

  it('commandResponses CALLERROR is still honored for an incoming call', async () => {
    const incoming: string[] = [];
    const sim = new OcppSimulator({
      host: '127.0.0.1',
      port,
      ocppIdentity: 'movos-twin-cli-test',
      secret: FAKE_SECRET,
      protocolVersion: 'OCPP1_6J',
      commandResponses: {
        RemoteStopTransaction: {
          kind: 'error',
          errorCode: 'InternalError',
          errorDescription: 'simulated fault',
        },
      },
      onIncomingCall: (action, outcome) => {
        incoming.push(describeOutcome(outcome));
      },
    });
    await sim.connect();
    const session = new InteractiveSession(sim, () => {});

    backend.sendIncomingCall('RemoteStopTransaction', { transactionId: 1 });
    await wait(50);
    session.shutdown();

    expect(incoming).toEqual(['CALLERROR (InternalError)']);
  });
});
