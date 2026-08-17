import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ChargingStation, type Evse } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateEvseDto } from './dto/create-evse.dto';
import type { UpdateEvseDto } from './dto/update-evse.dto';
import type { ListEvsesQueryDto } from './dto/list-evses-query.dto';

// WO-ARGOS-054 — "Cargador" (EVSE) global inventory. Same with-names
// pattern as ChargingStation/WorkOrder — dedicated include + type.
//
// WO-ARGOS-056 — extended with exactly the evidence the pure Operational
// Status calculator (evse-operational-status.ts) needs to derive a
// read-time-only status: the parent station's real connectivityStatus, and
// each connector's real status plus whether a real non-terminal
// ChargingSession currently exists on it. One query, no N+1. This include
// never reads/writes Evse.status or Connector.status beyond the plain
// select already needed for display — nothing here mutates anything.
const SESSION_IN_PROGRESS_STATUSES: Prisma.ChargingSessionWhereInput['status'] =
  {
    in: ['ACTIVE', 'SUSPENDED', 'OFFLINE'],
  };

export const EVSE_WITH_NAMES_INCLUDE = Prisma.validator<Prisma.EvseInclude>()({
  chargingStation: {
    select: {
      name: true,
      connectivityStatus: true,
      site: { select: { id: true, name: true } },
    },
  },
  connectors: {
    select: {
      status: true,
      chargingSessions: {
        where: { status: SESSION_IN_PROGRESS_STATUSES },
        select: { id: true },
        take: 1,
      },
    },
  },
});

export type EvseWithNames = Prisma.EvseGetPayload<{
  include: typeof EVSE_WITH_NAMES_INCLUDE;
}>;

@Injectable()
export class EvsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Global, organization-scoped inventory (WO-ARGOS-054) — one query,
   * relation filter, no N+1. Now also carries WO-ARGOS-056's operational
   * evidence (see EVSE_WITH_NAMES_INCLUDE). */
  async listAll(
    organizationId: string,
    filters: ListEvsesQueryDto,
  ): Promise<EvseWithNames[]> {
    return this.prisma.evse.findMany({
      where: {
        chargingStation: {
          site: {
            organizationId,
            ...(filters.siteId ? { id: filters.siteId } : {}),
          },
          ...(filters.chargingStationId
            ? { id: filters.chargingStationId }
            : {}),
        },
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: EVSE_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByChargingStation(
    organizationId: string,
    chargingStationId: string,
  ): Promise<EvseWithNames[]> {
    await this.getOwnedChargingStation(organizationId, chargingStationId);
    return this.prisma.evse.findMany({
      where: { chargingStationId },
      include: EVSE_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ownership walks the full chain (evse -> chargingStation -> site ->
   * organization) via a single Prisma relation filter — no organizationId
   * or siteId is stored directly on Evse.
   */
  async getById(
    organizationId: string,
    evseId: string,
  ): Promise<EvseWithNames> {
    const evse = await this.prisma.evse.findFirst({
      where: { id: evseId, chargingStation: { site: { organizationId } } },
      include: EVSE_WITH_NAMES_INCLUDE,
    });
    if (!evse) {
      throw new NotFoundException('EVSE no encontrado');
    }
    return evse;
  }

  async create(
    organizationId: string,
    chargingStationId: string,
    actorUserId: string,
    dto: CreateEvseDto,
  ): Promise<Evse> {
    await this.getOwnedChargingStation(organizationId, chargingStationId);

    let evse: Evse;
    try {
      evse = await this.prisma.evse.create({
        data: {
          chargingStationId,
          externalId: dto.externalId ?? null,
          name: dto.name ?? null,
          status: dto.status ?? 'UNAVAILABLE',
          maxPowerKw: dto.maxPowerKw ?? null,
          currentType: dto.currentType ?? null,
          phaseType: dto.phaseType ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un EVSE con ese identificador en esta estación',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'EVSE_CREATED',
      organizationId,
      actorUserId,
      subjectType: 'Evse',
      subjectId: evse.id,
      metadata: { chargingStationId, externalId: evse.externalId },
    });

    return evse;
  }

  async update(
    organizationId: string,
    actorUserId: string,
    evseId: string,
    dto: UpdateEvseDto,
  ): Promise<Evse> {
    await this.getById(organizationId, evseId);

    const data: Prisma.EvseUpdateInput = {};
    if (dto.externalId !== undefined) data.externalId = dto.externalId;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.maxPowerKw !== undefined) data.maxPowerKw = dto.maxPowerKw;
    if (dto.currentType !== undefined) data.currentType = dto.currentType;
    if (dto.phaseType !== undefined) data.phaseType = dto.phaseType;

    let evse: Evse;
    try {
      evse = await this.prisma.evse.update({
        where: { id: evseId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un EVSE con ese identificador en esta estación',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'EVSE_UPDATED',
      organizationId,
      actorUserId,
      subjectType: 'Evse',
      subjectId: evse.id,
    });

    return evse;
  }

  private async getOwnedChargingStation(
    organizationId: string,
    chargingStationId: string,
  ): Promise<ChargingStation> {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: chargingStationId, site: { organizationId } },
    });
    if (!station) {
      throw new NotFoundException('Estación de carga no encontrada');
    }
    return station;
  }
}
