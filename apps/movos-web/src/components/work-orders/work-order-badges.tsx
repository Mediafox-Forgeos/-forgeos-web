import type {
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
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
