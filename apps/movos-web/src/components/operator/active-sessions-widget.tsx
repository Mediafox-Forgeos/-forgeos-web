'use client';

import Link from 'next/link';

import type { ApiActiveSession } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatRelative } from '@/lib/format';
import { usePolledResource } from './use-polled-resource';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — the
 * ACTIVE_SESSIONS widget. Real ChargingSession data (CAP-004), no new
 * schema — see docs/implementation/CAPX_DATA_DEPENDENCIES.md.
 */
export function ActiveSessionsWidget() {
  const { data, loading, error } =
    usePolledResource<ApiActiveSession[]>('/sessions/active');

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
            <Badge tone={session.status === 'ACTIVE' ? 'info' : 'warning'}>
              {session.status === 'ACTIVE' ? 'Activa' : 'Suspendida'}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
