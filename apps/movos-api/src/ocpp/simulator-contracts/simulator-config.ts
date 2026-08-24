import type { OcppProtocolVersion } from '../protocol/common/normalized-events';

/**
 * WO-ARGOS-059 — a test-author-controlled response to an incoming
 * server-originated CALL (e.g. RemoteStartTransaction). Deliberately not an
 * attempt to reproduce real charger decision-making — see
 * ocpp-simulator.ts's respondToIncomingCall doc comment.
 */
export type SimulatorCommandOutcome =
  | { kind: 'accept'; payload?: Record<string, unknown> }
  | { kind: 'reject'; payload?: Record<string, unknown> }
  | { kind: 'error'; errorCode: string; errorDescription?: string }
  /** No response at all — exercises the server's own timeout path. */
  | { kind: 'silent' };

/**
 * The contract the OCPP simulator (apps/movos-api/simulator/, outside the
 * production build — see docs/engineering/OCPP_SIMULATOR_GUIDE.md) and any
 * automated test that drives it agree on. Lives inside src/ocpp/ because
 * it's a shared type contract, not simulator logic itself — the simulator
 * implementation must never be part of apps/movos-api/dist/.
 */
export interface SimulatorConnectionConfig {
  host: string;
  port: number;
  ocppIdentity: string;
  secret: string;
  protocolVersion: OcppProtocolVersion;
  /** Milliseconds to wait for a CALLRESULT/CALLERROR before treating a
   * sent CALL as timed out. */
  responseTimeoutMs?: number;
  /** WO-ARGOS-059 — keyed by OCPP action name (e.g.
   * 'RemoteStartTransaction'). An action with no entry here defaults to a
   * plain Accepted. */
  commandResponses?: Partial<Record<string, SimulatorCommandOutcome>>;
  /** Observability-only hook, fired whenever an incoming server-originated
   * CALL is received, right after respondToIncomingCall decides (but
   * regardless of) the outcome — never changes what gets sent back. Used by
   * the interactive CLI (--interactive) to print "Incoming X -> Accepted"
   * without touching the actual response logic above. `payload` is the
   * incoming CALL's own params (e.g. idTag/connectorId/transactionId) —
   * never the OCPP Basic Auth secret, which only ever appears in the
   * WebSocket upgrade header at connect() time and is never part of any
   * message payload. */
  onIncomingCall?: (
    action: string,
    outcome: SimulatorCommandOutcome,
    payload: Record<string, unknown>,
  ) => void;
}
