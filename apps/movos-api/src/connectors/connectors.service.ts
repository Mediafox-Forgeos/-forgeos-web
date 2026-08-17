import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Connector, type Evse } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateConnectorDto } from './dto/create-connector.dto';
import type { UpdateConnectorDto } from './dto/update-connector.dto';
import type { ListConnectorsQueryDto } from './dto/list-connectors-query.dto';

// WO-ARGOS-054 — Connector global inventory. Same with-names pattern,
// nested one level deeper (connector -> evse -> chargingStation -> site).
export const CONNECTOR_WITH_NAMES_INCLUDE = {
  evse: {
    select: {
      name: true,
      chargingStation: {
        select: {
          id: true,
          name: true,
          site: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

export type ConnectorWithNames = Connector & {
  evse: {
    name: string | null;
    chargingStation: {
      id: string;
      name: string;
      site: { id: string; name: string };
    };
  };
};

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Global, organization-scoped inventory (WO-ARGOS-054) — one query,
   * relation filter through the full chain, no N+1. */
  async listAll(
    organizationId: string,
    filters: ListConnectorsQueryDto,
  ): Promise<ConnectorWithNames[]> {
    return this.prisma.connector.findMany({
      where: {
        evse: {
          chargingStation: {
            site: {
              organizationId,
              ...(filters.siteId ? { id: filters.siteId } : {}),
            },
            ...(filters.chargingStationId
              ? { id: filters.chargingStationId }
              : {}),
          },
          ...(filters.evseId ? { id: filters.evseId } : {}),
        },
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: CONNECTOR_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async listByEvse(
    organizationId: string,
    evseId: string,
  ): Promise<Connector[]> {
    await this.getOwnedEvse(organizationId, evseId);
    return this.prisma.connector.findMany({
      where: { evseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Ownership walks the full chain (connector -> evse -> chargingStation ->
   * site -> organization) via a single Prisma relation filter.
   */
  async getById(
    organizationId: string,
    connectorId: string,
  ): Promise<Connector> {
    const connector = await this.prisma.connector.findFirst({
      where: {
        id: connectorId,
        evse: { chargingStation: { site: { organizationId } } },
      },
    });
    if (!connector) {
      throw new NotFoundException('Conector no encontrado');
    }
    return connector;
  }

  async create(
    organizationId: string,
    evseId: string,
    actorUserId: string,
    dto: CreateConnectorDto,
  ): Promise<Connector> {
    await this.getOwnedEvse(organizationId, evseId);

    let connector: Connector;
    try {
      connector = await this.prisma.connector.create({
        data: {
          evseId,
          externalId: dto.externalId ?? null,
          type: dto.type,
          status: dto.status ?? 'UNAVAILABLE',
          maxPowerKw: dto.maxPowerKw ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un conector con ese identificador en este EVSE',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'CONNECTOR_CREATED',
      organizationId,
      actorUserId,
      subjectType: 'Connector',
      subjectId: connector.id,
      metadata: { evseId, type: connector.type },
    });

    return connector;
  }

  async update(
    organizationId: string,
    actorUserId: string,
    connectorId: string,
    dto: UpdateConnectorDto,
  ): Promise<Connector> {
    await this.getById(organizationId, connectorId);

    const data: Prisma.ConnectorUpdateInput = {};
    if (dto.externalId !== undefined) data.externalId = dto.externalId;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.maxPowerKw !== undefined) data.maxPowerKw = dto.maxPowerKw;

    let connector: Connector;
    try {
      connector = await this.prisma.connector.update({
        where: { id: connectorId },
        data,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un conector con ese identificador en este EVSE',
        );
      }
      throw error;
    }

    await this.audit.record({
      action: 'CONNECTOR_UPDATED',
      organizationId,
      actorUserId,
      subjectType: 'Connector',
      subjectId: connector.id,
    });

    return connector;
  }

  private async getOwnedEvse(
    organizationId: string,
    evseId: string,
  ): Promise<Evse> {
    const evse = await this.prisma.evse.findFirst({
      where: { id: evseId, chargingStation: { site: { organizationId } } },
    });
    if (!evse) {
      throw new NotFoundException('EVSE no encontrado');
    }
    return evse;
  }
}
