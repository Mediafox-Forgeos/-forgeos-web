import { Injectable } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * Deliberately does not write any business record. Last-seen liveness is
 * already tracked by ConnectionRegistryService.touch() (called by the
 * router for every inbound message, not just Heartbeat), and the raw
 * Heartbeat frame is already captured by the raw-event log — writing a
 * separate DB row per heartbeat here would be exactly the "unnecessary
 * business record" this work order's Phase 16 instruction warns against,
 * at a message frequency (every few minutes per station) that would add up
 * fast across a fleet.
 */
@Injectable()
export class HeartbeatHandler {
  handle(
    event: Extract<NormalizedInboundEvent, { type: 'Heartbeat' }>,
    _station: ChargingStation,
  ): DomainResult {
    void event;
    return { status: 'Accepted' };
  }
}
