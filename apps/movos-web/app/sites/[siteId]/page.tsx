import { notFound } from 'next/navigation';
import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { EmptyState } from '@/components/movos/empty-state';
import { Tabs } from '@/components/movos/tabs';
import {
  AlertSeverityBadge,
  AlertStatusBadge,
  ChargerStatusBadge,
  SessionStatusBadge,
  SiteStatusBadge,
  StationStatusBadge,
} from '@/components/movos/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { getSiteById, sites } from '@/data/sites';
import { getStationsBySite } from '@/data/stations';
import { getChargersBySite } from '@/data/chargers';
import { sessions } from '@/data/sessions';
import { alerts } from '@/data/alerts';
import { activity } from '@/data/activity';
import { formatRelative } from '@/lib/format';
import type { Alert, Charger, ChargingSession, Station } from '@/types';

export function generateStaticParams() {
  return sites.map((site) => ({ siteId: site.id }));
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = getSiteById(siteId);
  if (!site) notFound();

  const siteStations = getStationsBySite(site.id);
  const siteChargers = getChargersBySite(site.id);
  const activeSessions = sessions.filter(
    (session) => session.siteId === site.id && session.status === 'ACTIVE',
  );
  const siteAlerts = alerts.filter((alert) => alert.siteId === site.id);
  const siteActivity = activity.filter((item) => item.siteId === site.id);

  const stationColumns: Column<Station>[] = [
    { key: 'name', header: 'Estación', render: (s) => s.name },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => <StationStatusBadge status={s.status} />,
    },
    { key: 'chargers', header: 'Cargadores', render: (s) => s.chargerCount },
    {
      key: 'availability',
      header: 'Disponibilidad',
      render: (s) => `${s.availabilityPercent}%`,
    },
  ];

  const chargerColumns: Column<Charger>[] = [
    {
      key: 'name',
      header: 'Cargador',
      render: (c) => (
        <Link href={`/chargers/${c.id}`} className="hover:text-movos-blue">
          {c.name}
        </Link>
      ),
    },
    { key: 'model', header: 'Modelo', render: (c) => `${c.vendor} ${c.model}` },
    {
      key: 'status',
      header: 'Estado',
      render: (c) => <ChargerStatusBadge status={c.status} />,
    },
    { key: 'power', header: 'Potencia', render: (c) => `${c.maxPowerKw} kW` },
  ];

  const sessionColumns: Column<ChargingSession>[] = [
    {
      key: 'id',
      header: 'Sesión',
      render: (s) => (
        <Link href={`/sessions/${s.id}`} className="hover:text-movos-blue">
          {s.id}
        </Link>
      ),
    },
    { key: 'energy', header: 'Energía', render: (s) => `${s.energyKwh} kWh` },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => <SessionStatusBadge status={s.status} />,
    },
  ];

  const alertColumns: Column<Alert>[] = [
    { key: 'title', header: 'Alerta', render: (a) => a.title },
    {
      key: 'severity',
      header: 'Severidad',
      render: (a) => <AlertSeverityBadge severity={a.severity} />,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (a) => <AlertStatusBadge status={a.status} />,
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sitios', href: '/sites' },
          { label: site.name },
        ]}
        title={site.name}
        description={`${site.city} · ${site.address}`}
        actions={<SiteStatusBadge status={site.status} />}
      />

      <div className="mt-8">
        <Tabs
          items={[
            {
              id: 'overview',
              label: 'Resumen',
              content: (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-muted-foreground text-xs">
                        Estaciones
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {site.stationCount}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-muted-foreground text-xs">
                        Cargadores
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {site.chargerCount}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-5">
                      <p className="text-muted-foreground text-xs">
                        Conectores disponibles
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {site.availableConnectors}/{site.totalConnectors}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ),
            },
            {
              id: 'infra',
              label: 'Infraestructura',
              content: (
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-3 text-sm font-medium">Estaciones</h3>
                    <DataTable
                      columns={stationColumns}
                      rows={siteStations}
                      getRowKey={(s) => s.id}
                    />
                  </div>
                  <div>
                    <h3 className="mb-3 text-sm font-medium">Cargadores</h3>
                    <DataTable
                      columns={chargerColumns}
                      rows={siteChargers}
                      getRowKey={(c) => c.id}
                    />
                  </div>
                </div>
              ),
            },
            {
              id: 'sessions',
              label: 'Sesiones activas',
              content:
                activeSessions.length > 0 ? (
                  <DataTable
                    columns={sessionColumns}
                    rows={activeSessions}
                    getRowKey={(s) => s.id}
                  />
                ) : (
                  <EmptyState title="Sin sesiones activas en este sitio." />
                ),
            },
            {
              id: 'alerts',
              label: 'Alertas',
              content:
                siteAlerts.length > 0 ? (
                  <DataTable
                    columns={alertColumns}
                    rows={siteAlerts}
                    getRowKey={(a) => a.id}
                  />
                ) : (
                  <EmptyState title="Sin alertas para este sitio." />
                ),
            },
            {
              id: 'activity',
              label: 'Actividad reciente',
              content: (
                <Card>
                  <CardContent className="space-y-4 pt-5">
                    {siteActivity.length > 0 ? (
                      siteActivity.map((item) => (
                        <div key={item.id} className="flex items-start gap-3">
                          <span className="bg-movos-blue mt-1.5 size-1.5 rounded-full" />
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
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        Sin actividad reciente.
                      </p>
                    )}
                  </CardContent>
                </Card>
              ),
            },
          ]}
        />
      </div>
    </PageContainer>
  );
}
