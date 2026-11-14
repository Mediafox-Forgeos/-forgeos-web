import { SentimentDays, TopicList } from '@/components/insights';
import {
  Card,
  CoverageBadge,
  CoverageNotice,
  EmptyState,
  PageHeader,
  Stat,
  SyntheticTag,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { PLATFORM_LABEL, fmtDateTime } from '@/lib/format';
import { dailySentiment, periodTrend, topTopics } from '@/lib/insights';

export const metadata = { title: 'Reportes' };

const signed = (n: number, unit = '') => `${n > 0 ? '+' : ''}${n}${unit}`;

export default async function ReportsPage() {
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, alerts, incidents, coverage, reports] = await Promise.all([
    repo.items(orgId, { limit: 1000 }),
    repo.alerts(orgId),
    repo.incidents(orgId),
    repo.coverage(orgId),
    repo.reports(orgId),
  ]);
  const trend = periodTrend(items, 7);
  const cur = trend.current;
  const openAlerts = alerts.filter((a) => a.reviewStatus === 'pending').length;
  const openInc = incidents.filter(
    (i) => !['closed', 'false_positive', 'resolved'].includes(i.status),
  ).length;
  const closedInc = incidents.filter((i) => i.status === 'closed').length;

  return (
    <>
      <PageHeader
        layer="reputational"
        title={`Reportes · ${active.organization.name}`}
        description="Indicadores de los últimos 7 días comparados con la semana anterior, cobertura real y resúmenes ejecutivos diarios."
      />
      <CoverageNotice {...summarizeCoverage(coverage)} />

      <h2 className="mb-2 text-sm font-medium">Indicadores (7 días)</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Conversaciones analizadas"
          value={cur.total}
          hint={`${signed(trend.volumeDelta)} vs. semana anterior`}
        />
        <Stat
          label="% negativo"
          value={`${cur.negativePct} %`}
          hint={`${signed(trend.negativeDelta, ' pts')} vs. semana anterior`}
        />
        <Stat
          label="Alertas por revisar"
          value={openAlerts}
          hint={`${alerts.length} alertas en total`}
        />
        <Stat
          label="Incidentes activos"
          value={openInc}
          hint={`${closedInc} cerrados con resumen`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-medium">
            Tendencia del sentimiento (14 días)
          </h2>
          <SentimentDays days={dailySentiment(items, 14)} />
          <p className="text-muted-foreground mt-2 text-xs tabular-nums">
            Semana actual: {cur.positive} positivas · {cur.neutral + cur.mixed}{' '}
            neutrales/mixtas · {cur.negative} negativas.
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium">Temas de la semana</h2>
          <TopicList
            topics={topTopics(
              items.filter(
                (i) => Date.parse(i.publishedAt) > Date.now() - 7 * 86_400_000,
              ),
            )}
          />
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Cobertura de fuentes</h2>
        {coverage.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Sin fuentes registradas.
          </p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {coverage.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {PLATFORM_LABEL[c.platform]} · {c.dataKind}
                  {c.provider === 'demo' ? ' (ficticio)' : ''}
                  {c.reason && (
                    <span className="text-muted-foreground block text-xs">
                      {c.reason}
                    </span>
                  )}
                </span>
                <CoverageBadge s={c.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium">
        Resúmenes ejecutivos diarios
      </h2>
      {reports.length === 0 ? (
        <EmptyState title="Aún no hay resúmenes diarios" />
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="p-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <time
                    className="text-foreground font-medium"
                    dateTime={r.reportDate}
                  >
                    {fmtDateTime(`${r.reportDate}T12:00:00Z`).split(',')[0]}
                  </time>
                  {r.isSynthetic && <SyntheticTag />}
                  {typeof r.metrics.items === 'number' && (
                    <span>· {r.metrics.items} conversaciones</span>
                  )}
                  {typeof r.metrics.negative_pct === 'number' && (
                    <span>· {r.metrics.negative_pct} % negativas</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm">{r.summary}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {r.coverageNote}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
