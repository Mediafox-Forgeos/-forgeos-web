'use client';

import Link from 'next/link';
import * as React from 'react';
import type {
  ApiChargingStation,
  ApiEvseListItem,
  ApiSite,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import {
  OperationalStatusBadge,
  RequiresAttentionIndicator,
} from '@/components/movos/api-charging-status-badges';
import { FilterSelect } from '@/components/movos/filter-select';
import { apiClient } from '@/lib/api-client';
import { formatConnectorAvailability } from '@/lib/format';
import { usePolledResource } from '@/components/operator/use-polled-resource';

const STATUS_OPTIONS = [
  'AVAILABLE',
  'CHARGING',
  'OCCUPIED',
  'RESERVED',
  'UNAVAILABLE',
  'FAULTED',
  'OFFLINE',
];

/**
 * WO-ARGOS-054 — real global inventory of Evse ("Cargador" is the friendly
 * UX name; the entity stays Evse internally, see
 * docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md). Replaces the
 * previous generic SiteSelectionList gateway.
 */
export default function ChargersPage() {
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [stations, setStations] = React.useState<ApiChargingStation[]>([]);
  const [siteId, setSiteId] = React.useState('');
  const [chargingStationId, setChargingStationId] = React.useState('');
  const [status, setStatus] = React.useState('');

  React.useEffect(() => {
    void apiClient
      .get<ApiSite[]>('/sites')
      .then(setSites)
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    setChargingStationId('');
    if (!siteId) {
      setStations([]);
      return;
    }
    void apiClient
      .get<ApiChargingStation[]>(`/sites/${siteId}/charging-stations`)
      .then(setStations)
      .catch(() => setStations([]));
  }, [siteId]);

  const params = new URLSearchParams();
  if (siteId) params.set('siteId', siteId);
  if (chargingStationId) params.set('chargingStationId', chargingStationId);
  if (status) params.set('status', status);
  const qs = params.toString();
  const path = `/evses${qs ? `?${qs}` : ''}`;

  const { data, loading, error } = usePolledResource<ApiEvseListItem[]>(
    path,
    30_000,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Cargadores"
        description="Inventario real de cargadores (EVSE) de toda la organización."
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <FilterSelect
          label="Sitio"
          value={siteId}
          onChange={setSiteId}
          options={sites.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label="Estación"
          value={chargingStationId}
          onChange={setChargingStationId}
          disabled={!siteId}
          options={stations.map((s) => ({ value: s.id, label: s.name }))}
        />
        <FilterSelect
          label="Estado"
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
        />
      </div>

      <div className="mt-4">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar los cargadores.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && <ChargersTable rows={data} />}
      </div>
    </PageContainer>
  );
}

function ChargersTable({ rows }: { rows: ApiEvseListItem[] }) {
  const columns: Column<ApiEvseListItem>[] = [
    {
      key: 'name',
      header: 'Nombre',
      render: (row) => (
        <Link
          href={`/sites/${row.siteId}/charging-stations/${row.chargingStationId}/evses/${row.id}`}
          className="hover:text-movos-blue font-medium transition-colors"
        >
          {row.name ?? row.externalId ?? row.id}
        </Link>
      ),
    },
    {
      key: 'station',
      header: 'Estación',
      render: (row) => row.chargingStationName,
    },
    { key: 'site', header: 'Sitio', render: (row) => row.siteName },
    {
      key: 'power',
      header: 'Potencia máxima',
      render: (row) => (row.maxPowerKw ? `${row.maxPowerKw} kW` : '—'),
    },
    {
      key: 'current',
      header: 'Tipo de corriente',
      render: (row) => row.currentType ?? '—',
    },
    {
      key: 'availability',
      header: 'Conectores',
      render: (row) =>
        formatConnectorAvailability(
          row.connectorSummary.available,
          row.connectorSummary.total,
        ),
    },
    {
      key: 'operationalStatus',
      header: 'Estado operacional',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <OperationalStatusBadge status={row.operationalStatus} />
          <RequiresAttentionIndicator reasons={row.attentionReasons} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyLabel="No hay cargadores que coincidan con estos filtros."
    />
  );
}
