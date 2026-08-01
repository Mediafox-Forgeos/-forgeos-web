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

import WebSocket from 'ws';

import { formatCall } from '../src/ocpp/protocol/common/ocpp-frame';
import type { OcppProtocolVersion } from '../src/ocpp/protocol/common/normalized-events';
import type { SimulatorConnectionConfig } from '../src/ocpp/simulator-contracts/simulator-config';

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
      const url = `ws://${this.config.host}:${this.config.port}/ocpp/${encodeURIComponent(this.config.ocppIdentity)}`;
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
    const pending = this.pending.get(messageId);
    if (!pending) return;
    this.pending.delete(messageId);

    if (messageTypeId === 3) {
      pending.resolve({ kind: 'CALLRESULT', payload: third });
    } else if (messageTypeId === 4) {
      pending.resolve({ kind: 'CALLERROR', payload: parsed.slice(2) });
    }
  }
}

/** CLI entry point for manual/local usage — see
 * docs/engineering/OCPP_SIMULATOR_GUIDE.md. Not invoked by any automated
 * test, which import the OcppSimulator class directly instead. */
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

  if (!ocppIdentity || !secret) {
    console.error(
      'Usage: ts-node simulator/ocpp-simulator.ts --identity=<ocppIdentity> --secret=<plaintextSecret> [--host=localhost] [--port=4000] [--protocol=OCPP1_6J|OCPP2_0_1]',
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
  simulator.disconnect();
}

if (require.main === module) {
  void runCli();
}
