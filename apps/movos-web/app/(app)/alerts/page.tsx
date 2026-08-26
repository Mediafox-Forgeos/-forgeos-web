import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/movos/empty-state';
import { Button } from '@/components/ui/button';

// WO-ARGOS-090 — this route used to render a fabricated alert list
// (`@/data/alerts`) with "Reconocer"/"Resolver" buttons that updated only
// local React state, never a backend. Real operational attention already
// exists — Unified Attention on Operaciones (WO-ARGOS-057), built from
// GET /evses, GET /work-orders/attention, and GET /operator/offline-stations,
// all real backend data. Maintaining a second, fake "Alertas" surface next
// to the real one would violate PRIMARY_NAVIGATION_MUST_NOT_PRESENT_
// FABRICATED_OPERATIONAL_DATA_AS_REAL and give MOVOS two competing sources
// of truth for the same concept. This page now honestly points at the real
// one instead of duplicating it.
export default function AlertsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operación"
        title="Alertas"
        description="Las alertas operativas se muestran en Centro de Operaciones."
      />
      <div className="mt-8">
        <EmptyState
          icon={TriangleAlert}
          title="Las alertas operativas se muestran en Centro de Operaciones."
          description="Estaciones desconectadas, conectores con falla y órdenes de trabajo que requieren atención aparecen ahí, consolidados en un solo lugar."
          action={
            <Button asChild>
              <Link href="/dashboard">Ir a Centro de Operaciones</Link>
            </Button>
          }
        />
      </div>
    </PageContainer>
  );
}
