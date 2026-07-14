import { PageContainer } from '@/components/layout/page-container';
import { PageHeader } from '@/components/layout/page-header';
import { alerts } from '@/data/alerts';

import { AlertsView } from './alerts-view';

export default function AlertsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Operación"
        title="Alertas"
        description="Incidentes operativos detectados en la red de carga."
      />
      <div className="mt-8">
        <AlertsView initialAlerts={alerts} />
      </div>
    </PageContainer>
  );
}
