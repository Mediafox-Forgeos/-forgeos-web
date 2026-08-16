import type { ApiWorkOrder, ApiWorkOrderEvent } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDuration, formatWorkOrderDateTime } from '@/lib/format';

/**
 * WO-ARGOS-049 — a compact PROGRAMADA/LLEGADA/INICIO/FINALIZACIÓN/DURACIÓN
 * summary, purely derived from data the page already fetched (WorkOrder
 * fields + the ARRIVAL_CONFIRMED event) — no new API call, no stored
 * duration. Sits above the full canonical WorkOrderEventTimeline, which is
 * unchanged and remains the source of truth; this is a second, derived
 * view of the same data, not a replacement for it.
 */
export function WorkOrderTimelineSummary({
  workOrder,
  events,
}: {
  workOrder: ApiWorkOrder;
  events: ApiWorkOrderEvent[];
}) {
  const arrivalAt =
    events.find((e) => e.type === 'ARRIVAL_CONFIRMED')?.createdAt ?? null;

  const rows: { label: string; value: string }[] = [];
  if (workOrder.scheduledAt) {
    rows.push({
      label: 'Programada',
      value: formatWorkOrderDateTime(workOrder.scheduledAt),
    });
  }
  if (arrivalAt) {
    rows.push({ label: 'Llegada', value: formatWorkOrderDateTime(arrivalAt) });
  }
  if (workOrder.startedAt) {
    rows.push({
      label: 'Inicio',
      value: formatWorkOrderDateTime(workOrder.startedAt),
    });
  }
  if (workOrder.resolvedAt) {
    rows.push({
      label: 'Finalización',
      value: formatWorkOrderDateTime(workOrder.resolvedAt),
    });
  }
  if (workOrder.startedAt && workOrder.resolvedAt) {
    rows.push({
      label: 'Duración',
      value: formatDuration(workOrder.startedAt, workOrder.resolvedAt),
    });
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Resumen de tiempos</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted-foreground text-[11px] uppercase tracking-wide">
                {row.label}
              </dt>
              <dd className="tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
