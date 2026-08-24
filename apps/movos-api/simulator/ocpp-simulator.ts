/**
 * OCPP development/test simulator. Deliberately lives OUTSIDE apps/movos-api/src/
 * (tsconfig.build.json only includes "src/**\/*") so it is never part of the
 * production build or runtime — see docs/engineering/OCPP_SIMULATOR_GUIDE.md
 * for local usage.
 *
 * Simulates a physical charge point's WebSocket client behavior: connects
 * with Basic Auth + a declared OCPP subprotocol, sends BootNotification/
 * Heartbeat/StatusNotification/Authorize/StartTransaction/MeterValues/
 * StopTransaction, and can deliberately misbehave (malformed frames,
 * invalid credentials, unsupported actions, duplicate connections) to
 * exercise the engine's defensive paths. It does not simulate real charger
 * firmware — it proves the MOVOS OCPP engine behaves correctly against a
 * well-formed and deliberately-adversarial protocol stream, not that any
 * specific vendor's hardware will behave identically. See the hardware
 * validation levels in
 * docs/domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md — this tool can
 * only ever produce SIMULATOR_VALIDATED evidence, never more.
 */
import { randomUUID } from 'node:crypto';
import * as readline from 'node:readline';

import WebSocket from 'ws';

import { formatCall } from '../src/ocpp/protocol/common/ocpp-frame';
import type { OcppProtocolVersion } from '../src/ocpp/protocol/common/normalized-events';
import type {
  SimulatorCommandOutcome,
  SimulatorConnectionConfig,
} from '../src/ocpp/simulator-contracts/simulator-config';

const SUBPROTOCOL_BY_VERSION: Record<OcppProtocolVersion, string> = {
  OCPP1_6J: 'ocpp1.6',
  OCPP2_0_1: 'ocpp2.0.1',
};

export interface CallResponse {
  kind: 'CALLRESULT' | 'CALLERROR';
  payload: unknown;
}

export class OcppSimulator {
  private ws: WebSocket | null = null;
  private readonly pending = new Map<
    string,
    { resolve: (r: CallResponse) => void; reject: (e: Error) => void }
  >();
  private closeInfo: { code: number; reason: string } | null = null;

  constructor(private readonly config: SimulatorConnectionConfig) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Port 443 is the standard HTTPS/WSS port — used here as the signal to
      // speak wss:// instead of ws:// (e.g. movos-api-production over
      // Railway's public HTTPS domain, which never accepts plain ws://).
      // Local usage (port 4000 by default) is unaffected: unchanged ws://.
      const scheme = this.config.port === 443 ? 'wss' : 'ws';
      const url = `${scheme}://${this.config.host}:${this.config.port}/ocpp/${encodeURIComponent(this.config.ocppIdentity)}`;
      const authHeader = Buffer.from(
        `${this.config.ocppIdentity}:${this.config.secret}`,
      ).toString('base64');

      this.ws = new WebSocket(
        url,
        [SUBPROTOCOL_BY_VERSION[this.config.protocolVersion]],
        {
          headers: { Authorization: `Basic ${authHeader}` },
        },
      );
      this.closeInfo = null;

      this.ws.once('open', () => resolve());
      this.ws.once('unexpected-response', (_req, res) => {
        reject(new Error(`Connection rejected: HTTP ${res.statusCode}`));
      });
      this.ws.once('error', (error) => reject(error));

      this.ws.on('message', (data) => this.handleMessage(data));
      this.ws.on('close', (code, reason) => {
        this.closeInfo = { code, reason: reason.toString() };
      });
    });
  }

  disconnect(): void {
    this.ws?.close(1000, 'simulator-disconnect');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  lastCloseInfo(): { code: number; reason: string } | null {
    return this.closeInfo;
  }

  async sendBootNotification(
    vendor: string,
    model: string,
    firmwareVersion?: string,
  ): Promise<CallResponse> {
    return this.call('BootNotification', {
      chargePointVendor: vendor,
      chargePointModel: model,
      ...(firmwareVersion ? { firmwareVersion } : {}),
    });
  }

  async sendHeartbeat(): Promise<CallResponse> {
    return this.call('Heartbeat', {});
  }

  async sendStatusNotification(
    connectorId: number,
    status: string,
    errorCode = 'NoError',
  ): Promise<CallResponse> {
    return this.call('StatusNotification', {
      connectorId,
      status,
      errorCode,
      timestamp: new Date().toISOString(),
    });
  }

  /** Sends a CALL for an action the engine doesn't implement — proves
   * unsupported-action handling responds with a protocol-correct
   * CALLERROR instead of silently dropping or crashing.
   * RemoteStartTransaction (Architecture Backlog #36) remains
   * unimplemented even after CAP-004 (WO-ARGOS-009), which implemented
   * Authorize/StartTransaction/MeterValues/StopTransaction. */
  async sendUnsupportedAction(): Promise<CallResponse> {
    return this.call('RemoteStartTransaction', { idTag: 'SIMULATOR-TEST-TAG' });
  }

  /** OCPP Authorize — a standalone credential check, independent of
   * physically starting a transaction. Never creates a ChargingSession by
   * itself (DEC-014) — see CAP-004_CHARGING_SESSIONS_FOUNDATION.md §5. */
  async sendAuthorize(idTag: string): Promise<CallResponse> {
    return this.call('Authorize', { idTag });
  }

  /** OCPP StartTransaction — the only message that creates a
   * ChargingSession, contingent on the idTag resolving to an ACCEPTED
   * AuthorizationAttempt. MOVOS assigns transactionId in the response;
   * this simulator never invents one client-side. */
  async sendStartTransaction(
    connectorId: number,
    idTag: string,
    meterStart: number,
    timestamp = new Date().toISOString(),
  ): Promise<CallResponse> {
    return this.call('StartTransaction', {
      connectorId,
      idTag,
      meterStart,
      timestamp,
    });
  }

  /** OCPP MeterValues, transaction-scoped — appends telemetry to the
   * ChargingSession identified by transactionId. Sends a single
   * Energy.Active.Import.Register sample, matching the one measurand
   * TransactionUpdateHandler currently persists as MeterValue.energyWh. */
  async sendMeterValues(
    connectorId: number,
    transactionId: number,
    energyWh: number,
    timestamp = new Date().toISOString(),
  ): Promise<CallResponse> {
    return this.call('MeterValues', {
      connectorId,
      transactionId,
      meterValue: [
        {
          timestamp,
          sampledValue: [
            {
              value: String(energyWh),
              measurand: 'Energy.Active.Import.Register',
              unit: 'Wh',
            },
          ],
        },
      ],
    });
  }

  /** OCPP StopTransaction — terminates the ChargingSession identified by
   * transactionId. `reason` is optional per spec (absence means a normal
   * stop) — see the 1.6J StopTransaction.reason -> ChargingSessionTermination
   * Reason mapping table in CAP-004_CHARGING_SESSIONS_FOUNDATION.md §6. */
  async sendStopTransaction(
    transactionId: number,
    meterStop: number,
    reason?: string,
    timestamp = new Date().toISOString(),
  ): Promise<CallResponse> {
    return this.call('StopTransaction', {
      transactionId,
      meterStop,
      timestamp,
      ...(reason ? { reason } : {}),
    });
  }

  /** Sends raw, non-JSON bytes directly over the socket — proves malformed
   * frames are rejected safely rather than crashing the connection or the
   * server process. */
  sendMalformedFrame(): void {
    this.ws?.send('this is not valid OCPP-J at all {{{');
  }

  /** Sends a structurally-valid JSON array with a missing required field —
   * a different malformed case than raw garbage: valid JSON, invalid OCPP
   * payload. */
  async sendMalformedBootNotification(): Promise<CallResponse> {
    return this.call('BootNotification', { onlyAnUnrelatedField: true });
  }

  private call(
    action: string,
    payload: Record<string, unknown>,
  ): Promise<CallResponse> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Simulator is not connected'));
    }
    const messageId = randomUUID();
    const timeoutMs = this.config.responseTimeoutMs ?? 5000;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(messageId);
        reject(new Error(`Timed out waiting for a response to ${action}`));
      }, timeoutMs);

      this.pending.set(messageId, {
        resolve: (r) => {
          clearTimeout(timeout);
          resolve(r);
        },
        reject: (e) => {
          clearTimeout(timeout);
          reject(e);
        },
      });

      this.ws?.send(JSON.stringify(formatCall(messageId, action, payload).raw));
    });
  }

  private handleMessage(data: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      return; // not our concern here — the engine-side malformed-frame path is what's under test elsewhere
    }
    if (!Array.isArray(parsed)) return;

    const [messageTypeId, messageId, third] = parsed as unknown[];
    if (typeof messageId !== 'string') return;

    // WO-ARGOS-059 — an incoming CALL (messageTypeId 2): a server-originated
    // command (RemoteStartTransaction, etc). Distinct from 3/4 below, which
    // are responses to calls THIS simulator sent — before WO-059 this
    // branch didn't exist at all, so any incoming CALL fell through to the
    // `pending.get(messageId)` lookup below, found nothing (that map only
    // ever holds ids the simulator generated for its own outgoing calls),
    // and was silently dropped. See respondToIncomingCall for the
    // test-author-controlled response this now sends instead.
    if (messageTypeId === 2) {
      const action = typeof third === 'string' ? third : undefined;
      const rawPayload = (parsed as unknown[])[3];
      const incomingPayload =
        rawPayload && typeof rawPayload === 'object'
          ? (rawPayload as Record<string, unknown>)
          : {};
      if (action)
        this.respondToIncomingCall(messageId, action, incomingPayload);
      return;
    }

    const pending = this.pending.get(messageId);
    if (!pending) return;
    this.pending.delete(messageId);

    if (messageTypeId === 3) {
      pending.resolve({ kind: 'CALLRESULT', payload: third });
    } else if (messageTypeId === 4) {
      pending.resolve({ kind: 'CALLERROR', payload: parsed.slice(2) });
    }
  }

  /**
   * WO-ARGOS-059 — deterministic, test-author-controlled responses to an
   * incoming server-originated CALL. This is infrastructure for testing
   * the Remote Operations control-plane foundation (item 9 of that work
   * order's scope) — it does NOT attempt to reproduce real charger
   * decision-making (e.g. it never actually "starts charging"; a realistic
   * end-to-end RemoteStart/RemoteStop validation still needs the test
   * itself to separately call sendStartTransaction/sendStopTransaction, the
   * same methods used for the ordinary inbound-flow tests).
   *
   * Config-driven per action name (e.g. 'RemoteStartTransaction'), so one
   * simulator instance can be told "accept this, reject that, say nothing
   * at all for a third" within a single test file — exercising
   * RemoteCommandService's ACCEPTED/REJECTED/TIMED_OUT paths against a
   * real WebSocket round trip, not just mocked Prisma/ConnectionRegistry.
   * An action with no configured outcome defaults to a plain Accepted, so
   * a simple happy-path test needs no boilerplate.
   */
  private respondToIncomingCall(
    messageId: string,
    action: string,
    incomingPayload: Record<string, unknown>,
  ): void {
    const outcome = this.config.commandResponses?.[action] ?? {
      kind: 'accept',
    };

    // Observability only — see SimulatorConnectionConfig.onIncomingCall's
    // doc comment. Fires before the kind-based branching below so it's
    // called for every outcome, including 'silent'. Never influences what
    // gets sent back.
    this.config.onIncomingCall?.(action, outcome, incomingPayload);

    if (outcome.kind === 'silent') {
      return; // deliberately no response — exercises the server's own timeout path
    }

    if (outcome.kind === 'error') {
      this.ws?.send(
        JSON.stringify([
          4,
          messageId,
          outcome.errorCode,
          outcome.errorDescription ?? '',
          {},
        ]),
      );
      return;
    }

    const payload = outcome.payload ?? {
      status: outcome.kind === 'reject' ? 'Rejected' : 'Accepted',
    };
    this.ws?.send(JSON.stringify([3, messageId, payload]));
  }
}

/** Heartbeat cadence while --interactive keeps the connection open —
 * comfortably under ConnectionRegistryService's 5-minute STALE_THRESHOLD_MS
 * (connection-registry.service.ts), without sending excessive traffic. */
export const HEARTBEAT_INTERVAL_MS = 60_000;

export function describeOutcome(outcome: SimulatorCommandOutcome): string {
  switch (outcome.kind) {
    case 'accept':
      return 'Accepted';
    case 'reject':
      return 'Rejected';
    case 'error':
      return `CALLERROR (${outcome.errorCode})`;
    case 'silent':
      return '(silent — no response sent)';
  }
}

function requireNumber(token: string | undefined, name: string): number {
  const value = Number(token);
  if (token === undefined || !Number.isFinite(value)) {
    throw new Error(`invalid or missing ${name}: ${token ?? '(none)'}`);
  }
  return value;
}

/** Reads the transactionId MOVOS actually assigned from a StartTransaction
 * CALLRESULT — never invented client-side, same discipline as
 * sendStartTransaction's own doc comment. Returns null for anything else
 * (e.g. a CALLERROR), so callers can fall back to showing the raw
 * response. */
function extractTransactionId(response: CallResponse): number | null {
  if (response.kind !== 'CALLRESULT') return null;
  const payload = response.payload;
  if (
    payload &&
    typeof payload === 'object' &&
    typeof (payload as Record<string, unknown>).transactionId === 'number'
  ) {
    return (payload as { transactionId: number }).transactionId;
  }
  return null;
}

/**
 * Drives the --interactive CLI session: dispatches operator commands to the
 * existing OcppSimulator send* methods (never duplicates payload
 * construction), keeps the connection alive with a periodic Heartbeat, and
 * remembers the last real transactionId MOVOS returned so follow-up
 * meter/stop commands can reuse it via the "last" keyword. Deliberately has
 * no knowledge of readline/stdin/process signals (see runInteractiveMode's
 * wiring below) so it can be driven directly and deterministically in
 * tests, mirroring how remote-command.digital-twin.spec.ts drives
 * OcppSimulator itself directly rather than through the CLI.
 *
 * Receiving a server-initiated CALL (RemoteStartTransaction, etc.) is
 * handled entirely by OcppSimulator's own respondToIncomingCall — this
 * class never reacts to one automatically. The physical-effect commands
 * below (start/meter/stop) only ever run when a human types them.
 */
export class InteractiveSession {
  private lastTransactionId: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private shuttingDown = false;

  constructor(
    private readonly simulator: OcppSimulator,
    private readonly log: (message: string) => void = console.log,
  ) {}

  startHeartbeat(intervalMs: number = HEARTBEAT_INTERVAL_MS): void {
    this.heartbeatTimer = setInterval(() => {
      void this.simulator
        .sendHeartbeat()
        .then(() => this.log('[heartbeat] ok'))
        .catch((error: Error) =>
          this.log(`[heartbeat] failed: ${error.message}`),
        );
    }, intervalMs);
  }

  /** Handles one line of operator input. Returns 'exit' for the
   * "disconnect" command — the CLI wiring below is responsible for actually
   * closing readline and letting the process end. */
  async handleLine(rawLine: string): Promise<'continue' | 'exit'> {
    const tokens = rawLine.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return 'continue';
    const [command, ...args] = tokens;

    try {
      switch (command) {
        case 'help':
          this.printHelp();
          break;
        case 'status':
          this.log(
            `connected=${this.simulator.isConnected()} lastTransactionId=${this.lastTransactionId ?? '(none)'}`,
          );
          break;
        case 'heartbeat':
          this.log(JSON.stringify(await this.simulator.sendHeartbeat()));
          break;
        case 'available':
          await this.runStatusNotification(args, 'Available');
          break;
        case 'charging':
          await this.runStatusNotification(args, 'Charging');
          break;
        case 'start':
          await this.runStart(args);
          break;
        case 'meter':
          await this.runMeter(args);
          break;
        case 'stop':
          await this.runStop(args);
          break;
        case 'disconnect':
          return 'exit';
        default:
          this.log(`Unknown command: ${command}. Type "help" for the list.`);
      }
    } catch (error) {
      this.log(`Command failed: ${(error as Error).message}`);
    }
    return 'continue';
  }

  /** Idempotent — safe to call from both the "disconnect" command and a
   * signal handler without double-clearing/double-closing. */
  shutdown(): void {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.simulator.disconnect();
  }

  private printHelp(): void {
    this.log(
      [
        'Commands:',
        '  status',
        '  heartbeat',
        '  available <connectorId>',
        '  charging <connectorId>',
        '  start <connectorId> <idTag> [meterStart]',
        '  meter <connectorId> <transactionId|last> <energyWh>',
        '  stop <transactionId|last> <meterStop>',
        '  disconnect',
        '  help',
      ].join('\n'),
    );
  }

  private async runStatusNotification(
    args: string[],
    status: string,
  ): Promise<void> {
    const connectorId = requireNumber(args[0], 'connectorId');
    this.log(
      JSON.stringify(
        await this.simulator.sendStatusNotification(connectorId, status),
      ),
    );
  }

  private async runStart(args: string[]): Promise<void> {
    const connectorId = requireNumber(args[0], 'connectorId');
    const idTag = args[1];
    if (!idTag) {
      throw new Error('usage: start <connectorId> <idTag> [meterStart]');
    }
    const meterStart =
      args[2] !== undefined ? requireNumber(args[2], 'meterStart') : 0;

    const response = await this.simulator.sendStartTransaction(
      connectorId,
      idTag,
      meterStart,
    );
    const transactionId = extractTransactionId(response);
    if (transactionId !== null) {
      this.lastTransactionId = transactionId;
      this.log(
        `StartTransaction -> transactionId=${transactionId} (use "last" in meter/stop) ${JSON.stringify(response)}`,
      );
    } else {
      this.log(
        `StartTransaction response (no transactionId found): ${JSON.stringify(response)}`,
      );
    }
  }

  private async runMeter(args: string[]): Promise<void> {
    const connectorId = requireNumber(args[0], 'connectorId');
    const transactionId = this.resolveTransactionId(args[1]);
    const energyWh = requireNumber(args[2], 'energyWh');
    this.log(
      JSON.stringify(
        await this.simulator.sendMeterValues(
          connectorId,
          transactionId,
          energyWh,
        ),
      ),
    );
  }

  private async runStop(args: string[]): Promise<void> {
    const transactionId = this.resolveTransactionId(args[0]);
    const meterStop = requireNumber(args[1], 'meterStop');
    this.log(
      JSON.stringify(
        await this.simulator.sendStopTransaction(transactionId, meterStop),
      ),
    );
  }

  private resolveTransactionId(token: string | undefined): number {
    if (token === undefined || token === 'last') {
      if (this.lastTransactionId === null) {
        throw new Error(
          'no transactionId known yet — run "start" first, or pass one explicitly',
        );
      }
      return this.lastTransactionId;
    }
    return requireNumber(token, 'transactionId');
  }
}

/** CLI entry point for manual/local usage — see
 * docs/engineering/OCPP_SIMULATOR_GUIDE.md. Not invoked by any automated
 * test, which drive OcppSimulator/InteractiveSession directly instead. */
async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string, fallback?: string): string | undefined =>
    args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

  const host = flag('host', 'localhost') as string;
  const port = Number(flag('port', '4000'));
  const ocppIdentity = flag('identity');
  const secret = flag('secret');
  const protocolVersion =
    (flag('protocol', 'OCPP1_6J') as OcppProtocolVersion) ?? 'OCPP1_6J';
  // Presence-only flag (no "=value"), consistent with how this parser
  // already treats bare tokens — absent entirely, the CLI's behavior below
  // is byte-for-byte what it was before this option existed.
  const interactive = args.includes('--interactive');

  if (!ocppIdentity || !secret) {
    console.error(
      'Usage: ts-node simulator/ocpp-simulator.ts --identity=<ocppIdentity> --secret=<plaintextSecret> [--host=localhost] [--port=4000] [--protocol=OCPP1_6J|OCPP2_0_1] [--interactive]',
    );
    process.exitCode = 1;
    return;
  }

  const simulator = new OcppSimulator({
    host,
    port,
    ocppIdentity,
    secret,
    protocolVersion,
    // Only wired in --interactive: the short fire-and-forget flow below
    // never expects an incoming CALL, so this stays inert (and silent)
    // unless explicitly asked for.
    ...(interactive
      ? {
          onIncomingCall: (action, outcome, payload) => {
            console.log(`\n← Incoming ${action} ${JSON.stringify(payload)}`);
            console.log(`→ Responding: ${describeOutcome(outcome)}`);
          },
        }
      : {}),
  });
  console.log(
    `Connecting to ws://${host}:${port}/ocpp/${ocppIdentity} as ${protocolVersion}...`,
  );
  await simulator.connect();
  console.log('Connected. Sending BootNotification...');
  console.log(
    await simulator.sendBootNotification('Simulator Vendor', 'Simulator Model'),
  );
  console.log('Sending Heartbeat...');
  console.log(await simulator.sendHeartbeat());
  console.log('Sending StatusNotification (connector 1, Available)...');
  console.log(await simulator.sendStatusNotification(1, 'Available'));

  if (!interactive) {
    simulator.disconnect();
    return;
  }

  await runInteractiveMode(simulator);
}

/** --interactive wiring: readline + heartbeat + SIGINT/SIGTERM, all driving
 * the process/environment-agnostic InteractiveSession above. Never called
 * by any automated test (readline/process signals aren't something a unit
 * test should touch) — tests exercise InteractiveSession directly. */
async function runInteractiveMode(simulator: OcppSimulator): Promise<void> {
  const session = new InteractiveSession(simulator, console.log);
  session.startHeartbeat();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '> ',
  });

  let shuttingDown = false;
  const cleanShutdown = (): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    session.shutdown();
    rl.close();
  };

  process.on('SIGINT', cleanShutdown);
  process.on('SIGTERM', cleanShutdown);

  console.log(
    'Interactive mode — connection stays open. Type "help" for commands.',
  );
  rl.prompt();

  await new Promise<void>((resolve) => {
    rl.on('line', (line) => {
      void session.handleLine(line).then((result) => {
        if (result === 'exit') {
          cleanShutdown();
          return;
        }
        rl.prompt();
      });
    });
    rl.on('close', () => {
      cleanShutdown();
      resolve();
    });
  });
}

if (require.main === module) {
  void runCli();
}
