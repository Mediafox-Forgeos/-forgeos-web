'use client';

import * as React from 'react';
import { ChevronDown, FlaskConical } from 'lucide-react';
import {
  Activity,
  BatteryCharging,
  CircleDollarSign,
  Gauge,
  Plug,
  TriangleAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { MetricCard } from '@/components/movos/metric-card';
import { AlertSeverityBadge } from '@/components/movos/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { executiveMetrics, pilotMilestones } from '@/data/dashboard';
import { getOpenAlerts } from '@/data/alerts';
import { activity } from '@/data/activity';
import { tenant } from '@/config/tenant';
import { formatCurrency, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const metricIcons: Record<string, LucideIcon> = {
  'metric-availability': Gauge,
  'metric-available-chargers': Plug,
  'metric-active-sessions': BatteryCharging,
  'metric-energy': Activity,
  'metric-alerts': TriangleAlert,
  'metric-revenue': CircleDollarSign,
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

/**
 * WO-ARGOS-051 — Operations Console. The reality boundary is non-negotiable
 * (see ARGOS's approved spec, product decision 2): this demo content —
 * previously inline on /dashboard with only a small caption separating it
 * from real operational data — is real, useful demo infrastructure for
 * pilot conversations, but must never again read as visually equivalent to
 * live data. Collapsed by default, behind an explicit label, is the
 * strongest guarantee of that short of deleting it outright.
 */
export function DemoDataSection() {
  const [expanded, setExpanded] = React.useState(false);
  const openAlerts = getOpenAlerts().slice(0, 3);
  const recentActivity = activity.slice(0, 5);

  return (
    <section className="border-border bg-accent/10 mt-10 rounded-xl border border-dashed p-4">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <FlaskConical
            className="text-muted-foreground size-4"
            aria-hidden="true"
          />
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">
            Datos de demostración — no operacionales
          </span>
        </span>
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 transition-transform',
            expanded && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="mt-4 space-y-6">
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

          <div className="grid gap-6 lg:grid-cols-2">
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

          <Card>
            <CardHeader>
              <CardTitle>Actividad reciente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentActivity.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="bg-movos-blue mt-1.5 size-1.5 shrink-0 rounded-full" />
                  <div className="flex-1">
                    <p className="text-sm">{item.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {item.detail}
                    </p>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    {formatRelative(item.timestamp)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="text-muted-foreground text-xs">
            Los ingresos mostrados son estimados de demostración.{' '}
            {formatCurrency(127400)} corresponde al día en curso.
          </p>
        </div>
      )}
    </section>
  );
}
