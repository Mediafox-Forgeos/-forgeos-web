import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ChargingStation, type Site } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateChargingStationDto } from './dto/create-charging-station.dto';
import type { UpdateChargingStationDto } from './dto/update-charging-station.dto';
import type { ListChargingStationsQueryDto } from './dto/list-charging-stations-query.dto';

// WO-ARGOS-054 — Infrastructure Inventory Navigation. Same "with names"
// pattern already used by WorkOrder/ChargingSession: a dedicated include
// const + type, only for the global inventory list, never for the
// existing per-site/detail endpoints above.
export const CHARGING_STATION_WITH_SITE_NAME_INCLUDE = {
  site: { select: { name: true } },
} as const;

export type ChargingStationWithSiteName = ChargingStation & {
  site: { name: string };
};

@Injectable()
export class ChargingStationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Global, organization-scoped inventory — the endpoint WO-ARGOS-005
   * previously ruled out for a naive client-side N+1 fan-out. A single
   * properly-scoped query with a relation filter sidesteps that concern
   * entirely (see WO-ARGOS-054 discovery).
   */
  async listAll(
    organizationId: string,
    filters: ListChargingStationsQueryDto,
  ): Promise<ChargingStationWithSiteName[]> {
    return this.prisma.chargingStation.findMany({
      where: {
        site: {
          organizationId,
          ...(filters.siteId ? { id: filters.siteId } : {}),
        },
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.connectivityStatus
          ? { connectivityStatus: filters.connectivityStatus }
          : {}),
      },
      include: CHARGING_STATION_WITH_SITE_NAME_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Lists ChargingStations for a Site, after verifying the Site itself
   * belongs to the calling organization — the same "not found, not
   * forbidden" pattern SitesService uses so that a Site (or Station) in
   * another organization is indistinguishable from a non-existent one.
   */
  async listBySite(
    organizationId: string,
    siteId: string,
  ): Promise<ChargingStation[]> {
    await this.getOwnedSite(organizationId, siteId);
    return this.prisma.chargingStation.findMany({
      where: { siteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Loads a single ChargingStation, verifying ownership through the full
   * chain (station -> site -> organization) in one query via a Prisma
   * relation filter — never trusts the id alone.
   */
  async getById(
    organizationId: string,
    stationId: string,
  ): Promise<ChargingStation> {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: stationId, site: { organizationId } },
    });
    if (!station) {
      throw new NotFoundException('Estación de carga no encontrada');
    }
    return station;
  }

  async create(
    organizationId: string,
    siteId: string,
    actorUserId: string,
    dto: CreateChargingStationDto,
  ): Promise<ChargingStation> {
    await this.getOwnedSite(organizationId, siteId);

    let station: ChargingStation;
    try {
      station = await this.prisma.chargingStation.create({
        data: {
          siteId,
          name: dto.name,
          code: dto.code ?? null,
          manufacturer: dto.manufacturer ?? null,
          model: dto.model ?? null,
          serialNumber: dto.serialNumber ?? null,
          protocol: dto.protocol ?? null,
          status: dto.status ?? 'DRAFT',
          commissionedAt: dto.commissionedAt
            ? new Date(dto.commissionedAt)
            : null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una estación de carga con ese código en este sitio',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'CHARGING_STATION_CREATED',
      organizationId,
      actorUserId,
      subjectType: 'ChargingStation',
      subjectId: station.id,
      metadata: { siteId, name: station.name, code: station.code },
    });

    return station;
  }

  async update(
    organizationId: string,
    actorUserId: string,
    stationId: string,
    dto: UpdateChargingStationDto,
  ): Promise<ChargingStation> {
    await this.getById(organizationId, stationId);

    const data: Prisma.ChargingStationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.manufacturer !== undefined) data.manufacturer = dto.manufacturer;
    if (dto.model !== undefined) data.model = dto.model;
    if (dto.serialNumber !== undefined) data.serialNumber = dto.serialNumber;
    if (dto.protocol !== undefined) data.protocol = dto.protocol;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.commissionedAt !== undefined) {
      data.commissionedAt = new Date(dto.commissionedAt);
    }

    let station: ChargingStation;
    try {
      station = await this.prisma.chargingStation.update({
        where: { id: stationId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe una estación de carga con ese código en este sitio',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'CHARGING_STATION_UPDATED',
      organizationId,
      actorUserId,
      subjectType: 'ChargingStation',
      subjectId: station.id,
    });

    return station;
  }

  /**
   * Verifies a Site belongs to the organization before any ChargingStation
   * is listed or created under it. Duplicated (not delegated to
   * SitesService) deliberately — sibling service modules in this codebase
   * each own their Prisma queries rather than cross-depend on one another.
   */
  private async getOwnedSite(
    organizationId: string,
    siteId: string,
  ): Promise<Site> {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, organizationId },
    });
    if (!site) {
      throw new NotFoundException('Sitio no encontrado');
    }
    return site;
  }
}
