import type { OcppProtocolVersion } from './normalized-events';

/**
 * OCPP has no in-band version-negotiation handshake; version is selected
 * via the WebSocket subprotocol header (Sec-WebSocket-Protocol), which is
 * the mechanism both 1.6J and 2.0.1 charge points use. A connection that
 * doesn't declare a recognized subprotocol is rejected at the transport
 * layer before any adapter is invoked — see docs/domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md.
 */
const SUBPROTOCOL_TO_VERSION: Record<string, OcppProtocolVersion> = {
  'ocpp1.6': 'OCPP1_6J',
  'ocpp2.0.1': 'OCPP2_0_1',
};

export function detectProtocolVersion(
  requestedSubprotocols: readonly string[],
): OcppProtocolVersion | null {
  for (const subprotocol of requestedSubprotocols) {
    const version = SUBPROTOCOL_TO_VERSION[subprotocol.trim().toLowerCase()];
    if (version) return version;
  }
  return null;
}

export function subprotocolFor(version: OcppProtocolVersion): string {
  const entry = Object.entries(SUBPROTOCOL_TO_VERSION).find(
    ([, v]) => v === version,
  );
  if (!entry) throw new Error(`No subprotocol registered for ${version}`);
  return entry[0];
}
