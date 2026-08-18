'use client';

import Link from 'next/link';
import { TriangleAlert, WifiOff } from 'lucide-react';
import type {
  ApiEvseListItem,
  ApiOfflineStation,
  ApiWorkOrderAttentionItem,
} from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ATTENTION_REASON_LABEL } from '@/components/work-orders/work-order-badges';
import { EVSE_ATTENTION_REASON_LABEL } from '@/components/movos/api-charging-status-badges';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';
import { buildAttentionGroups, type AttentionGroup } from './unified-attention';

const SOURCE_LABEL: Record<'evses' | 'workOrders' | 'offline', string> = {
  evses: 'cargadores',
  workOrders: 'órdenes de trabajo',
  offline: 'estaciones desconectadas',
};

/**
 * WO-ARGOS-057 — Operations Console P0 block, "Requiere atención." Replaces
 * the previous two-source widget with a genuinely unified, deduplicated
 * view — see unified-attention.ts for the merge/dedup logic itself (kept
 * separate and independently tested). Still deterministic, still no
 * scoring/ranking beyond real operational-impact ordering, no AI.
 */
export function UnifiedAttentionWidget() {
  const evsesRes = usePolledResource<ApiEvseListItem[]>('/evses', 30_000);
  const workOrdersRes = usePolledResource<ApiWorkOrderAttentionItem[]>(
    '/work-orders/attention',
    30_000,
  );
  const offlineRes = usePolledResource<ApiOfflineStation[]>(
    '/operator/offline-stations',
    30_000,
  );

  const stillLoading =
    (evsesRes.loading && !evsesRes.data) ||
    (workOrdersRes.loading && !workOrdersRes.data) ||
    (offlineRes.loading && !offlineRes.data);
  const allErrored = evsesRes.error && workOrdersRes.error && offlineRes.error;
  const failedSources = (
    [
      evsesRes.error ? 'evses' : null,
      workOrdersRes.error ? 'workOrders' : null,
      offlineRes.error ? 'offline' : null,
    ] as const
  ).filter((s): s is 'evses' | 'workOrders' | 'offline' => s !== null);
  const anyErrored = failedSources.length > 0;

  const groups = buildAttentionGroups(
    evsesRes.data ?? [],
    workOrdersRes.data ?? [],
    offlineRes.data ?? [],
  );

  return (
    <Card className="border-amber-900/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert className="size-4 text-amber-400" aria-hidden="true" />
          Requiere atención{groups.length > 0 ? ` (${groups.length})` : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {allErrored && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar el resumen de atención.
          </p>
        )}

        {!allErrored && stillLoading && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}

        {/* Honest partial-data state (WO-ARGOS-057) — a partial fetch
            failure must never render a count/list that silently looks
            complete. This banner is shown whenever any source failed, even
            while the successfully-loaded sources still render below. */}
        {!allErrored && !stillLoading && anyErrored && (
          <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-400">
            Esta lista puede estar incompleta — no se pudo cargar:{' '}
            {failedSources.map((s) => SOURCE_LABEL[s]).join(', ')}.
          </p>
        )}

        {!allErrored && !stillLoading && !anyErrored && groups.length === 0 && (
          <p className="text-muted-foreground text-sm">
            Nada requiere atención en este momento.
          </p>
        )}

        {!allErrored &&
          !stillLoading &&
          groups.map((group) => (
            <AttentionGroupCard key={group.stationId} group={group} />
          ))}
      </CardContent>
    </Card>
  );
}

function AttentionGroupCard({ group }: { group: AttentionGroup }) {
  const stationHref = group.siteId
    ? `/sites/${group.siteId}/charging-stations/${group.stationId}`
    : null;

  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        {stationHref ? (
          <Link
            href={stationHref}
            className="truncate font-medium hover:underline"
          >
            {group.stationName}
          </Link>
        ) : (
          <span className="truncate font-medium">{group.stationName}</span>
        )}
        {group.siteName && (
          <span className="text-muted-foreground truncate text-xs">
            {group.siteName}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1">
        {group.offline && (
          <Badge tone="danger">
            <WifiOff className="mr-1 inline size-3" aria-hidden="true" />
            Desconectada
            {group.offline.lastDisconnectedAt
              ? ` · ${formatRelative(group.offline.lastDisconnectedAt)}`
              : ''}
          </Badge>
        )}

        {group.evseIssues.map((issue) => {
          const evseHref = group.siteId
            ? `/sites/${group.siteId}/charging-stations/${group.stationId}/evses/${issue.evseId}`
            : null;
          const label = `${issue.evseName}: ${issue.reasons
            .map((r) => EVSE_ATTENTION_REASON_LABEL[r] ?? r)
            .join(', ')}`;
          return evseHref ? (
            <Link key={issue.evseId} href={evseHref}>
              <Badge tone="warning">{label}</Badge>
            </Link>
          ) : (
            <Badge key={issue.evseId} tone="warning">
              {label}
            </Badge>
          );
        })}

        {group.workOrders.map(({ workOrder, reasons }) => (
          <Link key={workOrder.id} href={`/work-orders/${workOrder.id}`}>
            <Badge tone="warning">
              {workOrder.title} ·{' '}
              {reasons.map((r) => ATTENTION_REASON_LABEL[r]).join(', ')}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
