import { CoverageNotice, EmptyState, PageHeader } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { AlertCard } from '../alert-card';

export const metadata = { title: 'Alertas' };

export default async function AlertsPage() {
  const { active, repo } = await requireContext();
  const [alerts, coverage] = await Promise.all([
    repo.alerts(active.organization.id),
    repo.coverage(active.organization.id),
  ]);
  return (
    <>
      <PageHeader
        layer="reputational"
        title="Alertas"
        description="Señales priorizadas por gravedad, alcance, riesgo y anomalía de volumen. Las críticas requieren revisión humana antes de escalar."
      />
      <CoverageNotice {...summarizeCoverage(coverage)} />
      {alerts.length === 0 ? (
        <EmptyState title="Sin alertas" />
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <AlertCard key={a.id} a={a} role={active.role} />
          ))}
        </div>
      )}
    </>
  );
}
