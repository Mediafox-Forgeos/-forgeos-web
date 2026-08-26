import { Receipt } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { Card, CardContent } from '@/components/ui/card';

const UPCOMING_TARIFF_FIELDS = [
  'Precio por kWh',
  'Precio por tiempo',
  'Horarios y franjas horarias',
  'Moneda',
  'Reglas de aplicación por sitio',
];

// WO-ARGOS-090 — Tariff Engine does not exist yet (explicitly out of scope
// for this work order — that begins in the parallel Commerce track). This
// route previously showed a fully fabricated price list (`@/data/tariffs`)
// as if it were real commercial data. Per
// PRIMARY_NAVIGATION_MUST_NOT_PRESENT_FABRICATED_OPERATIONAL_DATA_AS_REAL,
// this is now an honest placeholder — no invented prices, currencies, or
// site assignments anywhere on this page.
export default function TariffsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Comercial"
        title="Tarifas"
        description="El motor de tarifas estará disponible próximamente."
      />
      <div className="mt-8 space-y-4">
        <EmptyState
          icon={Receipt}
          title="El motor de tarifas estará disponible próximamente."
          description="Todavía no existe un motor de tarifas en MOVOS. Esta sección se activará cuando esté listo."
        />
        <Card>
          <CardContent className="pt-5">
            <p className="text-muted-foreground mb-3 text-sm">
              Cuando esté disponible, aquí podrás configurar:
            </p>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              {UPCOMING_TARIFF_FIELDS.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
