import Link from 'next/link';
import {
  Card,
  CoverageNotice,
  PageHeader,
  SeverityBadge,
  Stat,
  SyntheticTag,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { SentimentDays, TopicList } from '@/components/insights';
import { summarizeCoverage } from '@/lib/coverage';
import { dailySentiment, sentimentBreakdown, topTopics } from '@/lib/insights';
import { fmtRelative } from '@/lib/format';

/** Resumen V1 (tema «Clásico»), sin cambios respecto de Gate 2. Alternativa durante la transición (D-1). */
export async function LegacyOverview() {
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, alerts, incidents, coverage] = await Promise.all([
    repo.items(orgId, { limit: 1000 }),
    repo.alerts(orgId),
    repo.incidents(orgId),
    repo.coverage(orgId),
  ]);
  const cov = summarizeCoverage(coverage);
  const sent = sentimentBreakdown(items);
  const pendingReview = alerts.filter(
    (a) => a.reviewStatus === 'pending',
  ).length;
  const openInc = incidents.filter(
    (i) => !['closed', 'false_positive', 'resolved'].includes(i.status),
  ).length;

  return (
    <>
      <PageHeader
        layer="reputational"
        title={`Resumen · ${active.organization.name}`}
        description="Estado reputacional de los últimos 7 días según las fuentes conectadas."
      />
      <CoverageNotice {...cov} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Conversaciones analizadas"
          value={sent.total}
          hint="Últimos 7 días, fuentes conectadas"
        />
        <Stat
          label="Balance de sentimiento"
          value={`${sent.positive} / ${sent.negative}`}
          hint="Positivas / negativas"
        />
        <Stat
          label="Alertas por revisar"
          value={pendingReview}
          hint={
            <Link
              className="text-primary-text hover:underline"
              href="/revision"
            >
              Ir a revisión humana
            </Link>
          }
        />
        <Stat
          label="Incidentes activos"
          value={openInc}
          hint={
            <Link
              className="text-primary-text hover:underline"
              href="/incidentes"
            >
              Ver incidentes
            </Link>
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-medium">Sentimiento por día</h2>
          <SentimentDays days={dailySentiment(items)} />
        </Card>
        <Card>
          <h2 className="text-sm font-medium">Temas principales</h2>
          <TopicList topics={topTopics(items)} />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Alertas de mayor prioridad</h2>
        <ul className="mt-3 divide-y">
          {alerts.slice(0, 5).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="text-muted-foreground text-xs">
                  Prioridad {Math.round(a.priorityScore)} ·{' '}
                  {fmtRelative(a.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {a.isSynthetic && <SyntheticTag />}
                <SeverityBadge s={a.severity} />
              </div>
            </li>
          ))}
        </ul>
        <Link
          href="/alertas"
          className="text-primary-text mt-2 inline-block text-sm hover:underline"
        >
          Ver todas las alertas
        </Link>
      </Card>
    </>
  );
}
