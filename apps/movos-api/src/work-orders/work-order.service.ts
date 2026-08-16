import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  WorkOrder,
  WorkOrderEvent,
  WorkOrderStatus,
  WorkOrderPriority,
  WorkOrderSource,
} from '@prisma/client';
import type {
  WorkOrderTransition,
  WorkOrderAttentionReason,
} from '@mediafox/shared-types';

import { PrismaService } from '../prisma/prisma.service';
import {
  WorkOrderAttachmentService,
  type WorkOrderAttachmentWithUploader,
} from './work-order-attachment.service';

// WO-ARGOS-049 — station.site is joined here (not a separate query) purely
// to derive ApiWorkOrder.visitLocation at presenter time. Site already
// carries every location field this needs — no new column on WorkOrder or
// ChargingStation. Exported so MyWorkService reuses this exact shape rather
// than maintaining a second, driftable copy.
export const WORK_ORDER_WITH_NAMES_INCLUDE = {
  station: {
    select: {
      name: true,
      site: {
        select: {
          name: true,
          formattedAddress: true,
          address: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  },
  assignedMember: { select: { displayName: true } },
} as const;

export type WorkOrderWithNames = WorkOrder & {
  station: {
    name: string;
    site: {
      name: string;
      formattedAddress: string | null;
      address: string;
      latitude: number | null;
      longitude: number | null;
    };
  };
  assignedMember: { displayName: string } | null;
};

const WORK_ORDER_EVENT_WITH_ACTOR_INCLUDE = {
  actor: { select: { displayName: true } },
} as const;

export type WorkOrderEventWithActor = WorkOrderEvent & {
  actor: { displayName: string } | null;
};

export interface AssignableTechnician {
  userId: string;
  displayName: string;
}

export interface ListWorkOrdersFilter {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  assignedMemberId?: string;
  unassigned?: boolean;
  scheduledFrom?: Date;
  scheduledTo?: Date;
}

export interface WorkOrderAttentionItem {
  workOrder: WorkOrderWithNames;
  reasons: WorkOrderAttentionReason[];
}

export interface TechnicianWorkload {
  userId: string;
  displayName: string;
  unresolvedCount: number;
  inProgressCount: number;
  scheduledTodayCount: number;
}

const TERMINAL_STATUSES: WorkOrderStatus[] = ['RESOLVED', 'CANCELLED'];

// WO-ARGOS-051 — Requires Attention rule D's threshold (ARGOS's approved
// spec: "status = IN_PROGRESS AND startedAt < now - 4 hours"). Named here,
// not inlined, per that spec's explicit instruction not to bury it as an
// unexplained UI magic number — this is also the one place it's evaluated;
// movos-web never re-derives it, it only renders whatever reasons this
// service already decided.
export const IN_PROGRESS_STALL_HOURS = 4;

// America/Bogota has no DST (fixed UTC-5) — the same fixed-timezone
// convention apps/movos-web/src/lib/format.ts already uses for displaying
// WorkOrder.scheduledAt. Computed here so "today" for technician workload
// has one definition, not a second driftable one on the frontend.
function bogotaTodayRange(): { start: Date; end: Date } {
  const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;
  const nowBogota = new Date(Date.now() - BOGOTA_OFFSET_MS);
  const year = nowBogota.getUTCFullYear();
  const month = nowBogota.getUTCMonth();
  const day = nowBogota.getUTCDate();
  const start = new Date(Date.UTC(year, month, day) + BOGOTA_OFFSET_MS);
  const end = new Date(Date.UTC(year, month, day + 1) + BOGOTA_OFFSET_MS);
  return { start, end };
}

// V1 scope (WO-ARGOS-035) — 5 real transitions, one per non-CREATED
// WorkOrderEventType. Deliberately no `block`/`unassign` — see
// docs/operations/WORKORDER_READINESS.md for why this version stays
// narrower than the full WORK_ORDER_STATES.md design.
const VALID_TRANSITIONS: Record<WorkOrderStatus, WorkOrderTransition[]> = {
  OPEN: ['assign', 'comment', 'cancel'],
  ASSIGNED: ['assign', 'start', 'comment', 'cancel'],
  IN_PROGRESS: ['assign', 'resolve', 'comment', 'cancel'],
  RESOLVED: [],
  CANCELLED: [],
};

export interface TransitionInput {
  transition: WorkOrderTransition;
  assignedMemberId?: string;
  comment?: string;
  /** The authenticated user performing this transition — null only for
   * automation-triggered creation (Rule 1), never for a real transition. */
  actorId: string | null;
}

export interface CreateWorkOrderInput {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  source: WorkOrderSource;
  stationId: string;
  /** Null for automation-triggered creation (Rule 1) — see the createdBy
   * question named in docs/operations/WORK_ORDER_AUTOMATIONS.md, resolved
   * here as: automated events simply have no human actor, rather than a
   * synthetic system User row. */
  actorId: string | null;
  /** WO-ARGOS-049 — optional planned field visit. */
  scheduledAt?: Date | null;
}

// A resolution note this short ("OK", "listo") passed twice in the real
// pilot (PILOT-WO-01/02) despite richer checklist content already on the
// record — see docs/pilot/PILOT_WO_01_EVIDENCE.md. This closes exactly that
// gap: reliably rejects a near-empty closure without becoming a word-count
// requirement or a structured form.
const RESOLUTION_SUMMARY_MIN_LENGTH = 20;

/**
 * Work Order V1 (WO-ARGOS-035). Owns the one write path onto `WorkOrder` —
 * every transition is server-enforced against VALID_TRANSITIONS and writes
 * a real WorkOrderEvent row, the same discipline ActionService (WO-ARGOS-026)
 * already established for `Action`. Scoped to exactly 3 sources
 * (CONNECTIVITY_LOSS, RECOMMENDATION, MANUAL) per
 * docs/operations/WORKORDER_READINESS.md's recommendation.
 */
@Injectable()
export class WorkOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: WorkOrderAttachmentService,
  ) {}

  async list(
    organizationId: string,
    filter: ListWorkOrdersFilter = {},
  ): Promise<WorkOrderWithNames[]> {
    return this.prisma.workOrder.findMany({
      where: {
        organizationId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
        ...(filter.unassigned
          ? { assignedMemberId: null }
          : filter.assignedMemberId
            ? { assignedMemberId: filter.assignedMemberId }
            : {}),
        ...(filter.scheduledFrom || filter.scheduledTo
          ? {
              scheduledAt: {
                ...(filter.scheduledFrom ? { gte: filter.scheduledFrom } : {}),
                ...(filter.scheduledTo ? { lt: filter.scheduledTo } : {}),
              },
            }
          : {}),
      },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * WO-ARGOS-051 — Requires Attention V1. Deterministic, no AI: a WorkOrder
   * appears here if it matches at least one of the 4 approved rules
   * (A: HIGH/CRITICAL unresolved, B: overdue scheduled visit,
   * C: unassigned and OPEN, D: IN_PROGRESS longer than
   * IN_PROGRESS_STALL_HOURS). `reasons` is computed from the same row the
   * OR already matched — never a second, independently-drifting check.
   */
  async listAttentionItems(
    organizationId: string,
  ): Promise<WorkOrderAttentionItem[]> {
    const now = new Date();
    const stalledBefore = new Date(
      now.getTime() - IN_PROGRESS_STALL_HOURS * 60 * 60 * 1000,
    );

    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        organizationId,
        OR: [
          {
            priority: { in: ['HIGH', 'CRITICAL'] },
            status: { notIn: TERMINAL_STATUSES },
          },
          { scheduledAt: { lt: now }, status: { notIn: TERMINAL_STATUSES } },
          { status: 'OPEN', assignedMemberId: null },
          { status: 'IN_PROGRESS', startedAt: { lt: stalledBefore } },
        ],
      },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return workOrders.map((workOrder) => ({
      workOrder,
      reasons: this.computeAttentionReasons(workOrder, now, stalledBefore),
    }));
  }

  private computeAttentionReasons(
    workOrder: WorkOrder,
    now: Date,
    stalledBefore: Date,
  ): WorkOrderAttentionReason[] {
    const reasons: WorkOrderAttentionReason[] = [];
    const notTerminal = !TERMINAL_STATUSES.includes(workOrder.status);

    if (
      notTerminal &&
      (workOrder.priority === 'HIGH' || workOrder.priority === 'CRITICAL')
    ) {
      reasons.push('HIGH_PRIORITY_UNRESOLVED');
    }
    if (notTerminal && workOrder.scheduledAt && workOrder.scheduledAt < now) {
      reasons.push('SCHEDULED_OVERDUE');
    }
    if (workOrder.status === 'OPEN' && !workOrder.assignedMemberId) {
      reasons.push('UNASSIGNED');
    }
    if (
      workOrder.status === 'IN_PROGRESS' &&
      workOrder.startedAt &&
      workOrder.startedAt < stalledBefore
    ) {
      reasons.push('STALLED_IN_PROGRESS');
    }
    return reasons;
  }

  /**
   * WO-ARGOS-051 — per-technician workload for the Operations Console.
   * Roster is the same real ACTIVE TECHNICIAN membership query
   * listAssignableTechnicians already uses; counts are a plain in-memory
   * aggregation over real, unresolved WorkOrder rows — no groupBy, no new
   * index (deferred per spec until there's evidence it's needed).
   */
  async getTechnicianWorkload(
    organizationId: string,
  ): Promise<TechnicianWorkload[]> {
    const technicians = await this.listAssignableTechnicians(organizationId);
    if (technicians.length === 0) return [];

    const { start: todayStart, end: todayEnd } = bogotaTodayRange();
    const workOrders = await this.prisma.workOrder.findMany({
      where: {
        organizationId,
        assignedMemberId: { in: technicians.map((t) => t.userId) },
        status: { notIn: TERMINAL_STATUSES },
      },
      select: { assignedMemberId: true, status: true, scheduledAt: true },
    });

    return technicians.map((technician) => {
      const own = workOrders.filter(
        (wo) => wo.assignedMemberId === technician.userId,
      );
      return {
        userId: technician.userId,
        displayName: technician.displayName,
        unresolvedCount: own.length,
        inProgressCount: own.filter((wo) => wo.status === 'IN_PROGRESS').length,
        scheduledTodayCount: own.filter(
          (wo) =>
            wo.scheduledAt &&
            wo.scheduledAt >= todayStart &&
            wo.scheduledAt < todayEnd,
        ).length,
      };
    });
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<WorkOrderWithNames> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, organizationId },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
    });
    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada.');
    }
    return workOrder;
  }

  async listEvents(
    organizationId: string,
    workOrderId: string,
  ): Promise<WorkOrderEventWithActor[]> {
    // Confirms tenant ownership before returning any event — the same
    // "never trust the id alone" discipline every other org-scoped lookup
    // in this codebase follows.
    await this.getById(organizationId, workOrderId);
    return this.prisma.workOrderEvent.findMany({
      where: { workOrderId },
      include: WORK_ORDER_EVENT_WITH_ACTOR_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  // WO-ARGOS-049 — operator-side field evidence, read-only. Uploading is
  // technician-only (MyWorkController) — an operator only ever views what a
  // technician already attached, matching the mobile-first design this
  // capability was scoped around.
  async listAttachments(
    organizationId: string,
    workOrderId: string,
  ): Promise<WorkOrderAttachmentWithUploader[]> {
    await this.getById(organizationId, workOrderId);
    return this.attachments.list(workOrderId);
  }

  async getAttachment(
    organizationId: string,
    workOrderId: string,
    attachmentId: string,
  ): Promise<WorkOrderAttachmentWithUploader> {
    await this.getById(organizationId, workOrderId);
    return this.attachments.getOne(workOrderId, attachmentId);
  }

  /**
   * WO-ARGOS-038 — the eligible-assignee list for the operator's picker on
   * /work-orders/[id]. Scoped to real, ACTIVE `MemberRole.TECHNICIAN`
   * memberships in the caller's own organization only — the same
   * `assertAssignee` active-membership check `transition()` already
   * enforces, narrowed further to the technician role specifically, since
   * this list exists to answer "who can I dispatch," not "who could this
   * API theoretically accept." Does not restrict `transition()` itself —
   * that still accepts any active member, unchanged, matching how
   * `create()`'s own OWNER/ADMIN self-assignment already works today.
   */
  async listAssignableTechnicians(
    organizationId: string,
  ): Promise<AssignableTechnician[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { organizationId, role: 'TECHNICIAN', status: 'ACTIVE' },
      include: { user: { select: { id: true, displayName: true } } },
      orderBy: { user: { displayName: 'asc' } },
    });
    return memberships.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
    }));
  }

  async create(
    organizationId: string,
    input: CreateWorkOrderInput,
  ): Promise<WorkOrderWithNames> {
    const station = await this.prisma.chargingStation.findFirst({
      where: { id: input.stationId, site: { organizationId } },
    });
    if (!station) {
      throw new NotFoundException(
        'La estación indicada no existe en esta organización.',
      );
    }

    const created = await this.prisma.workOrder.create({
      data: {
        organizationId,
        stationId: input.stationId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        source: input.source,
        status: 'OPEN',
        scheduledAt: input.scheduledAt ?? null,
      },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
    });

    await this.prisma.workOrderEvent.create({
      data: {
        workOrderId: created.id,
        type: 'CREATED',
        actorId: input.actorId,
        payload: { source: input.source, priority: input.priority },
      },
    });

    return created;
  }

  async transition(
    organizationId: string,
    id: string,
    input: TransitionInput,
  ): Promise<WorkOrderWithNames> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, organizationId },
    });
    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada.');
    }

    this.assertValidTransition(workOrder.status, input.transition);
    if (input.transition === 'assign') {
      await this.assertAssignee(organizationId, input.assignedMemberId);
    }
    if (
      (input.transition === 'resolve' || input.transition === 'cancel') &&
      !input.comment
    ) {
      throw new BadRequestException(
        input.transition === 'resolve'
          ? 'Se requiere un resumen de resolución.'
          : 'Se requiere un motivo para cancelar.',
      );
    }
    if (
      input.transition === 'resolve' &&
      input.comment &&
      input.comment.trim().length < RESOLUTION_SUMMARY_MIN_LENGTH
    ) {
      throw new BadRequestException(
        `El resumen de resolución debe tener al menos ${RESOLUTION_SUMMARY_MIN_LENGTH} caracteres — describe brevemente qué se encontró, qué se hizo y el resultado final.`,
      );
    }
    if (input.transition === 'comment' && !input.comment) {
      throw new BadRequestException('El comentario no puede estar vacío.');
    }

    return this.applyTransition(workOrder, input);
  }

  /**
   * WO-ARGOS-049 — sets or clears the planned visit. Deliberately not a
   * WorkOrderTransition: scheduling never touches WorkOrderStatus and must
   * stay usable at any point before the WorkOrder closes, independent of
   * VALID_TRANSITIONS. Logs a SCHEDULED event for actor/timestamp
   * attribution in the timeline — the same append-only discipline every
   * other real change to this WorkOrder already follows.
   */
  async schedule(
    organizationId: string,
    id: string,
    scheduledAt: Date | null,
    actorId: string,
  ): Promise<WorkOrderWithNames> {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, organizationId },
    });
    if (!workOrder) {
      throw new NotFoundException('Orden de trabajo no encontrada.');
    }
    if (workOrder.status === 'RESOLVED' || workOrder.status === 'CANCELLED') {
      throw new BadRequestException(
        'No se puede programar una visita en una orden de trabajo cerrada.',
      );
    }

    const updated = await this.prisma.workOrder.update({
      where: { id: workOrder.id },
      data: { scheduledAt },
      include: WORK_ORDER_WITH_NAMES_INCLUDE,
    });
    await this.prisma.workOrderEvent.create({
      data: {
        workOrderId: workOrder.id,
        type: 'SCHEDULED',
        actorId,
        payload: { scheduledAt: scheduledAt?.toISOString() ?? null },
      },
    });
    return updated;
  }

  private assertValidTransition(
    from: WorkOrderStatus,
    transition: WorkOrderTransition,
  ): void {
    if (!VALID_TRANSITIONS[from].includes(transition)) {
      throw new ConflictException(
        `La transición "${transition}" no es válida desde el estado ${from}.`,
      );
    }
  }

  private async assertAssignee(
    organizationId: string,
    assignedMemberId: string | undefined,
  ): Promise<void> {
    if (!assignedMemberId) {
      throw new BadRequestException(
        'Se requiere un integrante para asignar esta orden de trabajo.',
      );
    }
    // Same real, active-membership check ActionService.assertAssignee()
    // already established — an assignee must be a real member of this
    // organization, not merely any User row in the database.
    const membership = await this.prisma.membership.findFirst({
      where: { userId: assignedMemberId, organizationId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new BadRequestException(
        'El integrante asignado no tiene una membresía activa en esta organización.',
      );
    }
  }

  private async applyTransition(
    workOrder: WorkOrder,
    input: TransitionInput,
  ): Promise<WorkOrderWithNames> {
    const now = new Date();

    switch (input.transition) {
      case 'assign': {
        const updated = await this.prisma.workOrder.update({
          where: { id: workOrder.id },
          data: {
            status: workOrder.status === 'OPEN' ? 'ASSIGNED' : workOrder.status,
            assignedMemberId: input.assignedMemberId,
            assignedAt: now,
          },
          include: WORK_ORDER_WITH_NAMES_INCLUDE,
        });
        await this.prisma.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            type: 'ASSIGNED',
            actorId: input.actorId,
            payload: { assignedMemberId: input.assignedMemberId },
          },
        });
        return updated;
      }

      case 'start': {
        const updated = await this.prisma.workOrder.update({
          where: { id: workOrder.id },
          data: { status: 'IN_PROGRESS', startedAt: now },
          include: WORK_ORDER_WITH_NAMES_INCLUDE,
        });
        await this.prisma.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            type: 'STARTED',
            actorId: input.actorId,
          },
        });
        return updated;
      }

      case 'comment': {
        const updated = await this.prisma.workOrder.update({
          where: { id: workOrder.id },
          data: { notes: input.comment },
          include: WORK_ORDER_WITH_NAMES_INCLUDE,
        });
        await this.prisma.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            type: 'COMMENTED',
            actorId: input.actorId,
            payload: { comment: input.comment },
          },
        });
        return updated;
      }

      case 'resolve': {
        const updated = await this.prisma.workOrder.update({
          where: { id: workOrder.id },
          data: { status: 'RESOLVED', resolvedAt: now, notes: input.comment },
          include: WORK_ORDER_WITH_NAMES_INCLUDE,
        });
        await this.prisma.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            type: 'RESOLVED',
            actorId: input.actorId,
            payload: { comment: input.comment },
          },
        });
        return updated;
      }

      case 'cancel': {
        const updated = await this.prisma.workOrder.update({
          where: { id: workOrder.id },
          data: { status: 'CANCELLED', notes: input.comment },
          include: WORK_ORDER_WITH_NAMES_INCLUDE,
        });
        await this.prisma.workOrderEvent.create({
          data: {
            workOrderId: workOrder.id,
            type: 'CANCELLED',
            actorId: input.actorId,
            payload: { comment: input.comment },
          },
        });
        return updated;
      }

      default:
        throw new BadRequestException(
          `Transición desconocida: ${input.transition}`,
        );
    }
  }
}
