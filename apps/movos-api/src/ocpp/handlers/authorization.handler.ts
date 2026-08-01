import { Injectable } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuthorizationAttemptsService } from '../../authorization/authorization-attempts.service';
import { idTagStatusFor } from '../normalization/id-tag-status-mapping';
import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * OCPP Authorize — records exactly one AuthorizationAttempt and nothing
 * else. Per DEC-014, authorization alone never creates a ChargingSession;
 * that only happens from TransactionStartHandler. See
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md §5.
 */
@Injectable()
export class AuthorizationHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attempts: AuthorizationAttemptsService,
  ) {}

  async handle(
    event: Extract<NormalizedInboundEvent, { type: 'Authorization' }>,
    station: ChargingStation,
  ): Promise<DomainResult> {
    const site = await this.prisma.site.findUniqueOrThrow({
      where: { id: station.siteId },
      select: { organizationId: true },
    });

    const { attempt } = await this.attempts.recordAttempt({
      organizationId: site.organizationId,
      chargingStationId: station.id,
      presentedIdentifier: event.idTag,
    });

    const accepted =
      attempt.result === 'ACCEPTED' || attempt.result === 'OFFLINE_ACCEPTED';

    return {
      status: accepted ? 'Accepted' : 'Rejected',
      payload: { idTagStatus: idTagStatusFor(attempt.result) },
    };
  }
}
