'use client';

import type { ApiStationHealthSummary } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';
import { stationHealthDotColor } from './station-health-badge';

const rows: {
  key: keyof Omit<
    ApiStationHealthSummary,
    'organizationId' | 'siteId' | 'totalStations'
  >;
  label: string;
}[] = [
  { key: 'healthy', label: 'Saludables' },
  { key: 'degraded', label: 'Degradadas' },
  { key: 'offline', label: 'Fuera de línea' },
  { key: 'unknown', label: 'Desconocido' },
];

/** CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022). */
export function StationStatusWidget() {
  const { data, loading, error } = usePolledResource<ApiStationHealthSummary>(
    '/operator/fleet-status',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estado de estaciones</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar el estado de las estaciones.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && (
          <div className="space-y-3">
            <p className="text-2xl font-semibold tracking-[-0.02em]">
              {formatNumber(data.totalStations)}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                estaciones activas
              </span>
            </p>
            <div className="space-y-2">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{
                        backgroundColor:
                          stationHealthDotColor[
                            row.key as keyof typeof stationHealthDotColor
                          ],
                      }}
                    />
                    {row.label}
                  </span>
                  <span className="font-medium">
                    {formatNumber(data[row.key])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
