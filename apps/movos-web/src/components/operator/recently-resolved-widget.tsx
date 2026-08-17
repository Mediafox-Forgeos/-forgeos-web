'use client';

import Link from 'next/link';
import type { ApiWorkOrder } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-051 — Operations Console. Deliberately small: this is
 * confirmation/context, not a primary operational queue. Re-sorted by
 * resolvedAt client-side (the API orders by createdAt, not resolvedAt) —
 * a small, cheap correction, same pattern the WO-ARGOS-050 Historial
 * section already uses for client-side WorkOrder date handling.
 */
export function RecentlyResolvedWidget() {
  const { data, loading, error } = usePolledResource<ApiWorkOrder[]>(
    '/work-orders?status=RESOLVED',
    60_000,
  );

  const recent = [...(data ?? [])]
    .filter((workOrder) => workOrder.resolvedAt)
    .sort((a, b) => (a.resolvedAt! < b.resolvedAt! ? 1 : -1))
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Resueltas recientemente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {error && (
          <p className="text-muted-foreground text-xs">
            No se pudieron cargar.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-xs">Cargando…</p>
        )}
        {data && recent.length === 0 && (
          <p className="text-muted-foreground text-xs">
            Sin resoluciones recientes.
          </p>
        )}
        {recent.map((workOrder) => (
          <Link
            key={workOrder.id}
            href={`/work-orders/${workOrder.id}`}
            className="hover:text-movos-blue flex items-center justify-between gap-2 text-xs transition-colors"
          >
            <span className="truncate">{workOrder.title}</span>
            <span className="text-muted-foreground shrink-0">
              {workOrder.resolvedAt ? formatRelative(workOrder.resolvedAt) : ''}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
