import type {
  ApiWorkOrderEvent,
  WorkOrderEventType,
} from '@mediafox/shared-types';

import { CONNECTIVITY_STATUS_LABELS } from '@/components/movos/api-charging-status-badges';
import { formatRelative } from '@/lib/format';

/**
 * WO-ARGOS-038 — one canonical event label/detail rendering, shared by
 * `/work-orders/[id]` (operator) and `/my-work/[id]` (technician) so both
 * actors see the same operational truth. Before this, each page kept its
 * own copy of this map; the operator's copy was never updated for the 4
 * checklist event types WO-ARGOS-037 added, so the operator's timeline
 * showed raw enum values while the technician's showed real labels — see
 * docs/product/OPERATIONAL_LOOP_CHECKPOINT.md's Finding 1.
 */
export const WORK_ORDER_EVENT_LABEL: Record<WorkOrderEventType, string> = {
  CREATED: 'Creada',
  ASSIGNED: 'Asignada',
  STARTED: 'Iniciada',
  COMMENTED: 'Comentario',
  RESOLVED: 'Resuelta',
  CANCELLED: 'Cancelada',
  ARRIVAL_CONFIRMED: 'Llegada confirmada',
  DIAGNOSIS_RECORDED: 'Diagnóstico registrado',
  INTERVENTION_RECORDED: 'Intervención registrada',
  VALIDATION_RECORDED: 'Validación registrada',
  SCHEDULED: 'Visita programada',
};

function eventDetailText(event: ApiWorkOrderEvent): string | null {
  const payload = event.payload;
  if (!payload) return null;
  const text =
    payload.comment ??
    payload.finding ??
    payload.description ??
    payload.outcomeNote;
  return text != null ? String(text) : null;
}

function stationSnapshotOf(event: ApiWorkOrderEvent): string | null {
  const snapshot = event.payload?.stationSnapshot as
    { connectivityStatus?: string } | undefined;
  return snapshot?.connectivityStatus ?? null;
}

/**
 * The full event history for a WorkOrder — reused as-is by both actors,
 * never a second, independently-maintained history model. For
 * DIAGNOSIS_RECORDED/VALIDATION_RECORDED, also renders the station's real,
 * server-computed connectivity state at that exact moment (WO-ARGOS-037's
 * MyWorkService already captures this, never trusting the client — it was
 * simply discarded from view before now). This is deliberately never
 * reconciled against the technician's own note — a WorkOrder resolution
 * must never be made to imply the infrastructure itself recovered; showing
 * both, honestly, side by side is the fix, not silently trusting one.
 */
export function WorkOrderEventTimeline({
  events,
}: {
  events: ApiWorkOrderEvent[];
}) {
  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">Sin actividad.</p>;
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const detail = eventDetailText(event);
        const snapshotStatus = stationSnapshotOf(event);
        return (
          <div key={event.id} className="flex items-start gap-3 text-sm">
            <span className="bg-movos-blue mt-1.5 size-1.5 shrink-0 rounded-full" />
            <div className="flex-1">
              <p>
                <span className="font-medium">
                  {WORK_ORDER_EVENT_LABEL[event.type] ?? event.type}
                </span>
                {event.actorName ? (
                  <span className="text-muted-foreground">
                    {' '}
                    · {event.actorName}
                  </span>
                ) : (
                  <span className="text-muted-foreground"> · automático</span>
                )}
              </p>
              {detail && (
                <p className="text-muted-foreground text-xs">{detail}</p>
              )}
              {snapshotStatus && (
                <p className="text-muted-foreground text-xs">
                  Estado real de la estación en ese momento:{' '}
                  {CONNECTIVITY_STATUS_LABELS[snapshotStatus] ?? snapshotStatus}
                </p>
              )}
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {formatRelative(event.createdAt)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
