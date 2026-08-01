import { Injectable, NotFoundException } from '@nestjs/common';
import type { ChargingSession, MeterValue } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import type { ListSessionsQueryDto } from './dto/list-sessions-query.dto';

/**
 * Read-only query surface over ChargingSession — the write path
 * (creation, transitions) belongs entirely to SessionLifecycleService,
 * called only from OCPP domain handlers, never from this service or its
 * controller. GET /sessions is organization-scoped directly (not through
 * a Site/ChargingStation join like the charging-core list endpoints) —
 * ChargingSession stores organizationId on the row itself (CAP-004_
 * CHARGING_SESSIONS_FOUNDATION.md §2's documented denormalization), so
 * this is a single indexed WHERE, not the expensive join ARGOS's earlier
 * ruling against org-wide list-all endpoints (WO-ARGOS-005) was cautious
 * about for Station/Evse/Connector.
 */
@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    organizationId: string,
    query: ListSessionsQueryDto,
  ): Promise<ChargingSession[]> {
    return this.prisma.chargingSession.findMany({
      where: {
        organizationId,
        ...(query.siteId ? { siteId: query.siteId } : {}),
        ...(query.chargingStationId
          ? { chargingStationId: query.chargingStationId }
          : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: query.limit ?? 50,
    });
  }

  async getById(organizationId: string, id: string): Promise<ChargingSession> {
    const session = await this.prisma.chargingSession.findFirst({
      where: { id, organizationId },
    });
    if (!session) {
      throw new NotFoundException('Sesión de carga no encontrada');
    }
    return session;
  }

  async listMeterValues(
    organizationId: string,
    sessionId: string,
  ): Promise<MeterValue[]> {
    // Verifies ownership first — a session in another organization is
    // indistinguishable from a non-existent one, same "not found, not
    // forbidden" pattern used throughout this codebase.
    await this.getById(organizationId, sessionId);
    return this.prisma.meterValue.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });
  }
}
