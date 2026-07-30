import type { OcppProtocolVersion } from '../protocol/common/normalized-events';

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
}
