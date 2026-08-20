import { Injectable, Logger } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { RemoteCommandConfirmationService } from '../remote-commands/remote-command-confirmation.service';
import { mapStopReasonToTerminationReason } from '../normalization/termination-reason-mapping';
import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * OCPP StopTransaction — resolves the ChargingSession by
 * (chargingStationId, protocolTransactionId) and calls
 * SessionLifecycleService.stopSession(). A retransmitted StopTransaction
 * for an already-COMPLETED session is a no-op, enforced by the lifecycle
 * engine's transition table (COMPLETED has no outgoing transitions), not
 * by a check here. See docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md
 * §6/§13.
 */
@Injectable()
export class TransactionEndHandler {
  private readonly logger = new Logger(TransactionEndHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionLifecycle: SessionLifecycleService,
    private readonly remoteCommandConfirmation: RemoteCommandConfirmationService,
  ) {}

  async handle(
    event: Extract<NormalizedInboundEvent, { type: 'TransactionEnd' }>,
    station: ChargingStation,
  ): Promise<DomainResult> {
    const session = await this.prisma.chargingSession.findFirst({
      where: {
        chargingStationId: station.id,
        protocolTransactionId: event.transactionRef,
      },
    });

    if (!session) {
      this.logger.warn(
        `StopTransaction for unknown transactionRef=${event.transactionRef} on station ${station.id}`,
      );
      return { status: 'Rejected' };
    }

    if (session.status === 'COMPLETED' || session.status === 'FAILED') {
      // Idempotent no-op — "a session cannot finish twice". Still an
      // Accepted response: from the device's point of view, the stop it
      // asked for has already happened.
      this.logger.log(
        `StopTransaction for already-terminal session ${session.id} (${session.status}) — no-op`,
      );
      return { status: 'Accepted' };
    }

    await this.sessionLifecycle.stopSession(session.id, {
      meterStop: event.meterStop,
      reason: mapStopReasonToTerminationReason(event.reason),
      endedAt: new Date(event.timestamp),
    });

    // WO-ARGOS-064 — observed-outcome corroboration for RemoteStop. A
    // no-op for the overwhelming majority of StopTransactions (no ACCEPTED
    // RemoteCommand exists for this exact session). Never mutates
    // ChargingSession itself — stopSession above is the sole authority for
    // that, already called and already returned.
    await this.remoteCommandConfirmation.onStopTransactionObserved(session.id);

    return { status: 'Accepted' };
  }
}
