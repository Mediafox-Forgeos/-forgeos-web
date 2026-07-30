import { Injectable, Logger } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';

export type AuthenticationFailureReason =
  'unknown_identity' | 'revoked' | 'not_provisioned' | 'invalid_credentials';

export type AuthenticationResult =
  | { ok: true; station: ChargingStation }
  | { ok: false; reason: AuthenticationFailureReason };

/**
 * Connection-time credential verification (CAP-003 Architecture Decisions
 * Decision 2, ADR-0010). WSS + HTTP Basic Auth: username is the
 * ocppIdentity (redundant with the URL path by convention, but required by
 * the Basic Auth scheme), password is the per-station secret, checked
 * against the bcrypt hash — never compared in plaintext, never logged.
 */
@Injectable()
export class OcppAuthenticationService {
  private readonly logger = new Logger(OcppAuthenticationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async authenticate(
    ocppIdentity: string,
    providedSecret: string,
  ): Promise<AuthenticationResult> {
    const station = await this.prisma.chargingStation.findUnique({
      where: { ocppIdentity },
    });

    if (!station) {
      return { ok: false, reason: 'unknown_identity' };
    }
    if (station.ocppRevokedAt) {
      return { ok: false, reason: 'revoked' };
    }
    if (!station.ocppSecretHash) {
      return { ok: false, reason: 'not_provisioned' };
    }

    const matches = await bcrypt.compare(
      providedSecret,
      station.ocppSecretHash,
    );
    if (!matches) {
      // Deliberately no station identity, no secret fragment, nothing
      // credential-shaped in this log line — only that an attempt failed.
      this.logger.warn(`Rejected OCPP connection attempt: invalid credentials`);
      return { ok: false, reason: 'invalid_credentials' };
    }

    return { ok: true, station };
  }

  /** Decodes an HTTP Basic Authorization header into {identity, secret}, or
   * null if the header is missing/malformed. Never logs the decoded value. */
  static parseBasicAuthHeader(
    header: string | undefined,
  ): { identity: string; secret: string } | null {
    if (!header?.startsWith('Basic ')) return null;
    try {
      const decoded = Buffer.from(
        header.slice('Basic '.length),
        'base64',
      ).toString('utf8');
      const separatorIndex = decoded.indexOf(':');
      if (separatorIndex === -1) return null;
      return {
        identity: decoded.slice(0, separatorIndex),
        secret: decoded.slice(separatorIndex + 1),
      };
    } catch {
      return null;
    }
  }
}
