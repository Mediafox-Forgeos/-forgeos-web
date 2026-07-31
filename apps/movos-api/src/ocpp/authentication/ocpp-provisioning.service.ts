import { randomBytes, randomUUID } from 'node:crypto';

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';

// Matches the seed/auth convention already established in this codebase
// (prisma/seed.ts) — not a CAP-003 invention.
const BCRYPT_ROUNDS = 12;

export interface ProvisioningResult {
  ocppIdentity: string;
  /** Plaintext secret — returned exactly once, at provisioning/rotation
   * time. Never persisted, never logged, never retrievable again after
   * this call returns. Callers must display and discard it. */
  plaintextSecret: string;
}

/**
 * Device provisioning and secret lifecycle (CAP-003 Architecture Decisions
 * Decision 1 + 2, ADR-0010). All three operations here are audited, and
 * revocation forcibly disconnects any live connection under the affected
 * identity — see docs/engineering/OCPP_DEVICE_PROVISIONING_GUIDE.md and
 * docs/engineering/OCPP_SECRET_ROTATION_GUIDE.md.
 */
@Injectable()
export class OcppProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly connectionRegistry: ConnectionRegistryService,
  ) {}

  async provision(
    organizationId: string,
    actorUserId: string,
    chargingStationId: string,
  ): Promise<ProvisioningResult> {
    const station = await this.getOwnedStation(
      organizationId,
      chargingStationId,
    );

    if (station.ocppIdentity) {
      throw new ConflictException(
        'Esta estación de carga ya tiene una identidad OCPP asignada. Usa la rotación de secreto en lugar de re-provisionar.',
      );
    }

    const ocppIdentity = generateOcppIdentity();
    const plaintextSecret = generateSecret();
    const ocppSecretHash = await bcrypt.hash(plaintextSecret, BCRYPT_ROUNDS);

    await this.prisma.chargingStation.update({
      where: { id: chargingStationId },
      data: {
        ocppIdentity,
        ocppSecretHash,
        ocppProvisionedAt: new Date(),
        ocppRevokedAt: null,
      },
    });

    await this.audit.record({
      action: 'OCPP_STATION_PROVISIONED',
      organizationId,
      actorUserId,
      subjectType: 'ChargingStation',
      subjectId: chargingStationId,
      metadata: { ocppIdentity },
    });

    return { ocppIdentity, plaintextSecret };
  }

  async rotateSecret(
    organizationId: string,
    actorUserId: string,
    chargingStationId: string,
  ): Promise<ProvisioningResult> {
    const station = await this.getOwnedStation(
      organizationId,
      chargingStationId,
    );

    if (!station.ocppIdentity) {
      throw new NotFoundException(
        'Esta estación de carga no ha sido provisionada para OCPP todavía.',
      );
    }

    const plaintextSecret = generateSecret();
    const ocppSecretHash = await bcrypt.hash(plaintextSecret, BCRYPT_ROUNDS);

    await this.prisma.chargingStation.update({
      where: { id: chargingStationId },
      data: { ocppSecretHash, ocppSecretRotatedAt: new Date() },
    });

    await this.audit.record({
      action: 'OCPP_SECRET_ROTATED',
      organizationId,
      actorUserId,
      subjectType: 'ChargingStation',
      subjectId: chargingStationId,
      metadata: { ocppIdentity: station.ocppIdentity },
    });

    return { ocppIdentity: station.ocppIdentity, plaintextSecret };
  }

  async revoke(
    organizationId: string,
    actorUserId: string,
    chargingStationId: string,
  ): Promise<void> {
    const station = await this.getOwnedStation(
      organizationId,
      chargingStationId,
    );

    if (!station.ocppIdentity) {
      throw new NotFoundException(
        'Esta estación de carga no ha sido provisionada para OCPP todavía.',
      );
    }

    await this.prisma.chargingStation.update({
      where: { id: chargingStationId },
      data: { ocppRevokedAt: new Date() },
    });

    // Revocation must take effect immediately, not just on the device's
    // next connection attempt — force-close any live connection under this
    // identity right now.
    this.connectionRegistry.forceDisconnect(station.ocppIdentity, 'revoked');

    await this.audit.record({
      action: 'OCPP_STATION_REVOKED',
      organizationId,
      actorUserId,
      subjectType: 'ChargingStation',
      subjectId: chargingStationId,
      metadata: { ocppIdentity: station.ocppIdentity },
    });
  }

  private async getOwnedStation(
    organizationId: string,
    chargingStationId: string,
  ) {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: chargingStationId, site: { organizationId } },
    });
    if (!station) {
      throw new NotFoundException('Estación de carga no encontrada');
    }
    return station;
  }
}

/** Human-legible but not guessable — a short random suffix keeps the value
 * short enough to type/scan during physical provisioning while remaining
 * effectively unguessable when combined with the secret. Never derived from
 * code/serialNumber/id — see CAP-003 Architecture Decisions Decision 1. */
function generateOcppIdentity(): string {
  return `movos-${randomUUID().split('-')[0]}`;
}

/** 256 bits of entropy, base64url-encoded — a strong per-station secret,
 * never reused across stations. */
function generateSecret(): string {
  return randomBytes(32).toString('base64url');
}
