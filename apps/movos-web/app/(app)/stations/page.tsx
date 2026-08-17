'use client';

import Link from 'next/link';
import * as React from 'react';
import type {
  ApiChargingStationListItem,
  ApiSite,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import {
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
} from '@/components/movos/api-charging-status-badges';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { FilterSelect } from '@/components/movos/filter-select';

const STATUS_OPTIONS = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];
const CONNECTIVITY_OPTIONS = ['ONLINE', 'OFFLINE', 'UNKNOWN'];

/**
 * WO-ARGOS-054 — real global inventory of ChargingStation, replacing the
 * previous redirect('/sites'). "Estaciones" now shows what it says.
 */
export default function StationsPage() {
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [siteId, setSiteId] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [connectivityStatus, setConnectivityStatus] = React.useState('');

  React.useEffect(() => {
    void apiClient
      .get<ApiSite[]>('/sites')
      .then(setSites)
      .catch(() => {});
  }, []);

  const params = new URLSearchParams();
  if (siteId) params.set('siteId', siteId);
  if (status) params.set('status', status);
  if (connectivityStatus) params.set('connectivityStatus', connectivityStatus);
  const qs = params.toString();
  const path = `/charging-stations${qs ? `?${qs}` : ''}`;

  const { data, loading, error } = usePolledResource<
    ApiChargingStationListItem[]
  >(path, 30_000);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Estaciones"
        description="Inventario real de estaciones de carga (ChargingStation) de toda la organización."
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <FilterSelect
          label="Sitio"
          value={siteId}
          onChange={setSiteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label="Estado"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
        <FilterSelect
          label="Conectividad"
          value={connectivityStatus}
          onChange={setConnectivityStatus}
          options={CONNECTIVITY_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="mt-4">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las estaciones.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && <StationsTable rows={data} />}
      </div>
    </PageContainer>
  );
}

function StationsTable({ rows }: { rows: ApiChargingStationListItem[] }) {
  const columns: Column<ApiChargingStationListItem>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <Link
          href={`/sites/${row.siteId}/charging-stations/${row.id}`}
          className="hover:text-movos-blue font-medium transition-colors"
        >
          {row.name}
        </Link>
      ),
    },
    { key: 'site', header: 'Sitio', render: (row) => row.siteName },
    { key: 'code', header: 'Código', render: (row) => row.code ?? '—' },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <ApiChargingStationStatusBadge status={row.status} />,
    },
    {
      key: 'connectivity',
      header: 'Conectividad',
      render: (row) => (
        <ApiConnectivityStatusBadge status={row.connectivityStatus} />
      ),
    },
    {
      key: 'protocol',
      header: 'Protocolo / última conexión',
      render: (row) =>
        [
          row.protocol ?? row.lastProtocolVersion,
          row.lastSeenAt ? formatDateTime(row.lastSeenAt) : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Sin especificar',
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyLabel="No hay estaciones que coincidan con estos filtros."
    />
  );
}
