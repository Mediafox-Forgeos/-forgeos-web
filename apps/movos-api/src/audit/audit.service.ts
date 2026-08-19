import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  action: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an audit event. Failures are logged but never propagated: audit
   * logging must not break the primary operation. Accepts an optional
   * interactive-transaction client (WO-ARGOS-063: SessionLifecycleService's
   * createSession records SESSION_ABANDONED_ON_NEW_TRANSACTION from inside
   * its own SERIALIZABLE transaction, so the audit write rolls back together
   * with the FAILED transition on a serialization conflict) — defaults to
   * the regular PrismaService for every other caller, unchanged.
   */
  async record(
    input: AuditInput,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    try {
      await client.auditEvent.create({
        data: {
          action: input.action,
          organizationId: input.organizationId ?? null,
          actorUserId: input.actorUserId ?? null,
          subjectType: input.subjectType ?? null,
          subjectId: input.subjectId ?? null,
          metadata: input.metadata ?? undefined,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit event ${input.action}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
