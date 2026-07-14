import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { StationStatusBadge } from '@/components/movos/status-badge';
import { stations } from '@/data/stations';
import { getSiteById } from '@/data/sites';
import { formatRelative } from '@/lib/format';
import type { Station } from '@/types';

const columns: Column<Station>[] = [
  { key: 'name', header: 'Estación', render: (s) => s.name },
  {
    key: 'site',
    header: 'Sitio',
    render: (s) => (
      <Link href={`/sites/${s.siteId}`} className="hover:text-movos-blue">
        {getSiteById(s.siteId)?.name ?? s.siteId}
      </Link>
    ),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (s) => <StationStatusBadge status={s.status} />,
  },
  { key: 'chargers', header: 'Cargadores', render: (s) => s.chargerCount },
  { key: 'connectors', header: 'Conectores', render: (s) => s.connectorCount },
  {
    key: 'availability',
    header: 'Disponibilidad',
    render: (s) => `${s.availabilityPercent}%`,
  },
  {
    key: 'comm',
    header: 'Última comunicación',
    render: (s) => formatRelative(s.lastCommunication),
  },
];

export default function StationsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Estaciones"
        description="Agrupaciones de cargadores por bahía y su disponibilidad."
      />
      <div className="mt-8">
        <DataTable columns={columns} rows={stations} getRowKey={(s) => s.id} />
      </div>
    </PageContainer>
  );
}
