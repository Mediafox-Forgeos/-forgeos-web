import { Injectable, Logger } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationAttemptsService } from '../../authorization/authorization-attempts.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { idTagStatusFor } from '../normalization/id-tag-status-mapping';
import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * OCPP StartTransaction — the only entry point that creates a
 * ChargingSession (DEC-014). Resolves the connector, records an
 * AuthorizationAttempt for the idTag, and only proceeds to
 * SessionLifecycleService.createSession() when that attempt is ACCEPTED
 * or OFFLINE_ACCEPTED. A rejected attempt never creates a session. See
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md §5/§8.
 */
@Injectable()
export class TransactionStartHandler {
  private readonly logger = new Logger(TransactionStartHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AuthorizationAttemptsService,
    private readonly sessionLifecycle: SessionLifecycleService,
  ) {}

  async handle(
    event: Extract<NormalizedInboundEvent, { type: 'TransactionStart' }>,
    station: ChargingStation,
  ): Promise<DomainResult> {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: station.siteId },
      select: { organizationId: true },
    });

    const connector = await this.prisma.connector.findFirst({
      where: {
        externalId: event.connectorExternalId,
        evse: { chargingStationId: station.id },
      },
    });

    if (!connector) {
      this.logger.warn(
        `StartTransaction for unknown connector externalId=${event.connectorExternalId} on station ${station.id}`,
      );
      // Still recorded — "every authorization attempt must be stored" even
      // when the connector it was presented at can't be resolved.
      await this.attempts.recordAttempt({
        organizationId: site.organizationId,
        chargingStationId: station.id,
        presentedIdentifier: event.idTag,
      });
      return { status: 'Rejected', payload: { idTagStatus: 'Invalid' } };
    }

    const { attempt } = await this.attempts.recordAttempt({
      organizationId: site.organizationId,
      chargingStationId: station.id,
      evseId: connector.evseId,
      connectorId: connector.id,
      presentedIdentifier: event.idTag,
    });

    const accepted =
      attempt.result === 'ACCEPTED' || attempt.result === 'OFFLINE_ACCEPTED';
    if (!accepted || !attempt.authorizationCredentialId) {
      return {
        status: 'Rejected',
        payload: { idTagStatus: idTagStatusFor(attempt.result) },
      };
    }

    const session = await this.sessionLifecycle.createSession({
      organizationId: site.organizationId,
      siteId: station.siteId,
      chargingStationId: station.id,
      evseId: connector.evseId,
      connectorId: connector.id,
      authorizationCredentialId: attempt.authorizationCredentialId,
      protocolVersion: event.protocolVersion,
      meterStart: event.meterStart,
      startedAt: new Date(event.timestamp),
    });

    return {
      status: 'Accepted',
      payload: {
        idTagStatus: 'Accepted',
        protocolTransactionId: session.protocolTransactionId,
        sessionId: session.id,
      },
    };
  }
}
