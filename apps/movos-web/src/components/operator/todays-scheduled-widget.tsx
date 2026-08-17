'use client';

import Link from 'next/link';
import type { ApiWorkOrder } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkOrderStatusBadge } from '@/components/work-orders/work-order-badges';
import { bogotaTodayRangeQuery, formatWorkOrderDateTime } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-051 — Operations Console. Real WorkOrder.scheduledAt data,
 * already-existing field, filtered server-side by the new scheduledFrom/
 * scheduledTo params on GET /work-orders.
 */
export function TodaysScheduledWidget() {
  const path = `/work-orders?${bogotaTodayRangeQuery()}`;
  const { data, loading, error } = usePolledResource<ApiWorkOrder[]>(
    path,
    30_000,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programadas hoy{data ? ` (${data.length})` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las visitas programadas.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No hay visitas programadas para hoy.
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
                {workOrder.stationName}
                {workOrder.scheduledAt
                  ? ` · ${formatWorkOrderDateTime(workOrder.scheduledAt)}`
                  : ''}
              </p>
            </div>
            <WorkOrderStatusBadge status={workOrder.status} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
