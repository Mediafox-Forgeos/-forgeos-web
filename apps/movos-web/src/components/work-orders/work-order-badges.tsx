import type {
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
  WorkOrderAttentionReason,
} from '@mediafox/shared-types';

import { Badge, type BadgeTone } from '@/components/ui/badge';

// Work Order V1 (WO-ARGOS-035) — one canonical vocabulary for status,
// priority, and source, the same discipline
// docs/product/OPERATIONAL_VOCABULARY.md (WO-ARGOS-023) already
// established for every other status enum in this app: one label, one
// place it's defined, every screen imports it.
const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  OPEN: 'Abierta',
  ASSIGNED: 'Asignada',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
};

const STATUS_TONE: Record<WorkOrderStatus, BadgeTone> = {
  OPEN: 'neutral',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CANCELLED: 'muted',
};

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

const PRIORITY_LABEL: Record<WorkOrderPriority, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const PRIORITY_TONE: Record<WorkOrderPriority, BadgeTone> = {
  LOW: 'muted',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export function WorkOrderPriorityBadge({
  priority,
}: {
  priority: WorkOrderPriority;
}) {
  return (
    <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>
  );
}

const SOURCE_LABEL: Record<WorkOrderSource, string> = {
  CONNECTIVITY_LOSS: 'Pérdida de conectividad',
  RECOMMENDATION: 'Recomendación',
  MANUAL: 'Manual',
};

export function WorkOrderSourceLabel({ source }: { source: WorkOrderSource }) {
  return <span>{SOURCE_LABEL[source]}</span>;
}

export const workOrderPriorityOptions: {
  value: WorkOrderPriority;
  label: string;
}[] = (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as WorkOrderPriority[]).map(
  (value) => ({ value, label: PRIORITY_LABEL[value] }),
);

// WO-ARGOS-051 — Operations Console "Requires attention." Mirrors
// WorkOrderService.IN_PROGRESS_STALL_HOURS (apps/movos-api/src/work-orders/
// work-order.service.ts) for display purposes only — the backend is the
// sole authority on which work orders actually match STALLED_IN_PROGRESS;
// this label is never used to re-derive that decision here.
export const IN_PROGRESS_STALL_HOURS_LABEL = 4;

export const ATTENTION_REASON_LABEL: Record<WorkOrderAttentionReason, string> =
  {
    HIGH_PRIORITY_UNRESOLVED: 'Prioridad alta/crítica',
    SCHEDULED_OVERDUE: 'Visita programada vencida',
    UNASSIGNED: 'Sin asignar',
    STALLED_IN_PROGRESS: `En progreso +${IN_PROGRESS_STALL_HOURS_LABEL}h`,
  };
