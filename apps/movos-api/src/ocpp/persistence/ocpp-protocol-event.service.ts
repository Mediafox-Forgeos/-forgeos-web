import { Injectable, Logger } from '@nestjs/common';
import {
  OcppMessageDirection,
  OcppMessageType,
  OcppProcessingStatus,
  type OcppProtocolVersion as PrismaOcppProtocolVersion,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import type { OcppProtocolVersion } from '../protocol/common/normalized-events';

export interface RecordEventInput {
  chargingStationId: string | null;
  protocolVersion: OcppProtocolVersion;
  direction: OcppMessageDirection;
  messageType: OcppMessageType;
  action?: string | null;
  protocolMessageId?: string | null;
  payload: unknown;
  processingStatus: OcppProcessingStatus;
  processingError?: string | null;
  correlationId?: string | null;
}

// Structural safety net: OCPP credentials travel in the WebSocket upgrade
// header, never inside a message payload, so this should never trigger in
// practice — kept as defense in depth per this work order's explicit
// "payload storage must avoid accidental persistence of secrets"
// requirement, not because a real code path is expected to hit it.
const SECRET_LIKE_KEY = /secret|password|authorization|token/i;

function scrubPayload(payload: unknown): unknown {
  if (payload === null || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.map(scrubPayload);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    payload as Record<string, unknown>,
  )) {
    result[key] = SECRET_LIKE_KEY.test(key)
      ? '[REDACTED]'
      : scrubPayload(value);
  }
  return result;
}

/**
 * Append-only raw protocol-event log (CAP-003 Architecture Decisions
 * Decision 5, ADR-0011). Every inbound and outbound frame is written here
 * regardless of outcome — success, UnsupportedMessage, or a malformed
 * frame — so unsupported-feature handling is auditable, not a silent black
 * hole. See the retention-policy comment on the OcppProtocolEvent Prisma
 * model and docs/engineering/OCPP_ENGINE_GUIDE.md.
 *
 * Failures here are logged, never thrown — exactly like AuditService,
 * logging must not break the primary protocol exchange.
 */
@Injectable()
export class OcppProtocolEventService {
  private readonly logger = new Logger(OcppProtocolEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordEventInput): Promise<void> {
    try {
      await this.prisma.ocppProtocolEvent.create({
        data: {
          chargingStationId: input.chargingStationId,
          protocolVersion: input.protocolVersion as PrismaOcppProtocolVersion,
          direction: input.direction,
          messageType: input.messageType,
          action: input.action ?? null,
          protocolMessageId: input.protocolMessageId ?? null,
          payload: scrubPayload(input.payload) as never,
          processingStatus: input.processingStatus,
          processingError: input.processingError ?? null,
          correlationId: input.correlationId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to record OCPP protocol event',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
