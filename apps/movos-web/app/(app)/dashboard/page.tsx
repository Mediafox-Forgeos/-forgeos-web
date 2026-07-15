import Link from 'next/link';
import {
  Activity,
  BatteryCharging,
  CircleDollarSign,
  Gauge,
  Plug,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { MetricCard } from '@/components/movos/metric-card';
import {
  AlertSeverityBadge,
  SessionStatusBadge,
} from '@/components/movos/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  executiveMetrics,
  networkDistribution,
  pilotMilestones,
} from '@/data/dashboard';
import { getActiveSessions } from '@/data/sessions';
import { getOpenAlerts } from '@/data/alerts';
import { activity } from '@/data/activity';
import { getChargerById } from '@/data/chargers';
import { tenant } from '@/config/tenant';
import { formatCurrency, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DashboardLive } from './_dashboard-live';

const metricIcons: Record<string, LucideIcon> = {
  'metric-availability': Gauge,
  'metric-available-chargers': Plug,
  'metric-active-sessions': BatteryCharging,
  'metric-energy': Activity,
  'metric-alerts': TriangleAlert,
  'metric-revenue': CircleDollarSign,
};

const distributionColor: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500',
  CHARGING: 'bg-movos-blue',
  OCCUPIED: 'bg-movos-cyan',
  FAULTED: 'bg-red-500',
  OFFLINE: 'bg-slate-500',
};

const milestoneLabel: Record<string, string> = {
  DONE: 'Completado',
  IN_PROGRESS: 'En progreso',
  PENDING: 'Pendiente',
};

const milestoneColor: Record<string, string> = {
  DONE: 'text-emerald-400',
  IN_PROGRESS: 'text-movos-blue',
  PENDING: 'text-muted-foreground',
};

export default function DashboardPage() {
  const activeSessions = getActiveSessions();
  const openAlerts = getOpenAlerts().slice(0, 3);
  const recentActivity = activity.slice(0, 5);
  const totalConnectors = networkDistribution.reduce(
    (sum, item) => sum + item.count,
    0,
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS"
        title="Centro de Operaciones"
        description="Supervisa la infraestructura, las sesiones y el estado de tu red desde un solo lugar."
      />

      <DashboardLive />

      <p className="text-muted-foreground mt-8 text-xs font-medium uppercase tracking-[0.16em]">
        Datos de demostración
      </p>
      <section className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {executiveMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            detail={metric.detail}
            trend={metric.trend}
            icon={metricIcons[metric.id]}
          />
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Estado de la red</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {networkDistribution.map((item) => {
              const percent = totalConnectors
                ? Math.round((item.count / totalConnectors) * 100)
                : 0;
              return (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.count} · {percent}%
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        distributionColor[item.status],
                      )}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progreso del piloto · {tenant.orgName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pilotMilestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{milestone.label}</span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    milestoneColor[milestone.status],
                  )}
                >
                  {milestoneLabel[milestone.status]}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesiones activas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSessions.map((session) => {
              const charger = getChargerById(session.chargerId);
              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="border-border hover:bg-accent/40 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      {charger?.name ?? session.chargerId}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {session.energyKwh} kWh · {session.durationMinutes} min
                    </p>
                  </div>
                  <SessionStatusBadge status={session.status} />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertas abiertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openAlerts.map((alert) => (
              <div
                key={alert.id}
                className="border-border flex items-start justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium">{alert.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {alert.description}
                  </p>
                </div>
                <AlertSeverityBadge severity={alert.severity} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentActivity.map((item) => (
            <div key={item.id} className="flex items-start gap-3">
              <span className="bg-movos-blue mt-1.5 size-1.5 shrink-0 rounded-full" />
              <div className="flex-1">
                <p className="text-sm">{item.title}</p>
                <p className="text-muted-foreground text-xs">{item.detail}</p>
              </div>
              <span className="text-muted-foreground text-xs">
                {formatRelative(item.timestamp)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-6 text-xs">
        Los ingresos mostrados son estimados de demostración.{' '}
        {formatCurrency(127400)} corresponde al día en curso.
      </p>
    </PageContainer>
  );
}
