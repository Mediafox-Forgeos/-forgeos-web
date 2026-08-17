'use client';

import Link from 'next/link';
import * as React from 'react';
import type {
  ApiChargingStation,
  ApiConnectorListItem,
  ApiEvse,
  ApiSite,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { ApiConnectorStatusBadge } from '@/components/movos/api-charging-status-badges';
import { FilterSelect } from '@/components/movos/filter-select';
import { apiClient } from '@/lib/api-client';
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
 * WO-ARGOS-054 — real global inventory of Connector. Replaces the previous
 * generic SiteSelectionList gateway. No dedicated Connector detail page
 * exists in MOVOS today, so each row drills into its parent EVSE's real
 * detail page, which already renders this exact connector via
 * ConnectorList — the closest real detail context, not a new route.
 */
export default function ConnectorsPage() {
  const [sites, setSites] = React.useState<ApiSite[]>([]);
  const [stations, setStations] = React.useState<ApiChargingStation[]>([]);
  const [evses, setEvses] = React.useState<ApiEvse[]>([]);
  const [siteId, setSiteId] = React.useState('');
  const [chargingStationId, setChargingStationId] = React.useState('');
  const [evseId, setEvseId] = React.useState('');
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

  React.useEffect(() => {
    setEvseId('');
    if (!chargingStationId) {
      setEvses([]);
      return;
    }
    void apiClient
      .get<ApiEvse[]>(`/charging-stations/${chargingStationId}/evses`)
      .then(setEvses)
      .catch(() => setEvses([]));
  }, [chargingStationId]);

  const params = new URLSearchParams();
  if (siteId) params.set('siteId', siteId);
  if (chargingStationId) params.set('chargingStationId', chargingStationId);
  if (evseId) params.set('evseId', evseId);
  if (status) params.set('status', status);
  const qs = params.toString();
  const path = `/connectors${qs ? `?${qs}` : ''}`;

  const { data, loading, error } = usePolledResource<ApiConnectorListItem[]>(
    path,
    30_000,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Conectores"
        description="Inventario real de conectores de toda la organización."
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
          label="Cargador"
          value={evseId}
          onChange={setEvseId}
          disabled={!chargingStationId}
          options={evses.map((e) => ({
            value: e.id,
            label: e.name ?? e.externalId ?? e.id,
          }))}
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
            No se pudieron cargar los conectores.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && <ConnectorsTable rows={data} />}
      </div>
    </PageContainer>
  );
}

function ConnectorsTable({ rows }: { rows: ApiConnectorListItem[] }) {
  const columns: Column<ApiConnectorListItem>[] = [
    {
      key: 'identifier',
      header: 'Identificador',
      render: (row) => (
        <Link
          href={`/sites/${row.siteId}/charging-stations/${row.chargingStationId}/evses/${row.evseId}`}
          className="hover:text-movos-blue font-medium transition-colors"
        >
          {row.externalId ?? row.id}
        </Link>
      ),
    },
    { key: 'type', header: 'Tipo', render: (row) => row.type },
    {
      key: 'power',
      header: 'Potencia máxima',
      render: (row) => (row.maxPowerKw ? `${row.maxPowerKw} kW` : '—'),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (row) => <ApiConnectorStatusBadge status={row.status} />,
    },
    {
      key: 'evse',
      header: 'Cargador',
      render: (row) => row.evseName ?? '—',
    },
    {
      key: 'station',
      header: 'Estación',
      render: (row) => row.chargingStationName,
    },
    { key: 'site', header: 'Sitio', render: (row) => row.siteName },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyLabel="No hay conectores que coincidan con estos filtros."
    />
  );
}
