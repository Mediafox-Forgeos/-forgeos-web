import { notFound } from 'next/navigation';
import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { EmptyState } from '@/components/movos/empty-state';
import { Tabs } from '@/components/movos/tabs';
import {
  ChargerStatusBadge,
  ConnectorStatusBadge,
  SessionStatusBadge,
} from '@/components/movos/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { chargers, getChargerById } from '@/data/chargers';
import { getSiteById } from '@/data/sites';
import { sessions } from '@/data/sessions';
import { formatDateTime } from '@/lib/format';
import type { ChargerConnector, ChargingSession } from '@/types';

export function generateStaticParams() {
  return chargers.map((charger) => ({ chargerId: charger.id }));
}

const remoteActions = [
  'Reiniciar',
  'Desbloquear conector',
  'Cambiar disponibilidad',
  'Actualizar firmware',
];

export default async function ChargerDetailPage({
  params,
}: {
  params: Promise<{ chargerId: string }>;
}) {
  const { chargerId } = await params;
  const charger = getChargerById(chargerId);
  if (!charger) notFound();

  const site = getSiteById(charger.siteId);
  const chargerSessions = sessions.filter((s) => s.chargerId === charger.id);

  const connectorColumns: Column<ChargerConnector>[] = [
    { key: 'label', header: 'Conector', render: (c) => c.label },
    { key: 'type', header: 'Tipo', render: (c) => c.type },
    { key: 'power', header: 'Potencia', render: (c) => `${c.maxPowerKw} kW` },
    {
      key: 'status',
      header: 'Estado',
      render: (c) => <ConnectorStatusBadge status={c.status} />,
    },
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
      key: 'duration',
      header: 'Duración',
      render: (s) => `${s.durationMinutes} min`,
    },
    {
      key: 'status',
      header: 'Estado',
      render: (s) => <SessionStatusBadge status={s.status} />,
    },
  ];

  const specs: Array<[string, string]> = [
    ['Fabricante', charger.vendor],
    ['Modelo', charger.model],
    ['Número de serie', charger.serialNumber],
    ['Firmware', charger.firmwareVersion],
    ['Protocolo', charger.ocppVersion],
    ['Potencia máxima', `${charger.maxPowerKw} kW`],
    ['Sitio', site?.name ?? charger.siteId],
    ['Último latido', formatDateTime(charger.lastHeartbeat)],
  ];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Cargadores', href: '/chargers' },
          { label: charger.name },
        ]}
        title={charger.name}
        description={`${charger.vendor} ${charger.model} · ${charger.ocppVersion}`}
        actions={<ChargerStatusBadge status={charger.status} />}
      />

      <div className="mt-8">
        <Tabs
          items={[
            {
              id: 'status',
              label: 'Estado',
              content: (
                <Card>
                  <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
                    {specs.map(([label, value]) => (
                      <div key={label}>
                        <p className="text-muted-foreground text-xs">{label}</p>
                        <p className="mt-1 text-sm font-medium">{value}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'connectors',
              label: 'Conectores',
              content: (
                <DataTable
                  columns={connectorColumns}
                  rows={charger.connectors}
                  getRowKey={(c) => c.id}
                />
              ),
            },
            {
              id: 'sessions',
              label: 'Sesiones recientes',
              content:
                chargerSessions.length > 0 ? (
                  <DataTable
                    columns={sessionColumns}
                    rows={chargerSessions}
                    getRowKey={(s) => s.id}
                  />
                ) : (
                  <EmptyState title="Sin sesiones registradas para este cargador." />
                ),
            },
            {
              id: 'diagnostics',
              label: 'Diagnóstico',
              content: (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-muted-foreground text-sm">
                      El diagnóstico remoto estará disponible cuando se conecte
                      el servicio OCPP. Actualmente se muestran datos de
                      demostración.
                    </p>
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'config',
              label: 'Configuración',
              content: (
                <Card>
                  <CardContent className="space-y-4 pt-5">
                    <p className="text-muted-foreground text-sm">
                      Acciones remotas del cargador. Disponible cuando se
                      conecte el servicio OCPP.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {remoteActions.map((action) => (
                        <Button
                          key={action}
                          variant="outline"
                          size="sm"
                          disabled
                        >
                          {action}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ),
            },
            {
              id: 'events',
              label: 'Eventos',
              content: (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-muted-foreground text-sm">
                      El registro de eventos OCPP se poblará cuando el cargador
                      esté conectado al backend.
                    </p>
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
