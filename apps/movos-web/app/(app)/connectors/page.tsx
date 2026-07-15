import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { ConnectorStatusBadge } from '@/components/movos/status-badge';
import { connectors } from '@/data/connectors';
import { getChargerById } from '@/data/chargers';
import { formatRelative } from '@/lib/format';
import type { Connector } from '@/types';

const columns: Column<Connector>[] = [
  { key: 'id', header: 'ID', render: (c) => c.label },
  {
    key: 'charger',
    header: 'Cargador',
    render: (c) => (
      <Link href={`/chargers/${c.chargerId}`} className="hover:text-movos-blue">
        {getChargerById(c.chargerId)?.name ?? c.chargerId}
      </Link>
    ),
  },
  { key: 'type', header: 'Tipo', render: (c) => c.type },
  {
    key: 'power',
    header: 'Potencia máx.',
    render: (c) => `${c.maxPowerKw} kW`,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (c) => <ConnectorStatusBadge status={c.status} />,
  },
  {
    key: 'session',
    header: 'Sesión activa',
    render: (c) =>
      c.activeSessionId ? (
        <Link
          href={`/sessions/${c.activeSessionId}`}
          className="hover:text-movos-blue"
        >
          {c.activeSessionId}
        </Link>
      ) : (
        '—'
      ),
  },
  {
    key: 'update',
    header: 'Última actualización',
    render: (c) => formatRelative(c.lastUpdate),
  },
];

export default function ConnectorsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Conectores"
        description="Puntos de conexión individuales por cargador y su disponibilidad."
      />
      <div className="mt-8">
        <DataTable
          columns={columns}
          rows={connectors}
          getRowKey={(c) => c.id}
        />
      </div>
    </PageContainer>
  );
}
