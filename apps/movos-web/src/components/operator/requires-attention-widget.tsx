'use client';

import Link from 'next/link';
import { TriangleAlert, WifiOff } from 'lucide-react';
import type {
  ApiOfflineStation,
  ApiWorkOrderAttentionItem,
} from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ATTENTION_REASON_LABEL } from '@/components/work-orders/work-order-badges';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-051 — Operations Console, "Requires attention." Deterministic V1
 * only: every item here matched one of WorkOrderService.listAttentionItems'
 * 4 rules, or is a real ChargingStation with verified OFFLINE connectivity
 * (never UNKNOWN — see StationHealthService.listOfflineStations). No
 * scoring, no ranking, no AI. Two real, separate systems (WorkOrder,
 * station connectivity) composed in one panel for awareness — not merged
 * into a new shared entity.
 */
export function RequiresAttentionWidget() {
  const workOrders = usePolledResource<ApiWorkOrderAttentionItem[]>(
    '/work-orders/attention',
    30_000,
  );
  const stations = usePolledResource<ApiOfflineStation[]>(
    '/operator/offline-stations',
    30_000,
  );

  const loading =
    (workOrders.loading && !workOrders.data) ||
    (stations.loading && !stations.data);
  const bothErrored = workOrders.error && stations.error;
  const woItems = workOrders.data ?? [];
  const stationItems = stations.data ?? [];
  const total = woItems.length + stationItems.length;

  return (
    <Card className="border-amber-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-amber-400" aria-hidden="true" />
          Requiere atención{total > 0 ? ` (${total})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {bothErrored && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar el resumen de atención.
          </p>
        )}
        {!bothErrored && loading && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {!loading && !bothErrored && total === 0 && (
          <p className="text-muted-foreground text-sm">
            Nada requiere atención en este momento.
          </p>
        )}

        {woItems.map(({ workOrder, reasons }) => (
          <Link
            key={workOrder.id}
            href={`/work-orders/${workOrder.id}`}
            className="border-border hover:bg-accent/40 flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{workOrder.title}</p>
              <p className="text-muted-foreground truncate text-xs">
                {workOrder.stationName} ·{' '}
                {workOrder.assignedMemberName ?? 'Sin asignar'}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {reasons.map((reason) => (
                <Badge key={reason} tone="warning">
                  {ATTENTION_REASON_LABEL[reason]}
                </Badge>
              ))}
            </div>
          </Link>
        ))}

        {stationItems.map((station) => (
          <Link
            key={station.stationId}
            href={`/sites/${station.siteId}/charging-stations/${station.stationId}`}
            className="border-border hover:bg-accent/40 flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm transition-colors sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{station.stationName}</p>
              <p className="text-muted-foreground truncate text-xs">
                {station.siteName}
                {station.lastDisconnectedAt
                  ? ` · desconectada ${formatRelative(station.lastDisconnectedAt)}`
                  : ''}
              </p>
            </div>
            <Badge tone="danger">
              <WifiOff className="mr-1 inline size-3" aria-hidden="true" />
              Desconectada
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
