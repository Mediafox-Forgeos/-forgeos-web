'use client';

import type { ApiStationHealthSummary } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';
import { stationHealthDotColor } from './station-health-badge';

// Plural forms agreeing with "estaciones" (feminine plural) — a count
// label, not a single-station badge, so these aren't literally
// CONNECTIVITY_STATUS_LABELS's singular masculine forms, but they share
// the same root word for "offline"/"unknown" per the same reasoning
// documented in station-health-badge.tsx. WO-ARGOS-023 changed "offline"
// from "Fuera de línea" to "Desconectadas" specifically — that word,
// singular, is what every other real screen already used for the same
// ConnectivityStatus.OFFLINE value.
const rows: {
  key: keyof Omit<
    ApiStationHealthSummary,
    'organizationId' | 'siteId' | 'totalStations'
  >;
  label: string;
}[] = [
  { key: 'healthy', label: 'Saludables' },
  { key: 'degraded', label: 'Degradadas' },
  { key: 'offline', label: 'Desconectadas' },
  { key: 'unknown', label: 'Desconocidas' },
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
