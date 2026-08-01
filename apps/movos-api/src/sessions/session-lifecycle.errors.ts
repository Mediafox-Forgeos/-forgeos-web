import type { ChargingSessionStatus } from '@prisma/client';

export class InvalidSessionTransitionError extends Error {
  constructor(from: ChargingSessionStatus, to: ChargingSessionStatus) {
    super(`Cannot transition a ChargingSession from ${from} to ${to}`);
    this.name = 'InvalidSessionTransitionError';
  }
}
