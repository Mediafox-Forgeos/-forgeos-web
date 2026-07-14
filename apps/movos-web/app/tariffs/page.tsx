import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type Column } from '@/components/movos/data-table';
import { Badge } from '@/components/ui/badge';
import { tariffs } from '@/data/tariffs';
import { getSiteById } from '@/data/sites';
import { formatCurrency } from '@/lib/format';
import type { Tariff } from '@/types';

const statusTone = {
  ACTIVE: 'success',
  DRAFT: 'neutral',
  ARCHIVED: 'muted',
} as const;

const statusLabel = {
  ACTIVE: 'Activa',
  DRAFT: 'Borrador',
  ARCHIVED: 'Archivada',
} as const;

const columns: Column<Tariff>[] = [
  { key: 'name', header: 'Nombre', render: (t) => t.name },
  { key: 'currency', header: 'Moneda', render: (t) => t.currency },
  {
    key: 'energy',
    header: 'Precio energía',
    render: (t) => `${formatCurrency(t.energyPricePerKwh, t.currency)}/kWh`,
  },
  {
    key: 'time',
    header: 'Precio tiempo',
    render: (t) =>
      t.timePricePerMinute > 0
        ? `${formatCurrency(t.timePricePerMinute, t.currency)}/min`
        : '—',
  },
  {
    key: 'fee',
    header: 'Cargo por sesión',
    render: (t) =>
      t.sessionFee > 0 ? formatCurrency(t.sessionFee, t.currency) : '—',
  },
  {
    key: 'sites',
    header: 'Sitios aplicables',
    render: (t) =>
      t.applicableSiteIds.map((id) => getSiteById(id)?.name ?? id).join(', '),
  },
  {
    key: 'status',
    header: 'Estado',
    render: (t) => (
      <Badge tone={statusTone[t.status]}>{statusLabel[t.status]}</Badge>
    ),
  },
];

export default function TariffsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Comercial"
        title="Tarifas"
        description="Modelos de precio aplicados a las sesiones de carga."
      />
      <div className="mt-8">
        <DataTable columns={columns} rows={tariffs} getRowKey={(t) => t.id} />
      </div>
    </PageContainer>
  );
}
