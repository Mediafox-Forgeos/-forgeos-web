'use client';

import type { ApiAction } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';
import { severityLabel, severityTone } from './operational-intelligence-widget';

function ActionColumn({
  title,
  actions,
  emptyLabel,
}: {
  title: string;
  actions: ApiAction[];
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-[0.08em]">
        {title} ({actions.length})
      </p>
      <div className="space-y-2">
        {actions.length === 0 && (
          <p className="text-muted-foreground text-xs">{emptyLabel}</p>
        )}
        {actions.map((a) => (
          <div key={a.id} className="border-border rounded-lg border px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium">{a.title}</p>
              <Badge tone={severityTone[a.severity]}>
                {severityLabel[a.severity]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {a.chargingStationName}
            </p>
            {a.assignedToUserName && (
              <p className="text-muted-foreground text-xs">
                Asignada a {a.assignedToUserName}
              </p>
            )}
            {a.notes && (
              <p className="text-muted-foreground mt-1 text-xs">{a.notes}</p>
            )}
            <p className="text-muted-foreground mt-1 text-[11px]">
              Actualizada {formatRelative(a.updatedAt)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Operational Execution Layer (WO-ARGOS-026), Objective 4 — the persisted,
 * historical counterpart to the live Operational Intelligence widget.
 * Shows every real Action regardless of whether its originating
 * recommendation is still live (unlike the widget above, which only shows
 * actions attached to a currently-computed recommendation) — an operator
 * reviewing what got resolved last week needs this even after
 * RecommendationService has long stopped returning that condition.
 */
export function OperationalActionsSection() {
  const { data, loading, error } = usePolledResource<ApiAction[]>(
    '/actions',
    30_000,
  );

  const pending =
    data?.filter((a) => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED') ??
    [];
  const assigned = data?.filter((a) => a.status === 'ASSIGNED') ?? [];
  const resolved =
    data?.filter((a) => a.status === 'RESOLVED' || a.status === 'DISMISSED') ??
    [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones operativas</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las acciones.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && (
          <div className="grid gap-4 lg:grid-cols-3">
            <ActionColumn
              title="Pendientes"
              actions={pending}
              emptyLabel="Sin acciones pendientes."
            />
            <ActionColumn
              title="Asignadas"
              actions={assigned}
              emptyLabel="Sin acciones asignadas."
            />
            <ActionColumn
              title="Resueltas"
              actions={resolved}
              emptyLabel="Sin acciones resueltas."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
