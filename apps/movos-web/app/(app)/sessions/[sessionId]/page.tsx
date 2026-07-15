import { notFound } from 'next/navigation';
import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { SessionStatusBadge } from '@/components/movos/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSessionById, sessions } from '@/data/sessions';
import { getChargerById } from '@/data/chargers';
import { getConnectorById } from '@/data/connectors';
import { getSiteById } from '@/data/sites';
import { getTariffById } from '@/data/tariffs';
import { users } from '@/data/users';
import { formatCurrency, formatDateTime } from '@/lib/format';

export function generateStaticParams() {
  return sessions.map((session) => ({ sessionId: session.id }));
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = getSessionById(sessionId);
  if (!session) notFound();

  const site = getSiteById(session.siteId);
  const charger = getChargerById(session.chargerId);
  const connector = getConnectorById(session.connectorId);
  const tariff = getTariffById(session.tariffId);
  const user = users.find((u) => u.id === session.userId);

  const summary: Array<[string, string]> = [
    ['Energía entregada', `${session.energyKwh} kWh`],
    ['Duración', `${session.durationMinutes} min`],
    ['Inicio', formatDateTime(session.startedAt)],
    ['Fin', session.endedAt ? formatDateTime(session.endedAt) : 'En curso'],
    ['Costo estimado', formatCurrency(session.estimatedCost, session.currency)],
    ['Tarifa', tariff?.name ?? session.tariffId],
    ['Sitio', site?.name ?? session.siteId],
    ['Cargador', charger?.name ?? session.chargerId],
    [
      'Conector',
      connector
        ? `${connector.label} · ${connector.type}`
        : session.connectorId,
    ],
    ['Operador', user?.name ?? session.userId],
  ];

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: 'Sesiones', href: '/sessions' },
          { label: session.id },
        ]}
        title={`Sesión ${session.id}`}
        description={`${charger?.name ?? session.chargerId} · ${site?.name ?? session.siteId}`}
        actions={<SessionStatusBadge status={session.status} />}
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
            <CardTitle>Línea de tiempo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {session.events.map((event, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="bg-movos-blue mt-1.5 size-2 rounded-full" />
                  {index < session.events.length - 1 && (
                    <span className="bg-border w-px flex-1" />
                  )}
                </div>
                <div className="pb-2">
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-muted-foreground text-xs">
                    {event.detail}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {formatDateTime(event.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {charger && (
        <p className="text-muted-foreground mt-6 text-xs">
          Punto de carga:{' '}
          <Link
            href={`/chargers/${charger.id}`}
            className="hover:text-movos-blue"
          >
            {charger.name}
          </Link>
        </p>
      )}
    </PageContainer>
  );
}
