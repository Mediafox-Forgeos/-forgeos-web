'use client';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { SiteSelectionList } from '@/components/charging/site-selection-list';

/**
 * No org-wide "list all charging stations" endpoint exists (ARGOS ruling,
 * WO-ARGOS-005) — a Charging Station only ever belongs to one Site, so this
 * route asks the operator to pick a Site first rather than faking a global
 * list or performing an N+1 fan-out across every Site to build one.
 */
export default function ChargersPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Estaciones de carga"
        description="Las estaciones de carga pertenecen a un Sitio. Selecciona un sitio para ver sus estaciones, EVSEs y conectores."
      />
      <div className="mt-8">
        <SiteSelectionList />
      </div>
    </PageContainer>
  );
}
