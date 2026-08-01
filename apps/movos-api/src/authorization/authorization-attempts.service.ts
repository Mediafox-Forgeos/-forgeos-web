import { Injectable } from '@nestjs/common';
import {
  AuthAttemptResult,
  type AuthorizationAttempt,
  type AuthorizationCredential,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListAttemptsQueryDto } from './dto/list-attempts-query.dto';

export interface RecordAttemptInput {
  organizationId: string;
  chargingStationId: string;
  evseId?: string | null;
  connectorId?: string | null;
  presentedIdentifier: string;
  /** True when this attempt is being processed retroactively from a
   * buffered offline transaction (see CAP-004_CHARGING_SESSIONS_
   * FOUNDATION.md §5 / §15) — an otherwise-ACCEPTED resolution is recorded
   * as OFFLINE_ACCEPTED instead. */
  offline?: boolean;
}

export interface AttemptResolution {
  attempt: AuthorizationAttempt;
  credential: AuthorizationCredential | null;
}

/**
 * Resolves a presented identifier (e.g. an OCPP idTag) against
 * AuthorizationCredential and records exactly one AuthorizationAttempt row
 * per call — "every authorization attempt must be stored" (WO-ARGOS-009),
 * whether or not it resolves to a real credential. Never creates a
 * ChargingSession itself (DEC-014) — callers (AuthorizationHandler,
 * TransactionStartHandler) decide what to do with the result.
 */
@Injectable()
export class AuthorizationAttemptsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAttempt(input: RecordAttemptInput): Promise<AttemptResolution> {
    const credential = await this.prisma.authorizationCredential.findUnique({
      where: {
        organizationId_externalIdentifier: {
          organizationId: input.organizationId,
          externalIdentifier: input.presentedIdentifier,
        },
      },
    });

    const { result, reason } = this.resolve(credential, input.offline ?? false);

    const attempt = await this.prisma.authorizationAttempt.create({
      data: {
        organizationId: input.organizationId,
        chargingStationId: input.chargingStationId,
        evseId: input.evseId ?? null,
        connectorId: input.connectorId ?? null,
        authorizationCredentialId: credential?.id ?? null,
        presentedIdentifier: input.presentedIdentifier,
        result,
        reason,
      },
    });

    return { attempt, credential };
  }

  async list(
    organizationId: string,
    query: ListAttemptsQueryDto,
  ): Promise<AuthorizationAttempt[]> {
    return this.prisma.authorizationAttempt.findMany({
      where: {
        organizationId,
        ...(query.chargingStationId
          ? { chargingStationId: query.chargingStationId }
          : {}),
        ...(query.result ? { result: query.result } : {}),
      },
      orderBy: { attemptedAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  private resolve(
    credential: AuthorizationCredential | null,
    offline: boolean,
  ): { result: AuthAttemptResult; reason: string | null } {
    if (!credential) {
      return {
        result: AuthAttemptResult.UNKNOWN,
        reason: 'No matching credential',
      };
    }
    if (credential.status === 'REVOKED') {
      return {
        result: AuthAttemptResult.REVOKED,
        reason: 'Credential is revoked',
      };
    }
    if (credential.status === 'BLOCKED') {
      return {
        result: AuthAttemptResult.REJECTED,
        reason: 'Credential is blocked',
      };
    }
    if (credential.expiresAt && credential.expiresAt.getTime() < Date.now()) {
      return {
        result: AuthAttemptResult.EXPIRED,
        reason: 'Credential has expired',
      };
    }
    if (credential.status === 'EXPIRED') {
      return {
        result: AuthAttemptResult.EXPIRED,
        reason: 'Credential is expired',
      };
    }
    return {
      result: offline
        ? AuthAttemptResult.OFFLINE_ACCEPTED
        : AuthAttemptResult.ACCEPTED,
      reason: null,
    };
  }
}
