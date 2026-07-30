import { Injectable } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * BootNotification never overwrites ChargingStation.manufacturer/model or
 * the administratively-set `protocol` field from device-reported boot
 * data — whether BootNotification should eventually confirm/overwrite
 * `protocol` is an explicitly open question (see CAP-003 Architecture
 * Decisions Decision 5's field-classification table), not resolved by this
 * handler. The full boot payload is already captured by the raw-event log
 * (OcppProtocolEventService, called by the router before this handler
 * runs) — that satisfies "store boot metadata where justified" without
 * creating a dual-writer risk on an administrative field.
 */
@Injectable()
export class BootNotificationHandler {
  handle(
    event: Extract<NormalizedInboundEvent, { type: 'DeviceBoot' }>,
    _station: ChargingStation,
  ): DomainResult {
    void event;
    return { status: 'Accepted' };
  }
}
