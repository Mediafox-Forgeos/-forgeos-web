import type { ConnectivityStatus, ConnectorStatus } from '@prisma/client';

/**
 * WO-ARGOS-056 — EVSE Operational Status. A pure, dependency-free
 * calculator: it never touches Prisma, never persists anything, and never
 * writes to Evse.status/Connector.status. It only *reads* real, already-
 * fetched evidence (station connectivity, real Connector.status values,
 * real ChargingSession presence) and derives a read-time-only answer to
 * "what's this charger's operational situation right now" — the third of
 * the three architectural layers this work order requires kept separate:
 *
 *   1. Administrative Status  — ChargingStation.status, Evse.status
 *   2. Protocol/Observed      — ChargingStation.connectivityStatus,
 *                                Connector.status, ChargingSession.status
 *   3. Operational Status     — this file. Derived, never persisted, never
 *                                overwrites layers 1/2.
 */

export type OperationalStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'PARTIALLY_AVAILABLE'
  | 'UNAVAILABLE'
  | 'OFFLINE'
  | 'UNKNOWN';

export type AttentionReason =
  'CONNECTOR_FAULTED' | 'ACTIVE_SESSION_CONNECTOR_NOT_IN_USE';

export interface ConnectorEvidence {
  status: ConnectorStatus;
  /**
   * Whether a real, non-terminal ChargingSession currently exists on this
   * exact connector — ACTIVE, SUSPENDED, or OFFLINE (the two suspension
   * variants both mean "logically active, temporarily not delivering
   * energy," per the existing session-lifecycle documentation). Deliberately
   * not PENDING/AUTHORIZED/STARTING — those precede a session actually
   * existing under CAP-004's model (StartTransaction is the only entry
   * point that creates one).
   */
  hasActiveSession: boolean;
}

export interface EvseOperationalStatusInput {
  /** ChargingStation.connectivityStatus of this EVSE's parent station —
   * has absolute precedence over everything else (WO-ARGOS-056 Decision 2). */
  connectivityStatus: ConnectivityStatus;
  connectors: ConnectorEvidence[];
}

export interface ConnectorSummary {
  total: number;
  available: number;
  inUse: number;
  unavailable: number;
  faulted: number;
}

export interface EvseOperationalStatusResult {
  operationalStatus: OperationalStatus;
  requiresAttention: boolean;
  attentionReasons: AttentionReason[];
  connectorSummary: ConnectorSummary;
}

const IN_USE_STATUSES = new Set<ConnectorStatus>(['CHARGING', 'OCCUPIED']);

function summarize(connectors: ConnectorEvidence[]): ConnectorSummary {
  const summary: ConnectorSummary = {
    total: connectors.length,
    available: 0,
    inUse: 0,
    unavailable: 0,
    faulted: 0,
  };
  for (const c of connectors) {
    if (c.status === 'AVAILABLE') summary.available++;
    else if (IN_USE_STATUSES.has(c.status)) summary.inUse++;
    else if (c.status === 'FAULTED') summary.faulted++;
    else summary.unavailable++; // UNAVAILABLE, RESERVED, OFFLINE
  }
  return summary;
}

/**
 * ONLINE-branch derivation. The four base rules WO-ARGOS-056 specified
 * (all AVAILABLE / all CHARGING-OCCUPIED / all UNAVAILABLE-FAULTED-RESERVED
 * / mixed AVAILABLE+CHARGING-OCCUPIED) plus two evidence sources it added
 * afterward — FAULTED connectors, and a ChargingSession that disagrees with
 * its own connector's status — don't reduce to one written formula without
 * combining all of the examples WO-ARGOS-056 gave (base rules + QA list +
 * the Digital Twin validation walkthrough). The reconciled rule implemented
 * here, verified against every example given:
 *
 *   - A session on a connector "promotes" that connector to effectively
 *     in-use for this computation (even if its own raw status hasn't
 *     caught up yet) — Discovery 4 Option B, "trust the session" — and
 *     flags ACTIVE_SESSION_CONNECTOR_NOT_IN_USE when it disagrees with the
 *     raw status. Connector.status itself is never modified.
 *   - hasAvailable+hasInUse -> PARTIALLY_AVAILABLE (explicit base rule).
 *   - hasAvailable+hasFaulted (no in-use) -> ALSO PARTIALLY_AVAILABLE
 *     (explicit in the required QA list: "ONLINE + AVAILABLE + FAULTED ->
 *     PARTIALLY_AVAILABLE + requiresAttention").
 *   - hasAvailable alone, or hasAvailable + plain UNAVAILABLE/RESERVED
 *     (no in-use, no fault) -> AVAILABLE. This is what the Digital Twin
 *     validation section explicitly expects for Connector 1 AVAILABLE +
 *     Connector 2 UNAVAILABLE -> AVAILABLE, not PARTIALLY_AVAILABLE — a
 *     plain out-of-service connector sitting next to a real available one
 *     does not degrade "can this charger serve a car right now," unlike a
 *     FAULTED connector (attention-worthy) or one actively occupied.
 *   - !hasAvailable && hasInUse -> IN_USE (covers "all CHARGING/OCCUPIED"
 *     and any other combination with zero AVAILABLE and at least one
 *     in-use connector, e.g. CHARGING + plain UNAVAILABLE).
 *   - anything else (no AVAILABLE, no in-use) -> UNAVAILABLE.
 */
function deriveOnlineStatus(
  connectors: ConnectorEvidence[],
): Omit<EvseOperationalStatusResult, 'connectorSummary'> {
  const attentionReasons: AttentionReason[] = [];
  let hasAvailable = false;
  let hasInUse = false;
  let hasFaulted = false;

  for (const c of connectors) {
    const rawInUse = IN_USE_STATUSES.has(c.status);
    const mismatch = c.hasActiveSession && !rawInUse;
    if (mismatch) attentionReasons.push('ACTIVE_SESSION_CONNECTOR_NOT_IN_USE');
    if (c.status === 'FAULTED') {
      hasFaulted = true;
      attentionReasons.push('CONNECTOR_FAULTED');
    }

    const effectiveInUse = rawInUse || c.hasActiveSession;
    const effectiveAvailable = c.status === 'AVAILABLE' && !c.hasActiveSession;

    if (effectiveInUse) hasInUse = true;
    if (effectiveAvailable) hasAvailable = true;
  }

  let operationalStatus: OperationalStatus;
  if (hasAvailable && (hasInUse || hasFaulted)) {
    operationalStatus = 'PARTIALLY_AVAILABLE';
  } else if (!hasAvailable && hasInUse) {
    operationalStatus = 'IN_USE';
  } else if (hasAvailable) {
    operationalStatus = 'AVAILABLE';
  } else {
    operationalStatus = 'UNAVAILABLE';
  }

  return {
    operationalStatus,
    requiresAttention: attentionReasons.length > 0,
    attentionReasons,
  };
}

export function computeEvseOperationalStatus(
  input: EvseOperationalStatusInput,
): EvseOperationalStatusResult {
  const connectorSummary = summarize(input.connectors);

  // Connectivity has absolute precedence (WO-ARGOS-056 Decision 2). Neither
  // branch presents connector evidence as CURRENT fact — the caller is
  // responsible for framing it as last-known-state in the UI, not this
  // calculator's job (it has no timestamps to reason about freshness with).
  if (input.connectivityStatus === 'OFFLINE') {
    return {
      operationalStatus: 'OFFLINE',
      requiresAttention: false,
      attentionReasons: [],
      connectorSummary,
    };
  }
  if (input.connectivityStatus === 'UNKNOWN') {
    return {
      operationalStatus: 'UNKNOWN',
      requiresAttention: false,
      attentionReasons: [],
      connectorSummary,
    };
  }

  // ONLINE from here on.
  if (input.connectors.length === 0) {
    return {
      operationalStatus: 'UNKNOWN',
      requiresAttention: false,
      attentionReasons: [],
      connectorSummary,
    };
  }

  const { operationalStatus, requiresAttention, attentionReasons } =
    deriveOnlineStatus(input.connectors);
  return {
    operationalStatus,
    requiresAttention,
    attentionReasons,
    connectorSummary,
  };
}
