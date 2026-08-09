'use client';

import * as React from 'react';

import type {
  ApiChargingStation,
  ApiEvse,
  ApiSite,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import {
  ApiChargingStationStatusBadge,
  ApiConnectivityStatusBadge,
  ApiEvseStatusBadge,
} from '@/components/movos/api-charging-status-badges';
import { FleetMap } from '@/components/operator/fleet-map';
import { ConnectivityWidget } from '@/components/operator/connectivity-widget';
import { OccupancyWidget } from '@/components/operator/occupancy-widget';
import { ContextDrawer } from '@/components/console/context-drawer';
import { apiClient } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

type StationRow = ApiChargingStation & { siteName: string };

/**
 * Kylum Console — Screen 2, Network (WO-ARGOS-030/031). "Where are my
 * operational problems?" A full-width live map plus a station list spanning
 * every site — composed client-side from the real, existing per-site
 * endpoint (GET /sites/:siteId/charging-stations), since no org-wide
 * station-list endpoint exists (WO-ARGOS-005's standing ruling, respected
 * here rather than worked around). No backend change; this is real data,
 * just assembled in the browser instead of the database.
 */
export default function NetworkPage() {
  const [stations, setStations] = React.useState<StationRow[] | null>(null);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<StationRow | null>(null);
  const [selectedEvses, setSelectedEvses] = React.useState<ApiEvse[] | null>(
    null,
  );

  const loadStations = React.useCallback(async () => {
    try {
      const sites = await apiClient.get<ApiSite[]>('/sites');
      const perSite = await Promise.all(
        sites.map((site) =>
          apiClient
            .get<ApiChargingStation[]>(`/sites/${site.id}/charging-stations`)
            .then((list) =>
              list.map((station) => ({ ...station, siteName: site.name })),
            ),
        ),
      );
      setStations(perSite.flat());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    void loadStations();
    const timer = setInterval(() => void loadStations(), 30_000);
    return () => clearInterval(timer);
  }, [loadStations]);

  React.useEffect(() => {
    if (!selected) {
      setSelectedEvses(null);
      return;
    }
    let cancelled = false;
    apiClient
      .get<ApiEvse[]>(`/charging-stations/${selected.id}/evses`)
      .then((evses) => {
        if (!cancelled) setSelectedEvses(evses);
      })
      .catch(() => {
        if (!cancelled) setSelectedEvses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const columns: Column<StationRow>[] = [
    {
      key: 'name',
      header: 'Estación',
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    { key: 'site', header: 'Sitio', render: (row) => row.siteName },
    {
      key: 'connectivity',
      header: 'Conectividad',
      render: (row) => (
        <ApiConnectivityStatusBadge status={row.connectivityStatus} />
      ),
    },
    {
      key: 'status',
      header: 'Estado administrativo',
      render: (row) => <ApiChargingStationStatusBadge status={row.status} />,
    },
  ];

  return (
    <PageContainer className="max-w-none">
      <PageHeader
        eyebrow="MOVOS · Red"
        title="Red de carga"
        description="Dónde están tus problemas operativos ahora mismo."
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">
          Mapa en vivo
        </h2>
        <FleetMap height={480} />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ConnectivityWidget />
        <OccupancyWidget />
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">
          Estaciones{stations ? ` (${stations.length})` : ''}
        </h2>
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar la lista de estaciones.
          </p>
        )}
        {!error && !stations && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {stations && (
          <DataTable
            columns={columns.map((col) => ({
              ...col,
              render: (row: StationRow) => (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelected(row)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setSelected(row);
                  }}
                  className="block cursor-pointer"
                >
                  {col.render(row)}
                </span>
              ),
            }))}
            rows={stations}
            getRowKey={(row) => row.id}
            emptyLabel="No hay estaciones registradas en esta organización."
          />
        )}
      </section>

      <ContextDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ''}
        subtitle={selected?.siteName}
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap gap-2">
              <ApiConnectivityStatusBadge
                status={selected.connectivityStatus}
              />
              <ApiChargingStationStatusBadge status={selected.status} />
            </div>

            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Fabricante</dt>
                <dd>{selected.manufacturer ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Modelo</dt>
                <dd>{selected.model ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Última conexión</dt>
                <dd>
                  {selected.lastConnectedAt
                    ? formatDateTime(selected.lastConnectedAt)
                    : '—'}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-[0.08em]">
                EVSEs
              </h3>
              {selectedEvses === null && (
                <p className="text-muted-foreground text-sm">Cargando…</p>
              )}
              {selectedEvses && selectedEvses.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  Esta estación no tiene EVSEs registrados.
                </p>
              )}
              <div className="space-y-2">
                {selectedEvses?.map((evse) => (
                  <div
                    key={evse.id}
                    className="border-border flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span>{evse.name ?? evse.externalId ?? evse.id}</span>
                    <ApiEvseStatusBadge status={evse.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </ContextDrawer>
    </PageContainer>
  );
}
