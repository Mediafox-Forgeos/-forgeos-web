'use client';

import Link from 'next/link';
import type {
  ApiConnectivitySummary,
  ApiOccupancySummary,
  ApiSite,
} from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-057 — Operations Console P1 block, "¿Está funcionando mi red?".
 * A single compact reorganization of data that already had its own
 * scattered cards (ConnectivityWidget, OccupancyWidget) plus a plain site
 * count — same three existing endpoints (/sites, /operator/connectivity,
 * /operator/occupancy), no new backend aggregation. ConnectivityWidget and
 * OccupancyWidget are superseded by this widget on /dashboard (same
 * deferred-cleanup precedent as SiteSelectionList after WO-054: not deleted
 * on the same WO that orphans them — see WO_057_IMPLEMENTATION_REPORT).
 */
export function NetworkHealthWidget() {
  const sitesRes = usePolledResource<ApiSite[]>('/sites', 30_000);
  const connectivityRes = usePolledResource<ApiConnectivitySummary>(
    '/operator/connectivity',
    15_000,
  );
  const occupancyRes = usePolledResource<ApiOccupancySummary>(
    '/operator/occupancy',
    15_000,
  );

  const stillLoading =
    (sitesRes.loading && !sitesRes.data) ||
    (connectivityRes.loading && !connectivityRes.data) ||
    (occupancyRes.loading && !occupancyRes.data);
  const allErrored =
    sitesRes.error && connectivityRes.error && occupancyRes.error;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Red — ahora mismo</CardTitle>
      </CardHeader>
      <CardContent>
        {allErrored && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar el estado de la red.
          </p>
        )}
        {!allErrored && stillLoading && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {!allErrored && !stillLoading && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric
              href="/sites"
              value={sitesRes.data?.length ?? null}
              label="sitios"
              error={sitesRes.error}
            />

            <div>
              <Link
                href="/stations"
                className="text-2xl font-semibold tracking-[-0.02em] hover:underline"
              >
                {connectivityRes.data
                  ? formatNumber(connectivityRes.data.totalStations)
                  : '—'}
              </Link>
              <p className="text-muted-foreground text-xs">estaciones</p>
              {connectivityRes.error ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  No se pudo cargar la conectividad.
                </p>
              ) : (
                connectivityRes.data && (
                  <p className="mt-1 text-xs">
                    <span className="text-emerald-400">
                      {formatNumber(connectivityRes.data.online)} en línea
                    </span>
                    {' · '}
                    <span className="text-red-400">
                      {formatNumber(connectivityRes.data.offline)} desconectadas
                    </span>
                    {' · '}
                    <span className="text-muted-foreground">
                      {formatNumber(connectivityRes.data.unknown)} desconocidas
                    </span>
                  </p>
                )
              )}
            </div>

            <div>
              <Link
                href="/connectors"
                className="text-2xl font-semibold tracking-[-0.02em] hover:underline"
              >
                {occupancyRes.data
                  ? formatNumber(occupancyRes.data.totalConnectors)
                  : '—'}
              </Link>
              <p className="text-muted-foreground text-xs">conectores</p>
              {occupancyRes.error ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  No se pudo cargar la ocupación.
                </p>
              ) : (
                occupancyRes.data && (
                  <p className="mt-1 text-xs">
                    <span className="text-emerald-400">
                      {formatNumber(
                        occupancyRes.data.connectorStatusCounts.AVAILABLE,
                      )}{' '}
                      disponibles
                    </span>
                    {' · '}
                    <span className="text-movos-blue">
                      {formatNumber(
                        occupancyRes.data.connectorStatusCounts.CHARGING +
                          occupancyRes.data.connectorStatusCounts.OCCUPIED,
                      )}{' '}
                      en uso
                    </span>
                    {' · '}
                    <span className="text-muted-foreground">
                      {formatNumber(
                        occupancyRes.data.connectorStatusCounts.UNAVAILABLE,
                      )}{' '}
                      no disponibles
                    </span>
                    {' · '}
                    <span className="text-red-400">
                      {formatNumber(
                        occupancyRes.data.connectorStatusCounts.FAULTED,
                      )}{' '}
                      con falla
                    </span>
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  href,
  value,
  label,
  error,
}: {
  href: string;
  value: number | null;
  label: string;
  error: boolean;
}) {
  return (
    <div>
      <Link
        href={href}
        className="text-2xl font-semibold tracking-[-0.02em] hover:underline"
      >
        {value === null ? '—' : formatNumber(value)}
      </Link>
      <p className="text-muted-foreground text-xs">{label}</p>
      {error && (
        <p className="text-muted-foreground mt-1 text-xs">No se pudo cargar.</p>
      )}
    </div>
  );
}
