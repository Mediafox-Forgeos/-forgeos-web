import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  OcppMessageDirection,
  OcppMessageType,
  OcppProcessingStatus,
  type OcppProtocolEvent,
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

// A real OCPP frame (this column's actual data source, always via
// JSON.parse of a WS message) can never be circular or pathologically
// deep — this is a hard ceiling against a hypothetical malformed/adversarial
// object reaching this function some other way, not a case expected to
// trigger in practice.
const MAX_SCRUB_DEPTH = 20;

// WO-ARGOS-091 — exported so the read-side (listForStation) can apply the
// exact same rule again at read time, not a second, driftable copy. Defense
// in depth: this covers any row written before this scrubbing existed, or
// by a future write-path regression, not just the common case.
export function scrubPayload(payload: unknown, depth = 0): unknown {
  if (payload === null || typeof payload !== 'object') return payload;
  if (depth >= MAX_SCRUB_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(payload)) {
    return payload.map((item) => scrubPayload(item, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    payload as Record<string, unknown>,
  )) {
    result[key] = SECRET_LIKE_KEY.test(key)
      ? '[REDACTED]'
      : scrubPayload(value, depth + 1);
  }
  return result;
}

// WO-ARGOS-091 §5/§10 — a malformed or unusually large vendor payload (a
// misbehaving charger sending an oversized frame) must never produce an
// unbounded API response. Bounded on the *scrubbed* JSON size, not the raw
// payload, so truncation never accidentally cuts a redaction in half.
const MAX_PAYLOAD_JSON_LENGTH = 4000;

export function boundPayload(payload: unknown): unknown {
  const scrubbed = scrubPayload(payload);
  let json: string;
  try {
    json = JSON.stringify(scrubbed);
  } catch {
    // Not expected in practice (this column only ever holds values that
    // already round-tripped through JSON.parse on the way in), but a
    // defensive fallback rather than a 500 if it ever happens.
    return { truncated: true, reason: 'unserializable' };
  }
  if (json.length <= MAX_PAYLOAD_JSON_LENGTH) return scrubbed;
  return {
    truncated: true,
    originalLength: json.length,
    preview: json.slice(0, MAX_PAYLOAD_JSON_LENGTH),
  };
}

export const OCPP_EVENTS_DEFAULT_LIMIT = 50;
export const OCPP_EVENTS_MAX_LIMIT = 100;

export interface ListOcppEventsFilter {
  limit?: number;
  before?: Date;
  action?: string;
  direction?: OcppMessageDirection;
}

/**
 * Append-only raw protocol-event log (CAP-003 Architecture Decisions
 * Decision 5, ADR-0011), every inbound frame written here regardless of
 * outcome — success, UnsupportedMessage, or a malformed frame — so
 * unsupported-feature handling is auditable, not a silent black hole.
 *
 * WO-ARGOS-091 finding, corrected from this comment's own prior claim: as
 * of this WO, only INBOUND frames are ever recorded — no call site writes
 * an OUTBOUND row (verified by exhaustive search: `protocolEvents.record`
 * is only ever called from OcppMessageRouterService, always with
 * `direction: INBOUND`). A charger's *reply* to a MOVOS-initiated CALL
 * (e.g. the CALLRESULT/CALLERROR answering a RemoteStartTransaction) IS
 * captured, because that reply arrives inbound — but the outbound CALL
 * MOVOS actually sent is not independently visible here. See this WO's
 * implementation report for the full analysis; closing this gap (adding
 * OUTBOUND recording at the transport/RemoteCommand send sites) was
 * deliberately left as a follow-up rather than folded into this
 * read-model WO, which does not touch the OCPP write path. See the
 * retention-policy comment on the OcppProtocolEvent Prisma model and
 * docs/engineering/OCPP_ENGINE_GUIDE.md.
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

  /**
   * WO-ARGOS-091 — the support/operator read surface. Station id is
   * re-resolved within the caller's own organization before anything else
   * (same discipline as RemoteCommandService.listCommandsForConnector) —
   * a cross-tenant station id is indistinguishable from a nonexistent one.
   * Bounded by `take: limit + 1` (one extra row, never a separate COUNT
   * query) purely to let the caller know whether a next page exists.
   */
  async listForStation(
    organizationId: string,
    stationId: string,
    filter: ListOcppEventsFilter = {},
  ): Promise<{ events: OcppProtocolEvent[]; hasMore: boolean }> {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: stationId, site: { organizationId } },
      select: { id: true },
    });
    if (!station) {
      throw new NotFoundException('Estación no encontrada');
    }

    const limit = Math.min(
      filter.limit ?? OCPP_EVENTS_DEFAULT_LIMIT,
      OCPP_EVENTS_MAX_LIMIT,
    );

    const rows = await this.prisma.ocppProtocolEvent.findMany({
      where: {
        chargingStationId: stationId,
        ...(filter.action ? { action: filter.action } : {}),
        ...(filter.direction ? { direction: filter.direction } : {}),
        ...(filter.before ? { receivedAt: { lt: filter.before } } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: limit + 1,
    });

    return { events: rows.slice(0, limit), hasMore: rows.length > limit };
  }
}
