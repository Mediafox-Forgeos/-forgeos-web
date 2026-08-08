'use client';

import Link from 'next/link';

import type { ApiChargingSession } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiChargingSessionStatusBadge } from '@/components/movos/api-charging-status-badges';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — the
 * ACTIVE_SESSIONS widget. Real ChargingSession data (CAP-004), no new
 * schema — see docs/implementation/CAPX_DATA_DEPENDENCIES.md. Each row
 * links to a now-real session detail page (WO-ARGOS-023 fixed the 404
 * this used to hit — see docs/product/OPERATIONAL_VOCABULARY.md).
 */
export function ActiveSessionsWidget() {
  const { data, loading, error } =
    usePolledResource<ApiChargingSession[]>('/sessions/active');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sesiones activas{data ? ` (${data.length})` : ''}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudieron cargar las sesiones activas.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No hay sesiones activas en este momento.
          </p>
        )}
        {data?.map((session) => (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="border-border hover:bg-accent/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            <div>
              <p className="font-medium">{session.chargingStationName}</p>
              <p className="text-muted-foreground text-xs">
                {session.siteName} · {(session.energyWh / 1000).toFixed(1)} kWh
                · iniciada {formatRelative(session.startedAt)}
              </p>
            </div>
            <ApiChargingSessionStatusBadge status={session.status} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
