'use client';

import Link from 'next/link';
import type { ApiWorkOrder } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkOrderPriorityBadge } from '@/components/work-orders/work-order-badges';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-051 — Operations Console. `status=IN_PROGRESS` already worked on
 * GET /work-orders before this work order — no backend change needed here.
 */
export function InProgressWidget() {
  const { data, loading, error } = usePolledResource<ApiWorkOrder[]>(
    '/work-orders?status=IN_PROGRESS',
    30_000,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>En progreso{data ? ` (${data.length})` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las órdenes en progreso.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No hay órdenes de trabajo en progreso.
          </p>
        )}
        {data?.map((workOrder) => (
          <Link
            key={workOrder.id}
            href={`/work-orders/${workOrder.id}`}
            className="border-border hover:bg-accent/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{workOrder.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {workOrder.stationName} ·{' '}
                {workOrder.assignedMemberName ?? 'Sin asignar'}
                {workOrder.startedAt
                  ? ` · iniciada ${formatRelative(workOrder.startedAt)}`
                  : ''}
              </p>
            </div>
            <WorkOrderPriorityBadge priority={workOrder.priority} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
