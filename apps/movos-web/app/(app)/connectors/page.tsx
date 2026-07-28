'use client';

import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { SiteSelectionList } from '@/components/charging/site-selection-list';

/**
 * No org-wide "list all connectors" endpoint exists (ARGOS ruling,
 * WO-ARGOS-005), and a flat connector list would require an N+1 fan-out
 * across every Site's stations and EVSEs to assemble — explicitly
 * forbidden. A Connector is reached via Site -> ChargingStation -> EVSE, so
 * this route starts that flow at the Site step.
 */
export default function ConnectorsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Infraestructura"
        title="Conectores"
        description="Los conectores pertenecen a un EVSE, dentro de una estación de carga, dentro de un sitio. Selecciona un sitio para comenzar."
      />
      <div className="mt-8">
        <SiteSelectionList />
      </div>
    </PageContainer>
  );
}
