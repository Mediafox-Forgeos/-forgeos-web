'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { Plus } from 'lucide-react';

import type { ApiWorkOrder, WorkOrderStatus } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/movos/data-table';
import {
  WorkOrderStatusBadge,
  WorkOrderSourceLabel,
  workOrderPriorityOptions,
} from '@/components/work-orders/work-order-badges';
import { useAllStations } from '@/components/console/use-all-stations';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { apiClient } from '@/lib/api-client';
import { formatRelative } from '@/lib/format';

const STATUS_FILTERS: { label: string; status?: WorkOrderStatus }[] = [
  { label: 'Todas' },
  { label: 'Abiertas', status: 'OPEN' },
  { label: 'Asignadas', status: 'ASSIGNED' },
  { label: 'En progreso', status: 'IN_PROGRESS' },
  { label: 'Resueltas', status: 'RESOLVED' },
];

/**
 * Work Order V1 (WO-ARGOS-035) — "What problems are currently being
 * solved?" Every WorkOrder here traces back to a real station and, for
 * automated sources, a real trigger condition — see
 * docs/operations/WORK_ORDER_AUTOMATIONS.md.
 */
export default function WorkOrdersPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState<WorkOrderStatus | undefined>(
    undefined,
  );
  const path = filter ? `/work-orders?status=${filter}` : '/work-orders';
  const { data, loading, error, refetch } = usePolledResource<ApiWorkOrder[]>(
    path,
    30_000,
  );

  const [creating, setCreating] = React.useState(false);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS"
        title="Órdenes de trabajo"
        description="Qué problemas se están resolviendo ahora mismo."
        actions={
          <Button onClick={() => setCreating((v) => !v)}>
            <Plus className="mr-1.5 size-4" />
            Nueva orden de trabajo
          </Button>
        }
      />

      {creating && (
        <CreateWorkOrderForm
          onCreated={(id) => {
            setCreating(false);
            refetch();
            router.push(`/work-orders/${id}`);
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setFilter(f.status)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.status
                ? 'border-movos-blue bg-movos-blue/10 text-movos-blue'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las órdenes de trabajo.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && <WorkOrdersTable rows={data} />}
      </div>
    </PageContainer>
  );
}

function WorkOrdersTable({ rows }: { rows: ApiWorkOrder[] }) {
  const columns: Column<ApiWorkOrder>[] = [
    {
      key: 'title',
      header: 'Título',
      render: (row) => (
        <Link
          href={`/work-orders/${row.id}`}
          className="hover:text-movos-blue font-medium transition-colors"
        >
          {row.title}
        </Link>
      ),
    },
    { key: 'station', header: 'Estación', render: (row) => row.stationName },
    {
      key: 'assignee',
      header: 'Técnico',
      render: (row) => row.assignedMemberName ?? '—',
    },
    {
      key: 'source',
      header: 'Origen',
      render: (row) => <WorkOrderSourceLabel source={row.source} />,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <WorkOrderStatusBadge status={row.status} />,
    },
    {
      key: 'age',
      header: 'Antigüedad',
      render: (row) => formatRelative(row.createdAt),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyLabel="No hay órdenes de trabajo para este filtro."
    />
  );
}

function CreateWorkOrderForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}) {
  const { stations } = useAllStations();
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [priority, setPriority] = React.useState('MEDIUM');
  const [stationId, setStationId] = React.useState('');
  const [scheduledAt, setScheduledAt] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!title.trim() || !description.trim() || !stationId) {
      setError('Completa el título, la descripción y la estación.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiClient.post<ApiWorkOrder>('/work-orders', {
        title,
        description,
        priority,
        source: 'MANUAL',
        stationId,
        // datetime-local has no timezone — interpreted as America/Bogota,
        // this pilot's fixed display timezone (see src/lib/format.ts).
        ...(scheduledAt
          ? { scheduledAt: new Date(scheduledAt).toISOString() }
          : {}),
      });
      onCreated(created.id);
    } catch {
      setError('No se pudo crear la orden de trabajo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="space-y-3 p-5">
        <Input
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          placeholder="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="border-border bg-accent/40 h-9 rounded-lg border px-3 text-sm"
          >
            {workOrderPriorityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="border-border bg-accent/40 h-9 flex-1 rounded-lg border px-3 text-sm"
          >
            <option value="">Selecciona una estación…</option>
            {stations?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.siteName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">
            Visita programada (opcional)
          </label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="border-border bg-accent/40 h-9 rounded-lg border px-3 text-sm"
          />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <Button disabled={submitting} onClick={() => void submit()}>
            Crear
          </Button>
          <Button variant="ghost" disabled={submitting} onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
