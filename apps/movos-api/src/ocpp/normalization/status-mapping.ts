import { ConnectorStatus, EvseStatus } from '@prisma/client';

import type { NormalizedDeviceStatus } from '../protocol/common/normalized-events';

/**
 * Maps the richer, protocol-derived NormalizedDeviceStatus vocabulary onto
 * the existing CAP-002 7-value Prisma enums (EvseStatus/ConnectorStatus).
 * This is a deliberate, lossy simplification — the CAP-003 readiness note
 * flagged that OCPP 1.6's ChargePointStatus has finer-grained values than
 * the existing enum; rather than expanding the Prisma enum (a CAP-002
 * schema change out of this work order's scope) or inventing a second
 * status vocabulary on the entities, several protocol states collapse onto
 * the same domain value: PREPARING/SUSPENDED_EV/SUSPENDED_EVSE/FINISHING
 * all mean "a vehicle is present and the connector is not free for another
 * session," which is exactly what OCCUPIED already means in this schema.
 *
 * See docs/domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md — Decision 5's
 * field-classification table for which fields this normalization writes to.
 */
const EVSE_STATUS_MAP: Record<NormalizedDeviceStatus, EvseStatus> = {
  AVAILABLE: EvseStatus.AVAILABLE,
  PREPARING: EvseStatus.OCCUPIED,
  CHARGING: EvseStatus.CHARGING,
  SUSPENDED_EV: EvseStatus.OCCUPIED,
  SUSPENDED_EVSE: EvseStatus.OCCUPIED,
  FINISHING: EvseStatus.OCCUPIED,
  RESERVED: EvseStatus.RESERVED,
  UNAVAILABLE: EvseStatus.UNAVAILABLE,
  FAULTED: EvseStatus.FAULTED,
  OFFLINE: EvseStatus.OFFLINE,
};

export function mapToEvseStatus(status: NormalizedDeviceStatus): EvseStatus {
  return EVSE_STATUS_MAP[status];
}

// EvseStatus and ConnectorStatus share the exact same value set (see the
// schema.prisma comment on ConnectorStatus) — same mapping values, but a
// distinct table and function so a future divergence between the two enums
// doesn't require silently reinterpreting one mapping table for two
// purposes, and so no unsafe cast is needed between the two enum types.
const CONNECTOR_STATUS_MAP: Record<NormalizedDeviceStatus, ConnectorStatus> = {
  AVAILABLE: ConnectorStatus.AVAILABLE,
  PREPARING: ConnectorStatus.OCCUPIED,
  CHARGING: ConnectorStatus.CHARGING,
  SUSPENDED_EV: ConnectorStatus.OCCUPIED,
  SUSPENDED_EVSE: ConnectorStatus.OCCUPIED,
  FINISHING: ConnectorStatus.OCCUPIED,
  RESERVED: ConnectorStatus.RESERVED,
  UNAVAILABLE: ConnectorStatus.UNAVAILABLE,
  FAULTED: ConnectorStatus.FAULTED,
  OFFLINE: ConnectorStatus.OFFLINE,
};

export function mapToConnectorStatus(
  status: NormalizedDeviceStatus,
): ConnectorStatus {
  return CONNECTOR_STATUS_MAP[status];
}
