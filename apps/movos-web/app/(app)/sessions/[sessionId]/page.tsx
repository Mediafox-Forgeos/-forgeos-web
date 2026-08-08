'use client';

import { useParams } from 'next/navigation';
import * as React from 'react';

import type { ApiChargingSession, ApiMeterValue } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { ApiChargingSessionStatusBadge } from '@/components/movos/api-charging-status-badges';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

/**
 * WO-ARGOS-023 (Operational Consistency Hardening). Replaces the previous
 * fixture-backed page (data/sessions.ts) — its fictional "events" timeline
 * is replaced by a real one built from GET /sessions/:id/meter-values,
 * rather than simply deleted, since a real timeline was available and
 * more useful than none. Fixes the 404 the active-sessions widget hit
 * every time (docs/product/OPERATOR_USABILITY_REVIEW.md, confusion
 * finding #2) — that widget always linked to a real session id; this page
 * just never recognized one.
 */
export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = React.useState<ApiChargingSession | null>(null);
  const [meterValues, setMeterValues] = React.useState<ApiMeterValue[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');

  React.useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setState('loading');
      try {
        const data = await apiClient.get<ApiChargingSession>(
          `/sessions/${sessionId}`,
        );
        if (cancelled) return;
        setSession(data);
        try {
          const values = await apiClient.get<ApiMeterValue[]>(
            `/sessions/${sessionId}/meter-values`,
          );
          if (!cancelled) setMeterValues(values);
        } catch {
          // Telemetry is optional (DEC-016) — a session with no MeterValue
          // rows is still a fully valid, resolvable session.
        }
        setState('ready');
      } catch (err) {
        if (!cancelled) {
          setState(
            err instanceof ApiError && err.status === 404
              ? 'notfound'
              : 'error',
          );
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state === 'loading') {
    return (
      <PageContainer>
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted mt-4 h-40 animate-pulse rounded" />
      </PageContainer>
    );
  }

  if (state === 'notfound') {
    return (
      <PageContainer>
        <EmptyState title="Sesión de carga no encontrada." />
      </PageContainer>
    );
  }

  if (state === 'error' || !session) {
    return (
      <PageContainer>
        <EmptyState title="No fue posible cargar la sesión de carga." />
      </PageContainer>
    );
  }

  const summary: Array<[string, string]> = [
    ['Energía entregada', `${(session.energyWh / 1000).toFixed(2)} kWh`],
    ['Inicio', formatDateTime(session.startedAt)],
    ['Fin', session.endedAt ? formatDateTime(session.endedAt) : 'En curso'],
    ['Sitio', session.siteName],
    ['Estación', session.chargingStationName],
    ['Conector', session.connectorId],
    ['Protocolo', session.protocolVersion],
    ['ID de transacción', session.protocolTransactionId],
    ...(session.terminationReason
      ? ([['Motivo de finalización', session.terminationReason]] as Array<
          [string, string]
        >)
      : []),
  ];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sesiones', href: '/sessions' },
          { label: session.id },
        ]}
        title={`Sesión ${session.id}`}
        description={`${session.chargingStationName} · ${session.siteName}`}
        actions={<ApiChargingSessionStatusBadge status={session.status} />}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {summary.map(([label, value]) => (
              <div key={label}>
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="mt-1 text-sm font-medium">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telemetría (MeterValues)</CardTitle>
          </CardHeader>
          <CardContent>
            {meterValues.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Esta sesión no tiene lecturas de telemetría registradas — el
                total de energía se calcula igualmente a partir de la lectura
                inicial y final del medidor.
              </p>
            ) : (
              <div className="space-y-3">
                {meterValues.map((mv) => (
                  <div key={mv.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="bg-movos-blue mt-1.5 size-2 rounded-full" />
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium">
                        {(mv.energyWh / 1000).toFixed(2)} kWh
                        {mv.powerW !== null ? ` · ${mv.powerW} W` : ''}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {formatDateTime(mv.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
