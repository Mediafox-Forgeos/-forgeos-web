import {
  Card,
  EmptyState,
  PageHeader,
  SentimentBadge,
  SeverityBadge,
  SyntheticTag,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { PLATFORM_LABEL, fmtRelative } from '@/lib/format';
import { AlertCard } from '../alert-card';

export const metadata = { title: 'Revisión humana' };

export default async function ReviewPage() {
  const { active, repo } = await requireContext();
  const [alerts, items] = await Promise.all([
    repo.alerts(active.organization.id),
    repo.items(active.organization.id, { reviewPending: true }),
  ]);
  const pending = alerts.filter((a) => a.reviewStatus === 'pending');
  return (
    <>
      <PageHeader
        layer="reputational"
        title="Revisión humana"
        description="Alertas críticas y clasificaciones de baja confianza esperan validación de una persona. Ninguna alerta crítica se escala sin esta revisión."
      />
      <h2 className="mb-2 text-sm font-medium">
        Alertas pendientes ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <EmptyState title="No hay alertas pendientes" />
      ) : (
        <div className="space-y-2">
          {pending.map((a) => (
            <AlertCard key={a.id} a={a} role={active.role} />
          ))}
        </div>
      )}
      <h2 className="mb-2 mt-6 text-sm font-medium">
        Clasificaciones a validar ({items.length})
      </h2>
      {items.length === 0 ? (
        <EmptyState title="Sin clasificaciones pendientes" />
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <Card className="p-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span>
                    {PLATFORM_LABEL[i.platform]} · {fmtRelative(i.publishedAt)}
                  </span>
                  {i.isSynthetic && <SyntheticTag />}
                  {i.analysis && (
                    <>
                      <SentimentBadge s={i.analysis.sentiment} />
                      <SeverityBadge s={i.analysis.severity} />
                    </>
                  )}
                  <span className="ml-auto">
                    Confianza {Math.round((i.analysis?.confidence ?? 0) * 100)}%
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{i.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  IA: {i.analysis?.explanation}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
