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
import { summarizeCoverage } from '@/lib/coverage';
import { fmtRelative } from '@/lib/format';

export const metadata = { title: 'Resumen' };

export default async function OverviewPage() {
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, alerts, incidents, coverage] = await Promise.all([
    repo.items(orgId, { limit: 1000 }),
    repo.alerts(orgId),
    repo.incidents(orgId),
    repo.coverage(orgId),
  ]);
  const cov = summarizeCoverage(coverage);
  const analyzed = items.filter((i) => i.analysis);
  const neg = analyzed.filter(
    (i) => i.analysis!.sentiment === 'negative',
  ).length;
  const pos = analyzed.filter(
    (i) => i.analysis!.sentiment === 'positive',
  ).length;
  const pendingReview = alerts.filter(
    (a) => a.reviewStatus === 'pending',
  ).length;
  const openInc = incidents.filter(
    (i) => !['closed', 'false_positive', 'resolved'].includes(i.status),
  ).length;

  const days = [...Array(7)].map((_, k) => {
    const d = new Date(Date.now() - (6 - k) * 86400_000)
      .toISOString()
      .slice(0, 10);
    const dayItems = analyzed.filter((i) => i.publishedAt.slice(0, 10) === d);
    return {
      d,
      pos: dayItems.filter((i) => i.analysis!.sentiment === 'positive').length,
      neg: dayItems.filter((i) => i.analysis!.sentiment === 'negative').length,
      other: dayItems.filter(
        (i) => !['positive', 'negative'].includes(i.analysis!.sentiment),
      ).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.pos + d.neg + d.other));
  const topics = new Map<string, number>();
  for (const i of analyzed)
    for (const t of i.analysis!.topics) topics.set(t, (topics.get(t) ?? 0) + 1);

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
          value={analyzed.length}
          hint="Últimos 7 días, fuentes conectadas"
        />
        <Stat
          label="Balance de sentimiento"
          value={`${pos} / ${neg}`}
          hint="Positivas / negativas"
        />
        <Stat
          label="Alertas por revisar"
          value={pendingReview}
          hint={
            <Link className="text-brand hover:underline" href="/revision">
              Ir a revisión humana
            </Link>
          }
        />
        <Stat
          label="Incidentes activos"
          value={openInc}
          hint={
            <Link className="text-brand hover:underline" href="/incidentes">
              Ver incidentes
            </Link>
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="text-sm font-medium">Sentimiento por día</h2>
          <div
            className="mt-4 flex h-40 items-end gap-2"
            role="img"
            aria-label="Barras de sentimiento por día"
          >
            {days.map((d) => (
              <div
                key={d.d}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <div
                  className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded"
                  style={{
                    height: `${((d.pos + d.neg + d.other) / max) * 100}%`,
                  }}
                >
                  <div
                    className="bg-emerald-400/80"
                    style={{ flex: d.pos }}
                    title={`${d.pos} positivas`}
                  />
                  <div
                    className="bg-slate-500/70"
                    style={{ flex: d.other }}
                    title={`${d.other} neutrales/mixtas`}
                  />
                  <div
                    className="bg-red-400/80"
                    style={{ flex: d.neg }}
                    title={`${d.neg} negativas`}
                  />
                </div>
                <span className="text-muted-foreground text-[10px]">
                  {d.d.slice(5)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-3 flex gap-4 text-xs">
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400/80" />
              Positivo
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-500/70" />
              Neutral/mixto
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-400/80" />
              Negativo
            </span>
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-medium">Temas principales</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {[...topics.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([t, n]) => (
                <li key={t} className="flex justify-between gap-2">
                  <span className="truncate">{t}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {n}
                  </span>
                </li>
              ))}
          </ul>
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
          className="text-brand mt-2 inline-block text-sm hover:underline"
        >
          Ver todas las alertas
        </Link>
      </Card>
    </>
  );
}
