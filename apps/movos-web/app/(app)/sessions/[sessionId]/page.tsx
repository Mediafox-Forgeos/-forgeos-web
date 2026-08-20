'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as React from 'react';

import type { ApiChargingSession, ApiMeterValue } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { ApiChargingSessionStatusBadge } from '@/components/movos/api-charging-status-badges';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient, ApiError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/context/auth-context';
import { RemoteStopDialog } from '@/components/charging/remote-stop-dialog';

type LoadState = 'loading' | 'ready' | 'notfound' | 'error';

// WO-ARGOS-064 — the same "logically active/stoppable" set the backend's
// own RemoteStop precondition enforces (session-lifecycle.service.ts's
// STOPPABLE states, ACTIVE/OFFLINE/SUSPENDED -> STOPPING). Gates the button
// only — the backend re-checks this itself regardless.
const STOPPABLE_SESSION_STATUSES = new Set(['ACTIVE', 'OFFLINE', 'SUSPENDED']);

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
  const { membership } = useAuth();
  const canRemoteStop =
    membership?.role === 'OWNER' ||
    membership?.role === 'ADMIN' ||
    membership?.role === 'OPERATOR';
  const [session, setSession] = React.useState<ApiChargingSession | null>(null);
  const [meterValues, setMeterValues] = React.useState<ApiMeterValue[]>([]);
  const [state, setState] = React.useState<LoadState>('loading');
  const [remoteStopOpen, setRemoteStopOpen] = React.useState(false);

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

  // WO-ARGOS-057 — navigation gap closed: Session detail previously had no
  // link back down to the Site/Station/EVSE/Connector it belongs to, even
  // though ApiChargingSession already carries every id needed. Connector
  // has no detail route in this app (WO-054 never built one — see
  // WO_057_OPERATIONS_CONSOLE_DISCOVERY §7), so its row links to the parent
  // EVSE detail page instead of inventing a new route.
  const stationHref = `/sites/${session.siteId}/charging-stations/${session.chargingStationId}`;
  const evseHref = `${stationHref}/evses/${session.evseId}`;

  const summary: Array<[string, string, string?]> = [
    ['Energía entregada', `${(session.energyWh / 1000).toFixed(2)} kWh`],
    ['Inicio', formatDateTime(session.startedAt)],
    ['Fin', session.endedAt ? formatDateTime(session.endedAt) : 'En curso'],
    ['Sitio', session.siteName, `/sites/${session.siteId}`],
    ['Estación', session.chargingStationName, stationHref],
    ['EVSE', session.evseId, evseHref],
    ['Conector', session.connectorId, evseHref],
    ['Protocolo', session.protocolVersion],
    ['ID de transacción', session.protocolTransactionId],
    ...(session.terminationReason
      ? ([['Motivo de finalización', session.terminationReason]] as Array<
          [string, string, string?]
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
        actions={
          <div className="flex items-center gap-2">
            <ApiChargingSessionStatusBadge status={session.status} />
            {canRemoteStop &&
              STOPPABLE_SESSION_STATUSES.has(session.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRemoteStopOpen(true)}
                >
                  Detener carga
                </Button>
              )}
          </div>
        }
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {summary.map(([label, value, href]) => (
              <div key={label}>
                <p className="text-muted-foreground text-xs">{label}</p>
                {href ? (
                  <Link
                    href={href}
                    className="mt-1 block text-sm font-medium hover:underline"
                  >
                    {value}
                  </Link>
                ) : (
                  <p className="mt-1 text-sm font-medium">{value}</p>
                )}
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

      {canRemoteStop && (
        <RemoteStopDialog
          open={remoteStopOpen}
          onClose={() => setRemoteStopOpen(false)}
          sessionId={session.id}
          siteName={session.siteName}
          stationName={session.chargingStationName}
        />
      )}
    </PageContainer>
  );
}
