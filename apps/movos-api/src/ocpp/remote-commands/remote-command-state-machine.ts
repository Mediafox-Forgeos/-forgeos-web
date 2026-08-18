import { RemoteCommandState } from '@prisma/client';

import { InvalidRemoteCommandTransitionError } from './remote-command.errors';

/**
 * WO-ARGOS-058/059 — the command lifecycle, preserving the three-layer
 * separation established across WO-056/058:
 *
 *   REQUESTED, SENT           — transport-layer facts (did we try, did it go out)
 *   ACCEPTED, REJECTED,
 *   TIMED_OUT                 — OCPP protocol acceptance (did the charger say yes)
 *   CONFIRMED, UNCONFIRMED    — real-world outcome (did the expected inbound
 *                                signal actually arrive — e.g. StartTransaction
 *                                for a RemoteStart). Never inferred from
 *                                ACCEPTED alone; reached only via an explicit
 *                                confirm/unconfirm call from domain-specific
 *                                corroboration logic, which is out of scope
 *                                for WO-059 itself (no command is exposed to
 *                                production yet) — the state and its
 *                                transition exist and are tested here so a
 *                                future work order wiring real corroboration
 *                                doesn't have to touch this table again.
 *
 * Deliberately NOT the example names ARGOS's own WO-058 review floated
 * (CREATED/QUEUED/FAILED) — QUEUED doesn't exist because V1 has no offline
 * queue (WO-058 decision), and FAILED is split into REJECTED/TIMED_OUT/
 * UNCONFIRMED because an operator and an engineer need to tell those three
 * failure modes apart, not lump them together.
 *
 * Mirrors session-lifecycle.service.ts's ALLOWED_TRANSITIONS precedent
 * exactly: an explicit table, an assert helper, a dedicated error class —
 * an invalid transition fails loudly rather than silently overwriting
 * command state.
 */
export const ALLOWED_TRANSITIONS: Record<
  RemoteCommandState,
  RemoteCommandState[]
> = {
  [RemoteCommandState.REQUESTED]: [
    RemoteCommandState.SENT,
    // Pre-send guardrail failure (station offline, target already has an
    // in-flight command, etc.) — rejected before ever reaching the wire.
    RemoteCommandState.REJECTED,
  ],
  [RemoteCommandState.SENT]: [
    RemoteCommandState.ACCEPTED,
    // CALLERROR, or a CALLRESULT explicitly carrying status: Rejected.
    RemoteCommandState.REJECTED,
    // No CALLRESULT/CALLERROR arrived within the response window.
    RemoteCommandState.TIMED_OUT,
  ],
  [RemoteCommandState.ACCEPTED]: [
    RemoteCommandState.CONFIRMED,
    RemoteCommandState.UNCONFIRMED,
  ],
  // Terminal — no outgoing transitions, same "cannot finish twice"
  // guarantee ChargingSessionStatus's terminal states provide.
  [RemoteCommandState.REJECTED]: [],
  [RemoteCommandState.TIMED_OUT]: [],
  [RemoteCommandState.CONFIRMED]: [],
  [RemoteCommandState.UNCONFIRMED]: [],
};

export const TERMINAL_REMOTE_COMMAND_STATES = new Set<RemoteCommandState>([
  RemoteCommandState.REJECTED,
  RemoteCommandState.TIMED_OUT,
  RemoteCommandState.CONFIRMED,
  RemoteCommandState.UNCONFIRMED,
]);

/** Non-terminal — a physical target (station, or station+connector) may
 * have at most one RemoteCommand in one of these at a time. See
 * RemoteCommandService's concurrency guard. */
export const NON_TERMINAL_REMOTE_COMMAND_STATES: RemoteCommandState[] = [
  RemoteCommandState.REQUESTED,
  RemoteCommandState.SENT,
  RemoteCommandState.ACCEPTED,
];

export function assertRemoteCommandTransitionAllowed(
  from: RemoteCommandState,
  to: RemoteCommandState,
): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidRemoteCommandTransitionError(from, to);
  }
}

export function canTransitionRemoteCommand(
  from: RemoteCommandState,
  to: RemoteCommandState,
): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
