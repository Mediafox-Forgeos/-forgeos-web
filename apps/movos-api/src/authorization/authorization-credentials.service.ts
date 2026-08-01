import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type AuthorizationCredential } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateCredentialDto } from './dto/create-credential.dto';

/**
 * CRUD/lifecycle for AuthorizationCredential — see
 * docs/domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md and
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md. Deliberately no
 * "update" beyond revoke: a credential's externalIdentifier/type are not
 * mutable once issued (a replacement is a new credential — see the
 * Authorization Architecture's "Replacement" section), matching the
 * established "append resolution, don't silently rewrite" discipline.
 */
@Injectable()
export class AuthorizationCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    dto: CreateCredentialDto,
  ): Promise<AuthorizationCredential> {
    try {
      const credential = await this.prisma.authorizationCredential.create({
        data: {
          organizationId,
          type: dto.type,
          externalIdentifier: dto.externalIdentifier,
          issuedAt: new Date(),
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
          metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        },
      });

      await this.audit.record({
        action: 'AUTHORIZATION_CREDENTIAL_ISSUED',
        organizationId,
        actorUserId: userId,
        subjectType: 'AuthorizationCredential',
        subjectId: credential.id,
        metadata: { type: credential.type },
      });

      return credential;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una credencial con ese externalIdentifier en esta organización',
        );
      }
      throw error;
    }
  }

  async list(organizationId: string): Promise<AuthorizationCredential[]> {
    return this.prisma.authorizationCredential.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<AuthorizationCredential> {
    const credential = await this.prisma.authorizationCredential.findFirst({
      where: { id, organizationId },
    });
    if (!credential) {
      throw new NotFoundException('Credencial de autorización no encontrada');
    }

    const revoked = await this.prisma.authorizationCredential.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await this.audit.record({
      action: 'AUTHORIZATION_CREDENTIAL_REVOKED',
      organizationId,
      actorUserId: userId,
      subjectType: 'AuthorizationCredential',
      subjectId: id,
    });

    return revoked;
  }
}
