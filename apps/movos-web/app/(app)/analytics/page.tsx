'use client';

import * as React from 'react';

import type { ApiChargingSession } from '@mediafox/shared-types';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/movos/metric-card';
import { OccupancyWidget } from '@/components/operator/occupancy-widget';
import { usePolledResource } from '@/components/operator/use-polled-resource';
import { SimpleBarTrend } from '@/components/console/simple-bar-trend';
import { formatNumber } from '@/lib/format';

const DAY_LABEL = new Intl.DateTimeFormat('es-CO', { weekday: 'short' });

/**
 * Kylum Console — Screen 4, Analytics (WO-ARGOS-031). "How is the network
 * performing?" Every number here is computed client-side from real
 * ChargingSession data (GET /sessions, capped at 200 rows — no date-range
 * filter exists on that endpoint, so this is a real but bounded sample, not
 * a true all-time rollup). No revenue anywhere: CAP-010 (Invoice & Ledger)
 * is not built, and this work order explicitly forbids depending on it.
 */
export default function AnalyticsPage() {
  const { data: sessions } = usePolledResource<ApiChargingSession[]>(
    '/sessions?limit=200',
    60_000,
  );

  const stats = React.useMemo(() => {
    if (!sessions) return null;

    const totalEnergyWh = sessions.reduce((sum, s) => sum + s.energyWh, 0);
    const avgEnergyWh =
      sessions.length > 0 ? totalEnergyWh / sessions.length : 0;

    const byDay = new Map<string, { sessions: number; energyWh: number }>();
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d;
    });
    for (const day of last7) {
      byDay.set(day.toDateString(), { sessions: 0, energyWh: 0 });
    }
    for (const session of sessions) {
      const key = new Date(session.startedAt).toDateString();
      const bucket = byDay.get(key);
      if (bucket) {
        bucket.sessions += 1;
        bucket.energyWh += session.energyWh;
      }
    }
    const sessionsPerDay = last7.map((d) => ({
      label: DAY_LABEL.format(d),
      value: byDay.get(d.toDateString())?.sessions ?? 0,
    }));
    const energyPerDay = last7.map((d) => ({
      label: DAY_LABEL.format(d),
      value: Math.round((byDay.get(d.toDateString())?.energyWh ?? 0) / 1000),
    }));

    const byStation = new Map<string, number>();
    for (const session of sessions) {
      byStation.set(
        session.chargingStationName,
        (byStation.get(session.chargingStationName) ?? 0) + session.energyWh,
      );
    }
    const ranking = [...byStation.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalEnergyWh,
      avgEnergyWh,
      sessionsPerDay,
      energyPerDay,
      ranking,
    };
  }, [sessions]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="MOVOS · Analítica"
        title="Desempeño de la red"
        description="Cómo está funcionando la red — sin datos de facturación (requiere CAP-010, no construido)."
      />

      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          label="Sesiones (muestra reciente)"
          value={sessions ? formatNumber(sessions.length) : '—'}
          detail="Últimas hasta 200 sesiones"
        />
        <MetricCard
          label="Energía entregada"
          value={stats ? `${(stats.totalEnergyWh / 1000).toFixed(1)} kWh` : '—'}
          detail="Sobre la misma muestra"
        />
        <MetricCard
          label="Energía promedio / sesión"
          value={stats ? `${(stats.avgEnergyWh / 1000).toFixed(1)} kWh` : '—'}
        />
        <MetricCard
          label="Ingresos"
          value="No disponible"
          detail="Requiere CAP-010 (no construido)"
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sesiones por día (últimos 7 días)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <SimpleBarTrend points={stats.sessionsPerDay} />
            ) : (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Energía entregada por día (kWh)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats ? (
              <SimpleBarTrend points={stats.energyPerDay} />
            ) : (
              <p className="text-muted-foreground text-sm">Cargando…</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estaciones de mejor desempeño</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats && stats.ranking.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Sin sesiones suficientes para calcular un ranking.
              </p>
            )}
            {stats?.ranking.map(([name, energyWh], i) => (
              <div
                key={name}
                className="border-border flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span>
                  <span className="text-muted-foreground mr-2">{i + 1}.</span>
                  {name}
                </span>
                <span className="font-medium">
                  {(energyWh / 1000).toFixed(1)} kWh
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <OccupancyWidget />
      </section>

      <p className="text-muted-foreground mt-6 text-xs">
        Muestra calculada en el navegador a partir de datos reales de sesiones
        (GET /sessions, límite de 200 filas — ese endpoint no admite filtro por
        rango de fechas). En una red con más de 200 sesiones diarias, estas
        cifras subestimarían el total real.
      </p>
    </PageContainer>
  );
}
