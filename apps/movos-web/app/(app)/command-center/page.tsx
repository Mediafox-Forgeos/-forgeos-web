'use client';

import Link from 'next/link';
import * as React from 'react';
import {
  BatteryCharging,
  Gauge,
  HardHat,
  Plug,
  TriangleAlert,
  Zap,
} from 'lucide-react';

import type {
  ApiAction,
  ApiChargingSession,
  ApiConnectivitySummary,
  ApiOccupancySummary,
  ApiStationHealthSummary,
} from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/movos/metric-card';
import { FleetMap } from '@/components/operator/fleet-map';
import {
  OperationalIntelligenceWidget,
  severityLabel,
  severityTone,
} from '@/components/operator/operational-intelligence-widget';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { useAuth } from '@/context/auth-context';
import { formatNumber, formatRelative } from '@/lib/format';
import { computeNetworkVerdict } from '@/components/console/network-verdict';
import { stationHealthDotColor } from '@/components/operator/station-health-badge';

const OPEN_STATUSES = new Set(['OPEN', 'ACKNOWLEDGED', 'ASSIGNED']);

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * Kylum Console — Screen 1, Command Center (WO-ARGOS-030/031). The
 * five-second answer to "is my network healthy right now" — see
 * docs/product/KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md. One verdict,
 * six real (or honestly-marked-unavailable) metrics, then the live map,
 * urgent cases, recent activity, and the Recommendation Engine — in that
 * order of visual weight, not the order each sprint happened to ship them.
 */
export default function CommandCenterPage() {
  const { currentOrg } = useAuth();
  const { data: fleetStatus } = usePolledResource<ApiStationHealthSummary>(
    '/operator/fleet-status',
  );
  const { data: connectivity } = usePolledResource<ApiConnectivitySummary>(
    '/operator/connectivity',
  );
  const { data: occupancy } = usePolledResource<ApiOccupancySummary>(
    '/operator/occupancy',
  );
  const { data: activeSessions } =
    usePolledResource<ApiChargingSession[]>('/sessions/active');
  const { data: actions } = usePolledResource<ApiAction[]>('/actions', 30_000);
  const { data: recentSessions } = usePolledResource<ApiChargingSession[]>(
    '/sessions?limit=200',
    60_000,
  );

  const verdict = computeNetworkVerdict(fleetStatus);

  const openActions = React.useMemo(
    () => (actions ?? []).filter((a) => OPEN_STATUSES.has(a.status)),
    [actions],
  );
  const urgentActions = React.useMemo(
    () =>
      openActions
        .filter((a) => a.severity === 'HIGH')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 3),
    [openActions],
  );
  const recentActions = React.useMemo(
    () =>
      [...(actions ?? [])]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, 5),
    [actions],
  );

  // Honest caveat (see docs/product/KYLUM_CONSOLE_VISUAL_GUIDE.md): GET
  // /sessions has no date-range filter, so "today" is computed client-side
  // over the most recent 200 sessions, not a real backend rollup. Accurate
  // at pilot scale; would undercount on a fleet producing >200 sessions/day.
  const energyTodayWh = React.useMemo(() => {
    if (!recentSessions) return null;
    const todayKey = new Date().toDateString();
    return recentSessions
      .filter((s) => new Date(s.startedAt).toDateString() === todayKey)
      .reduce((sum, s) => sum + s.energyWh, 0);
  }, [recentSessions]);

  const availabilityPercent =
    occupancy && occupancy.totalConnectors > 0
      ? Math.round(
          (occupancy.connectorStatusCounts.AVAILABLE /
            occupancy.totalConnectors) *
            100,
        )
      : null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS · Centro de mando"
        title={`${greeting()}, ${currentOrg?.name ?? 'operador'}.`}
        description="Así está tu red de carga en este momento."
      />

      <section className="mt-8 flex items-center gap-3">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{
            backgroundColor: verdict
              ? stationHealthDotColor[verdict.status]
              : '#6b7280',
          }}
          aria-hidden="true"
        />
        <div>
          <p className="text-xl font-semibold tracking-[-0.02em]">
            {verdict?.label ?? 'Cargando estado de la red…'}
          </p>
          {verdict && (
            <p className="text-muted-foreground text-sm">
              {verdict.description}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Estaciones en línea"
          value={
            connectivity
              ? `${formatNumber(connectivity.online)}/${formatNumber(connectivity.totalStations)}`
              : '—'
          }
          icon={Zap}
        />
        <MetricCard
          label="Sesiones activas"
          value={activeSessions ? formatNumber(activeSessions.length) : '—'}
          icon={BatteryCharging}
        />
        <MetricCard
          label="Energía entregada hoy"
          value={
            energyTodayWh !== null
              ? `${(energyTodayWh / 1000).toFixed(1)} kWh`
              : '—'
          }
          detail="Estimado sobre las últimas 200 sesiones"
          icon={Gauge}
        />
        <MetricCard
          label="Acciones abiertas"
          value={actions ? formatNumber(openActions.length) : '—'}
          icon={TriangleAlert}
        />
        <MetricCard
          label="Técnicos en ruta"
          value="No disponible"
          detail="Requiere módulo de despacho (no construido)"
          icon={HardHat}
        />
        <MetricCard
          label="Disponibilidad de red"
          value={availabilityPercent !== null ? `${availabilityPercent}%` : '—'}
          detail="Conectores disponibles ahora mismo"
          icon={Plug}
        />
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">
            Mapa de red en vivo
          </h2>
          <FleetMap height={380} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Incidentes urgentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions && urgentActions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No hay incidentes de alta severidad abiertos.
              </p>
            )}
            {urgentActions.map((action) => (
              <Link
                key={action.id}
                href="/operations"
                className="border-border hover:bg-accent/40 flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{action.title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {action.chargingStationName}
                  </p>
                </div>
                <Badge tone={severityTone[action.severity]}>
                  {severityLabel[action.severity]}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Acciones recientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actions && recentActions.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Todavía no hay actividad registrada en el Centro de operaciones.
              </p>
            )}
            {recentActions.map((action) => (
              <Link
                key={action.id}
                href="/operations"
                className="border-border hover:bg-accent/40 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition-colors"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{action.title}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {action.chargingStationName} · actualizada{' '}
                    {formatRelative(action.updatedAt)}
                  </p>
                </div>
                <Badge tone="neutral">{action.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-sm font-semibold tracking-[-0.01em]">
            Recomendaciones operativas
          </h2>
          <OperationalIntelligenceWidget />
        </div>
      </section>
    </PageContainer>
  );
}
