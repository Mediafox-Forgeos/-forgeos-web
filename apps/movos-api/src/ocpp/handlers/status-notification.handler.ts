import { Injectable, Logger } from '@nestjs/common';
import type { ChargingStation } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { mapToConnectorStatus } from '../normalization/status-mapping';
import type {
  DomainResult,
  NormalizedInboundEvent,
} from '../protocol/common/normalized-events';

/**
 * OCPP 1.6J's StatusNotification is connector-scoped only (integer
 * connectorId; 0 means the Charge Point itself, not any specific
 * connector) — 1.6J has no EVSE-level status concept distinct from
 * connector status. This handler therefore updates Connector.status only,
 * never Evse.status: forcing a connector-level report onto the parent EVSE
 * row would invent semantics 1.6J doesn't have. See CAP-003 Architecture
 * Decisions Decision 5's field-classification table.
 *
 * Administrative fields (ChargingStation.status, Evse.name, etc.) are
 * never touched here — only Connector.status, which CAP-002 already
 * documents as becoming a dual-writer field once OCPP ships (this handler
 * is that second writer).
 */
@Injectable()
export class StatusNotificationHandler {
  private readonly logger = new Logger(StatusNotificationHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async handle(
    event: Extract<NormalizedInboundEvent, { type: 'ConnectorStatus' }>,
    station: ChargingStation,
  ): Promise<DomainResult> {
    if (!event.connectorExternalId || event.connectorExternalId === '0') {
      // connectorId 0 is a whole-station report. ChargingStationStatus is
      // administrative lifecycle only (see schema.prisma) — there is no
      // operational field on ChargingStation for this handler to update.
      // Accepted (the message is valid OCPP), no domain write performed.
      return { status: 'Accepted' };
    }

    const connector = await this.prisma.connector.findFirst({
      where: {
        externalId: event.connectorExternalId,
        evse: { chargingStationId: station.id },
      },
    });

    if (!connector) {
      this.logger.warn(
        `StatusNotification for unknown connector externalId=${event.connectorExternalId} on station ${station.id}`,
      );
      return { status: 'Rejected' };
    }

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: { status: mapToConnectorStatus(event.status) },
    });

    return { status: 'Accepted' };
  }
}
