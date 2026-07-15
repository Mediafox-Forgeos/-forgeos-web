import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { SessionStatusBadge } from '@/components/movos/status-badge';
import { Input } from '@/components/ui/input';
import { sessions } from '@/data/sessions';
import { getChargerById } from '@/data/chargers';
import { getSiteById } from '@/data/sites';
import { formatCurrency, formatDateTime } from '@/lib/format';
import type { ChargingSession } from '@/types';

const columns: Column<ChargingSession>[] = [
  {
    key: 'id',
    header: 'Sesión',
    render: (s) => (
      <Link
        href={`/sessions/${s.id}`}
        className="hover:text-movos-blue font-medium"
      >
        {s.id}
      </Link>
    ),
  },
  {
    key: 'site',
    header: 'Sitio',
    render: (s) => getSiteById(s.siteId)?.name ?? s.siteId,
  },
  {
    key: 'charger',
    header: 'Cargador',
    render: (s) => getChargerById(s.chargerId)?.name ?? s.chargerId,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (s) => <SessionStatusBadge status={s.status} />,
  },
  { key: 'energy', header: 'Energía', render: (s) => `${s.energyKwh} kWh` },
  {
    key: 'started',
    header: 'Inicio',
    render: (s) => formatDateTime(s.startedAt),
  },
  {
    key: 'cost',
    header: 'Costo estimado',
    render: (s) => formatCurrency(s.estimatedCost, s.currency),
  },
];

export default function SessionsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operación"
        title="Sesiones"
        description="Historial y sesiones en curso a través de toda la red."
      />

      <div className="mb-4 mt-8 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por sesión…"
          className="w-full sm:w-56"
          disabled
        />
        <select
          className="border-input bg-background text-muted-foreground h-10 rounded-lg border px-3 text-sm"
          disabled
          defaultValue=""
          aria-label="Filtrar por estado"
        >
          <option value="">Estado</option>
        </select>
        <select
          className="border-input bg-background text-muted-foreground h-10 rounded-lg border px-3 text-sm"
          disabled
          defaultValue=""
          aria-label="Filtrar por sitio"
        >
          <option value="">Sitio</option>
        </select>
        <span className="text-muted-foreground text-xs">
          Filtros disponibles cuando se conecte el backend.
        </span>
      </div>

      <DataTable columns={columns} rows={sessions} getRowKey={(s) => s.id} />
    </PageContainer>
  );
}
