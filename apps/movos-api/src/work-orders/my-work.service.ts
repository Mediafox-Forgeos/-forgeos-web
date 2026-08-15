import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma, WorkOrderStatus } from '@prisma/client';
import type {
  ChecklistEventType,
  MyWorkTransition,
} from '@mediafox/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import {
  WorkOrderService,
  type WorkOrderEventWithActor,
  type WorkOrderWithNames,
} from './work-order.service';

const WORK_ORDER_WITH_NAMES_INCLUDE = {
  station: { select: { name: true } },
  assignedMember: { select: { displayName: true } },
} as const;

const WORK_ORDER_EVENT_WITH_ACTOR_INCLUDE = {
  actor: { select: { displayName: true } },
} as const;

// A technician executes and closes their own assigned work — they never
// dispatch it. Deliberately excludes `assign` and `cancel` from
// WorkOrderService's full transition set.
const ALLOWED_MY_WORK_TRANSITIONS: MyWorkTransition[] = [
  'start',
  'comment',
  'resolve',
];

const TERMINAL_STATUSES = ['RESOLVED', 'CANCELLED'];

export interface RecordChecklistEventInput {
  type: ChecklistEventType;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  finding?: string;
  description?: string;
  actionType?: string;
  outcomeNote?: string;
}

/**
 * Technician Identity & My Work (WO-ARGOS-037). The technician-facing
 * counterpart to WorkOrderService — same underlying WorkOrder/WorkOrderEvent
 * rows, same server-enforced state machine (delegated to WorkOrderService,
 * never re-implemented here), but every read and write is additionally
 * scoped to `assignedMemberId = self`. A technician substituting another
 * workOrderId in the URL gets exactly the same 404 a cross-organization
 * lookup already gets elsewhere in this codebase — existence is never
 * revealed for a WorkOrder that isn't theirs.
 */
@Injectable()
export class MyWorkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrders: WorkOrderService,
  ) {}

  async list(
    organizationId: string,
    technicianUserId: string,
    status?: WorkOrderStatus,
  ): Promise<WorkOrderWithNames[]> {
    return this.prisma.workOrder.findMany({
      where: {
        organizationId,
        assignedMemberId: technicianUserId,
        ...(status ? { status } : {}),
      },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getOwnWorkOrder(
    organizationId: string,
    technicianUserId: string,
    id: string,
  ): Promise<WorkOrderWithNames> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, organizationId, assignedMemberId: technicianUserId },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
    });
    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada.');
    }
    return workOrder;
  }

  async listEvents(
    organizationId: string,
    technicianUserId: string,
    workOrderId: string,
  ): Promise<WorkOrderEventWithActor[]> {
    // Ownership check first — never trust the id alone, same discipline
    // WorkOrderService.listEvents already follows for org scoping.
    await this.getOwnWorkOrder(organizationId, technicianUserId, workOrderId);
    return this.prisma.workOrderEvent.findMany({
      where: { workOrderId },
      include: WORK_ORDER_EVENT_WITH_ACTOR_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  async transition(
    organizationId: string,
    technicianUserId: string,
    id: string,
    transition: MyWorkTransition,
    comment: string | undefined,
  ): Promise<WorkOrderWithNames> {
    if (!ALLOWED_MY_WORK_TRANSITIONS.includes(transition)) {
      throw new BadRequestException(
        `Transición no permitida desde /my-work: ${transition}`,
      );
    }
    // Ownership re-verified here even though WorkOrderService.transition
    // itself re-queries by (id, organizationId) — a technician must never
    // be able to start/resolve/comment on a colleague's WorkOrder merely
    // because they both belong to the same organization.
    await this.getOwnWorkOrder(organizationId, technicianUserId, id);
    return this.workOrders.transition(organizationId, id, {
      transition,
      comment,
      actorId: technicianUserId,
    });
  }

  async recordChecklistEvent(
    organizationId: string,
    technicianUserId: string,
    workOrderId: string,
    input: RecordChecklistEventInput,
  ): Promise<WorkOrderEventWithActor> {
    const workOrder = await this.getOwnWorkOrder(
      organizationId,
      technicianUserId,
      workOrderId,
    );
    if (TERMINAL_STATUSES.includes(workOrder.status)) {
      throw new BadRequestException(
        'No se puede registrar evidencia en una orden de trabajo cerrada.',
      );
    }

    const payload = await this.buildChecklistPayload(workOrder, input);

    const event = await this.prisma.workOrderEvent.create({
      data: {
        workOrderId,
        type: input.type,
        actorId: technicianUserId,
        payload: payload as Prisma.InputJsonValue,
      },
      include: WORK_ORDER_EVENT_WITH_ACTOR_INCLUDE,
    });
    return event;
  }

  private async buildChecklistPayload(
    workOrder: WorkOrderWithNames,
    input: RecordChecklistEventInput,
  ): Promise<Record<string, unknown>> {
    switch (input.type) {
      case 'ARRIVAL_CONFIRMED':
        // Opt-in browser geolocation only — never required, never trusted
        // as stronger proof than it is (docs/operations/
        // WORK_ORDER_CHECKLISTS.md names this limit explicitly).
        return {
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          accuracy: input.accuracy ?? null,
        };

      case 'DIAGNOSIS_RECORDED': {
        if (!input.finding || input.finding.trim().length === 0) {
          throw new BadRequestException(
            'Se requiere un hallazgo de diagnóstico.',
          );
        }
        return {
          finding: input.finding,
          // Snapshotted server-side from the real, current station state —
          // never accepted from the client, which cannot be trusted to
          // report its own evidence.
          stationSnapshot: await this.snapshotStation(workOrder.stationId),
        };
      }

      case 'INTERVENTION_RECORDED': {
        if (!input.description || input.description.trim().length === 0) {
          throw new BadRequestException(
            'Se requiere una descripción de la intervención.',
          );
        }
        return {
          description: input.description,
          ...(input.actionType ? { actionType: input.actionType } : {}),
        };
      }

      case 'VALIDATION_RECORDED': {
        if (!input.outcomeNote || input.outcomeNote.trim().length === 0) {
          throw new BadRequestException('Se requiere una nota de resultado.');
        }
        return {
          outcomeNote: input.outcomeNote,
          stationSnapshot: await this.snapshotStation(workOrder.stationId),
        };
      }

      default:
        throw new BadRequestException(
          `Tipo de evento de checklist desconocido: ${input.type as string}`,
        );
    }
  }

  private async snapshotStation(
    stationId: string,
  ): Promise<{ connectivityStatus: string; connectorStatuses: string[] }> {
    const station = await this.prisma.chargingStation.findUnique({
      where: { id: stationId },
      select: {
        connectivityStatus: true,
        evses: { select: { connectors: { select: { status: true } } } },
      },
    });
    return {
      connectivityStatus: station?.connectivityStatus ?? 'UNKNOWN',
      connectorStatuses:
        station?.evses.flatMap((evse) =>
          evse.connectors.map((connector) => connector.status),
        ) ?? [],
    };
  }
}
