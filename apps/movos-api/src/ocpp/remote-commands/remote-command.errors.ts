import type { RemoteCommandState } from '@prisma/client';

/** Mirrors InvalidSessionTransitionError's exact precedent
 * (session-lifecycle.errors.ts) — a pure state-machine invariant, not an
 * HTTP-layer concern. Ownership failures use NotFoundException and the
 * concurrency guard uses ConflictException, matching every other service in
 * this codebase (see getOwnedChargingStation/ConnectorsService precedents)
 * rather than inventing parallel error types for those. */
export class InvalidRemoteCommandTransitionError extends Error {
  constructor(from: RemoteCommandState, to: RemoteCommandState) {
    super(`Cannot transition a RemoteCommand from ${from} to ${to}`);
    this.name = 'InvalidRemoteCommandTransitionError';
  }
}
