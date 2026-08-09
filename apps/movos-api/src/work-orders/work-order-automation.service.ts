import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { WorkOrderService } from './work-order.service';

// Reuses CAP-005's own reconnect-recovery window exactly (see
// ConnectionRegistryService / docs/domain/CAP-005_CONNECTIVITY_ENGINE.md:
// "a verified reconnect within a 15-minute window recovers it") rather than
// inventing a second, uncoordinated threshold — see
// docs/operations/WORK_ORDER_AUTOMATIONS.md Rule 1.
const OFFLINE_THRESHOLD_MS = 15 * 60_000;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Work Order V1, Rule 1 (WO-ARGOS-035 / docs/operations/WORK_ORDER_AUTOMATIONS.md).
 * A station OFFLINE for more than 15 minutes gets a WorkOrder created
 * automatically, source: CONNECTIVITY_LOSS — closing the exact gap
 * docs/product/FIVE_MINUTE_OPERATOR_SIMULATION.md found ("a station going
 * offline never becomes a tracked case at all"). Same setInterval +
 * OnModuleDestroy pattern as ConnectionRegistryService's own stale sweep —
 * no new scheduling dependency added for this one rule.
 */
@Injectable()
export class WorkOrderAutomationService implements OnModuleDestroy {
  private readonly logger = new Logger(WorkOrderAutomationService.name);
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrders: WorkOrderService,
  ) {
    this.sweepTimer = setInterval(
      () => void this.sweepOfflineStations(),
      SWEEP_INTERVAL_MS,
    );
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  async sweepOfflineStations(): Promise<void> {
    const threshold = new Date(Date.now() - OFFLINE_THRESHOLD_MS);

    const staleStations = await this.prisma.chargingStation.findMany({
      where: {
        status: 'ACTIVE',
        connectivityStatus: 'OFFLINE',
        lastDisconnectedAt: { lt: threshold },
      },
      select: {
        id: true,
        name: true,
        site: { select: { organizationId: true } },
      },
    });

    for (const station of staleStations) {
      try {
        await this.createIfNotDuplicate(station.site.organizationId, station);
      } catch (error) {
        // A failure creating one station's work order must never block the
        // sweep for the rest of the fleet — same isolation principle
        // ConnectionRegistryService's own sweep already follows.
        this.logger.error(
          `Failed to create connectivity-loss work order for station ${station.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async createIfNotDuplicate(
    organizationId: string,
    station: { id: string; name: string },
  ): Promise<void> {
    const existing = await this.prisma.workOrder.findFirst({
      where: {
        organizationId,
        stationId: station.id,
        source: 'CONNECTIVITY_LOSS',
        status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      },
    });
    if (existing) return;

    await this.workOrders.create(organizationId, {
      title: `Estación sin conexión: ${station.name}`,
      description: `${station.name} lleva más de 15 minutos sin conexión verificada.`,
      priority: 'HIGH',
      source: 'CONNECTIVITY_LOSS',
      stationId: station.id,
      actorId: null,
    });
  }
}
