import type { OcppProtocolVersion } from '../protocol/common/normalized-events';

/**
 * Device connectivity — a distinct concept from every other status field
 * in this codebase. Deliberately not conflated with:
 *   - the WebSocket connected state (ConnectionRegistryService — a live,
 *     in-memory, transport-layer fact, never persisted);
 *   - ChargingStation.status (ChargingStationStatus — administrative
 *     lifecycle, e.g. DRAFT/ACTIVE/ARCHIVED, set by an operator);
 *   - Evse.status / Connector.status (operational availability, e.g.
 *     CHARGING/OCCUPIED, device-reported);
 *   - ChargingSession.status (business lifecycle, e.g. ACTIVE/COMPLETED).
 * See docs/domain/CAP-005_CONNECTIVITY_ENGINE.md §1.
 */
export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

/** What happened, at the connectivity layer — not what MOVOS decided to do
 * about it. `ConnectivityCoordinator` decides the consequence; this type
 * only names the fact. */
export type ConnectivityEventType =
  'CONNECTED' | 'DISCONNECTED' | 'STALE' | 'RECONNECTED';

export interface ConnectivityEvent {
  type: ConnectivityEventType;
  chargingStationId: string;
  ocppIdentity: string;
  /** Present for CONNECTED/RECONNECTED only. */
  protocolVersion?: OcppProtocolVersion;
  occurredAt: Date;
}
