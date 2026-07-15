import Link from 'next/link';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { ChargerStatusBadge } from '@/components/movos/status-badge';
import { chargers } from '@/data/chargers';
import { getSiteById } from '@/data/sites';
import { formatRelative } from '@/lib/format';
import type { Charger } from '@/types';

const columns: Column<Charger>[] = [
  {
    key: 'name',
    header: 'Cargador',
    render: (c) => (
      <Link
        href={`/chargers/${c.id}`}
        className="hover:text-movos-blue font-medium"
      >
        {c.name}
      </Link>
    ),
  },
  {
    key: 'model',
    header: 'Fabricante / Modelo',
    render: (c) => `${c.vendor} ${c.model}`,
  },
  {
    key: 'site',
    header: 'Sitio',
    render: (c) => getSiteById(c.siteId)?.name ?? c.siteId,
  },
  {
    key: 'status',
    header: 'Estado',
    render: (c) => <ChargerStatusBadge status={c.status} />,
  },
  { key: 'power', header: 'Potencia', render: (c) => `${c.maxPowerKw} kW` },
  {
    key: 'connectors',
    header: 'Conectores',
    render: (c) => c.connectors.length,
  },
  { key: 'ocpp', header: 'OCPP', render: (c) => c.ocppVersion },
  {
    key: 'heartbeat',
    header: 'Último latido',
    render: (c) => formatRelative(c.lastHeartbeat),
  },
];

export default function ChargersPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Cargadores"
        description="Inventario completo de puntos de carga y su estado en tiempo real."
      />
      <div className="mt-8">
        <DataTable columns={columns} rows={chargers} getRowKey={(c) => c.id} />
      </div>
    </PageContainer>
  );
}
