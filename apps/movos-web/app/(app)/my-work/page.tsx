'use client';

import Link from 'next/link';
import * as React from 'react';

import type { ApiWorkOrder } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/movos/data-table';
import {
  WorkOrderStatusBadge,
  WorkOrderPriorityBadge,
} from '@/components/work-orders/work-order-badges';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { formatRelative } from '@/lib/format';

/**
 * Technician Identity & My Work (WO-ARGOS-037), Screen 1 —
 * "What do I need to do today, and which is most urgent?" Every row here
 * is a real WorkOrder assigned to the current technician, scoped
 * server-side by MyWorkController — see
 * docs/operations/FIELD_TECHNICIAN_CONSOLE.md.
 */
export default function MyWorkPage() {
  const { data, loading, error } = usePolledResource<ApiWorkOrder[]>(
    '/my-work',
    30_000,
  );

  const workOrders = data ?? [];
  const inProgress = workOrders.filter((wo) => wo.status === 'IN_PROGRESS');
  const assigned = workOrders.filter((wo) => wo.status === 'ASSIGNED');
  // Local calendar day, same comparison basis "Completadas hoy" has always
  // used (WO-ARGOS-037) — WO-ARGOS-050 doesn't introduce a new timezone
  // model, just a second bucket on the same basis: a RESOLVED WorkOrder
  // is either resolved today (completedToday) or it isn't (historial).
  // Mutually exclusive by construction, both derived from the one
  // /my-work fetch already being made — no new API call.
  const today = new Date().toDateString();
  const completedToday = workOrders.filter(
    (wo) =>
      wo.status === 'RESOLVED' &&
      wo.resolvedAt &&
      new Date(wo.resolvedAt).toDateString() === today,
  );
  // WO-ARGOS-050 — "Historial": RESOLVED WorkOrders from before today,
  // newest first, so a technician can still reach yesterday's (or older)
  // completed work once it ages out of "Completadas hoy". Named
  // deliberately smaller than a full history feature per the work order's
  // own scope: no search, no pagination, no filters yet.
  const historial = workOrders
    .filter(
      (wo) =>
        wo.status === 'RESOLVED' &&
        wo.resolvedAt &&
        new Date(wo.resolvedAt).toDateString() !== today,
    )
    .sort(
      (a, b) =>
        new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime(),
    );
  const activeCount = inProgress.length + assigned.length;
  const avgResolutionMinutes = averageResolutionMinutes(
    workOrders.filter((wo) => wo.status === 'RESOLVED'),
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS"
        title="Mi trabajo"
        description="Qué necesito hacer hoy, y qué es más urgente."
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Completadas hoy"
          value={String(completedToday.length)}
        />
        <SummaryStat label="Tareas activas" value={String(activeCount)} />
        <SummaryStat
          label="Tiempo promedio de resolución"
          value={
            avgResolutionMinutes != null ? `${avgResolutionMinutes} min` : '—'
          }
        />
        <SummaryStat label="Carga de hoy" value={String(workOrders.length)} />
      </div>

      {error && (
        <p className="text-muted-foreground mt-6 text-sm">
          No se pudo cargar tu trabajo asignado.
        </p>
      )}
      {!error && loading && !data && (
        <p className="text-muted-foreground mt-6 text-sm">Cargando…</p>
      )}

      {data && (
        <div className="mt-6 space-y-6">
          <WorkOrderSection
            title="Vencidas"
            rows={[]}
            emptyLabel="No disponible todavía — esta versión de Orden de Trabajo no registra fecha límite ni SLA."
          />
          <WorkOrderSection
            title="En progreso"
            rows={sortByPriorityThenAge(inProgress)}
            emptyLabel="No tienes tareas en progreso."
          />
          <WorkOrderSection
            title="Asignadas"
            rows={sortByPriorityThenAge(assigned)}
            emptyLabel="No tienes tareas asignadas pendientes de iniciar."
          />
          <WorkOrderSection
            title="Completadas hoy"
            rows={completedToday}
            emptyLabel="Todavía no has completado ninguna tarea hoy."
          />
          <WorkOrderSection
            title="Historial"
            rows={historial}
            emptyLabel="Todavía no tienes tareas completadas de días anteriores."
          />
        </div>
      )}
    </PageContainer>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-[-0.02em]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function WorkOrderSection({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: ApiWorkOrder[];
  emptyLabel: string;
}) {
  const columns: Column<ApiWorkOrder>[] = [
    {
      key: 'priority',
      header: 'Prioridad',
      render: (row) => <WorkOrderPriorityBadge priority={row.priority} />,
    },
    {
      key: 'title',
      header: 'Tarea',
      render: (row) => (
        <Link
          href={`/my-work/${row.id}`}
          className="hover:text-movos-blue font-medium transition-colors"
        >
          {row.title}
        </Link>
      ),
    },
    { key: 'station', header: 'Estación', render: (row) => row.stationName },
    {
      key: 'age',
      header: 'Antigüedad',
      render: (row) => formatRelative(row.createdAt),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <WorkOrderStatusBadge status={row.status} />,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyLabel={emptyLabel}
        />
      </CardContent>
    </Card>
  );
}

function sortByPriorityThenAge(rows: ApiWorkOrder[]): ApiWorkOrder[] {
  const priorityRank: Record<ApiWorkOrder['priority'], number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  return [...rows].sort((a, b) => {
    const byPriority = priorityRank[a.priority] - priorityRank[b.priority];
    if (byPriority !== 0) return byPriority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function averageResolutionMinutes(resolved: ApiWorkOrder[]): number | null {
  const durations = resolved
    .filter((wo) => wo.startedAt && wo.resolvedAt)
    .map(
      (wo) =>
        (new Date(wo.resolvedAt!).getTime() -
          new Date(wo.startedAt!).getTime()) /
        60000,
    );
  if (durations.length === 0) return null;
  return Math.round(
    durations.reduce((sum, m) => sum + m, 0) / durations.length,
  );
}
