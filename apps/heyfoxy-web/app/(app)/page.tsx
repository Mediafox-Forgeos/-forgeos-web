import {
  ArrowRight,
  BellRing,
  ChartColumn,
  Gauge,
  Images,
  Lightbulb,
  MessagesSquare,
  Radio,
  ShieldAlert,
  Frown,
  Meh,
  Smile,
  Tags,
  TrendingUp,
  TriangleAlert,
  Users,
  Heart,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { BarList, ChannelShare, ChartCard } from '@/components/ds/charts';
import { AreaTrend, Donut } from '@/components/ds/charts-client';
import { FoxyMark } from '@/components/ds/foxy';
import {
  CoverageBannerV2,
  FoxyInsightPanel,
  KpiCard,
  ModuleSurface,
  type FoxyFindingView,
} from '@/components/ds/layout';
import { SEVERITY_TONE } from '@/components/ds/conversation';
import { SocialPostCard } from '@/components/ds/post';
import {
  Panel,
  PanelHeader,
  StatusPill,
  SyntheticBadge,
  type Tone,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { PLATFORM_LABEL, SEVERITY_LABEL, fmtRelative } from '@/lib/format';
import {
  channelBreakdown,
  compareWhen,
  foxyActions,
  foxyFindings,
  inWindow,
  netSentiment,
  pctDelta,
  pctOf,
  postTotals,
  ptsDelta,
  type FindingKind,
  type FoxyActionKind,
} from '@/lib/home-insights';
import {
  dailySentiment,
  dominantSentiment,
  postStats,
  sentimentBreakdown,
  topTopics,
} from '@/lib/insights';
import {
  PERIOD_PARAM,
  parsePeriod,
  periodDays,
  periodLabel,
  withPeriod,
} from '@/lib/period';
import { getUiTheme } from '@/lib/shell';
import { isV2 } from '@/lib/ui-theme';
import { LegacyOverview } from './legacy-overview';

export const metadata = { title: 'Inicio' };

const FINDING_STYLE: Record<FindingKind, { tone: Tone; icon: LucideIcon }> = {
  critical_pending: { tone: 'critical', icon: TriangleAlert },
  negative_rise: { tone: 'critical', icon: TrendingUp },
  negative_topic: { tone: 'high', icon: Tags },
  unusual_post: { tone: 'info', icon: Radio },
  positive_topic: { tone: 'success', icon: Lightbulb },
};

const ACTION_ICON: Record<FoxyActionKind, LucideIcon> = {
  review_pending: BellRing,
  explore_negative: MessagesSquare,
  explore_unusual: Radio,
};

const num = (n: number) => n.toLocaleString('es-CO');
const dayLabel = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const shortDay = (iso: string) => {
  const parts = dayLabel.formatToParts(Date.parse(`${iso}T12:00:00Z`));
  return `${parts.find((p) => p.type === 'day')?.value} ${parts.find((p) => p.type === 'month')?.value.replace('.', '')}`;
};

/** Intelligence Home (WO-HF-V2-04): integra el antiguo Resumen (decisión 2, opción A). */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isV2(await getUiTheme())) return <LegacyOverview />;

  const period = parsePeriod((await searchParams)[PERIOD_PARAM]);
  const days = periodDays(period);
  const { viewer, active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, alerts, incidents, coverage, posts] = await Promise.all([
    repo.items(orgId, { limit: 1000 }),
    repo.alerts(orgId),
    repo.incidents(orgId),
    repo.coverage(orgId),
    repo.posts(orgId),
  ]);

  const now = Date.now();
  const current = inWindow(items, days, now);
  const previous = inWindow(items, days, now, days);
  const cur = sentimentBreakdown(current);
  const prev = sentimentBreakdown(previous);
  const curPosts = inWindow(posts, days, now);
  const prevPosts = inWindow(posts, days, now, days);
  const pt = postTotals(curPosts);
  const ptPrev = postTotals(prevPosts);
  const pendingReview = alerts.filter(
    (a) => a.reviewStatus === 'pending',
  ).length;
  const openInc = incidents.filter(
    (i) => !['closed', 'false_positive', 'resolved'].includes(i.status),
  ).length;
  const daily = dailySentiment(current, days, now);
  const topics = topTopics(current, 5);
  const channels = channelBreakdown(current);
  const findings = foxyFindings({ current, previous, posts: curPosts, alerts });
  const relevant = curPosts
    .map((p) => ({
      p,
      s: postStats(p),
      comments: items.filter((i) => i.postId === p.id),
    }))
    .sort((a, b) => b.s.interactions - a.s.interactions)
    .slice(0, 3);
  const topAlerts = alerts.slice(0, 5);
  const firstName = viewer.name.split(' ')[0] ?? viewer.name;
  const P = (href: string) => withPeriod(href, period);
  const dailyTotals = daily.map((d) => d.pos + d.neg + d.other);
  const peak = dailyTotals.reduce(
    (best, v, i) => (v > (dailyTotals[best] ?? 0) ? i : best),
    0,
  );
  const unusual = curPosts.find((p) => postStats(p).unusual);
  const actions = foxyActions({
    pendingReview,
    negatives: cur.negative,
    unusualPostId: unusual?.id ?? null,
  }).map((a) => ({
    label: a.label,
    href: P(a.href),
    icon: ACTION_ICON[a.kind],
  }));
  const hasConv = cur.total > 0;
  const hasPosts = pt.posts > 0;

  const findingViews: FoxyFindingView[] = findings.map((f) => ({
    ...f,
    ...FINDING_STYLE[f.kind],
    evidence: f.evidence.map((e) => ({ ...e, href: P(e.href) })),
  }));

  return (
    <ModuleSurface module="home">
      {/* Saludo */}
      <section
        aria-labelledby="home-title"
        className="rounded-panel border-border/70 from-card to-primary-pale/60 shadow-card relative mb-4 overflow-hidden border bg-gradient-to-br p-5 lg:pr-48"
      >
        <div className="relative z-10 max-w-3xl">
          <p className="text-primary-text flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em]">
            <Gauge aria-hidden className="h-4 w-4" /> Inicio · Inteligencia
            reputacional
          </p>
          <h1
            id="home-title"
            className="mt-1 text-[26px] font-black leading-tight tracking-tight sm:text-[30px]"
          >
            Hola, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1 text-[15px] sm:text-base">
            Así se percibe{' '}
            <strong className="text-foreground">
              {active.organization.name}
            </strong>{' '}
            en los canales digitales · {periodLabel(period).toLowerCase()}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusPill
              tone={
                !hasConv
                  ? 'neutral'
                  : cur.negativePct >= 50
                    ? 'critical'
                    : cur.negativePct >= 30
                      ? 'warning'
                      : 'success'
              }
            >
              {cur.total
                ? `${cur.negativePct} % negativas`
                : 'Sin conversaciones en el periodo'}
            </StatusPill>
            {pendingReview > 0 && (
              <StatusPill tone="high" icon={BellRing}>
                {pendingReview} por revisar
              </StatusPill>
            )}
            {openInc > 0 && (
              <StatusPill tone="info" icon={ShieldAlert}>
                {openInc}{' '}
                {openInc === 1 ? 'incidente activo' : 'incidentes activos'}
              </StatusPill>
            )}
          </div>
        </div>
        <FoxyMark
          variant="illustration"
          size={124}
          className="pointer-events-none absolute -bottom-3 right-8 hidden opacity-95 lg:block"
        />
      </section>

      <CoverageBannerV2 {...summarizeCoverage(coverage)} />

      {/* KPI */}
      <h2 className="sr-only">Indicadores del periodo</h2>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          icon={MessagesSquare}
          tone="ai"
          label="Conversaciones analizadas"
          value={num(cur.total)}
          period={
            hasConv ? periodLabel(period) : 'Sin conversaciones en el periodo'
          }
          delta={{
            ...compareWhen(hasConv, pctDelta(cur.total, prev.total)),
            goodWhen: 'neutral',
          }}
          href={P('/conversaciones')}
          spark={hasConv ? dailyTotals : undefined}
        />
        <KpiCard
          icon={Smile}
          tone={
            !hasConv
              ? 'neutral'
              : netSentiment(cur) >= 0
                ? 'success'
                : 'critical'
          }
          label="Sentimiento neto"
          value={
            hasConv
              ? `${netSentiment(cur) > 0 ? '+' : ''}${netSentiment(cur)} pts`
              : '—'
          }
          period={
            hasConv
              ? `${cur.positive} positivas · ${cur.negative} negativas`
              : 'Sin conversaciones clasificadas'
          }
          delta={{
            ...compareWhen(
              hasConv,
              ptsDelta(netSentiment(cur), netSentiment(prev), prev.total),
            ),
            unit: ' pts',
          }}
        />
        <KpiCard
          icon={Users}
          tone="info"
          label="Alcance total"
          value={pt.reach === null ? '—' : num(pt.reach)}
          period={
            !hasPosts
              ? 'Sin publicaciones en el periodo'
              : pt.reach === null
                ? 'Las fuentes no entregan alcance'
                : `${pt.posts} ${pt.posts === 1 ? 'publicación propia' : 'publicaciones propias'}`
          }
          delta={compareWhen(
            pt.reach !== null,
            pctDelta(pt.reach ?? 0, ptPrev.reach ?? 0),
          )}
          href={P('/publicaciones')}
        />
        <KpiCard
          icon={Heart}
          tone="high"
          label="Interacciones"
          value={hasPosts ? num(pt.interactions) : '—'}
          period={
            hasPosts
              ? 'Me gusta, comentarios y compartidos'
              : 'Sin publicaciones en el periodo'
          }
          delta={compareWhen(
            hasPosts,
            pctDelta(pt.interactions, ptPrev.interactions),
          )}
          href={P('/publicaciones?orden=interacciones')}
        />
        <KpiCard
          icon={BellRing}
          tone="critical"
          label="Alertas por revisar"
          value={num(pendingReview)}
          period="Revisión humana antes de escalar"
          href={P('/revision')}
        />
        <KpiCard
          icon={ShieldAlert}
          tone="warning"
          label="Incidentes activos"
          value={num(openInc)}
          period="Abiertos o en seguimiento"
          href={P('/incidentes')}
        />
      </div>

      {/* Evolución y sentimiento */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-12">
        <ChartCard
          className="xl:col-span-7"
          icon={ChartColumn}
          title="Evolución de la conversación"
          description={`Conversaciones analizadas por día · ${periodLabel(period).toLowerCase()}`}
          table={{
            caption: 'Conversaciones por día y sentimiento',
            columns: [
              'Día',
              'Total',
              'Positivas',
              'Negativas',
              'Neutrales o mixtas',
            ],
            rows: daily.map((d) => [
              d.d,
              d.pos + d.neg + d.other,
              d.pos,
              d.neg,
              d.other,
            ]),
          }}
        >
          {cur.total === 0 ? (
            <EmptyStateV2 compact title="Sin conversaciones en el periodo" />
          ) : (
            <AreaTrend
              height={190}
              unit="conversaciones"
              highlight={`Pico · ${shortDay(daily[peak]!.d)}`}
              highlightIndex={peak}
              primaryLabel="Total de conversaciones"
              secondary={{
                label: 'Negativas',
                values: daily.map((d) => d.neg),
                color: 'chart-neg',
              }}
              points={daily.map((d) => ({
                label: shortDay(d.d),
                value: d.pos + d.neg + d.other,
                detail: `${d.neg} negativas · ${d.pos} positivas`,
              }))}
            />
          )}
        </ChartCard>
        <ChartCard
          className="xl:col-span-5"
          icon={Smile}
          tone="success"
          title="Sentimiento de marca"
          description="Pasa el cursor o enfoca una fila; abre las conversaciones."
          table={{
            caption: 'Distribución del sentimiento',
            columns: ['Sentimiento', 'Conversaciones', '%'],
            rows: [
              ['Positivo', cur.positive, pctOf(cur.positive, cur.total)],
              [
                'Neutral o mixto',
                cur.neutral + cur.mixed,
                pctOf(cur.neutral + cur.mixed, cur.total),
              ],
              ['Negativo', cur.negative, pctOf(cur.negative, cur.total)],
            ],
          }}
        >
          {cur.total === 0 ? (
            <EmptyStateV2 compact title="Sin conversaciones analizadas" />
          ) : (
            <Donut
              centerValue={num(cur.total)}
              centerLabel="conversaciones"
              segments={[
                {
                  key: 'pos',
                  label: 'Positivo',
                  value: cur.positive,
                  color: 'chart-pos',
                  icon: (
                    <Smile aria-hidden className="text-success-fg h-4 w-4" />
                  ),
                  href: P('/conversaciones?sentiment=positive'),
                },
                {
                  key: 'neu',
                  label: 'Neutral o mixto',
                  value: cur.neutral + cur.mixed,
                  color: 'chart-neu',
                  icon: (
                    <Meh
                      aria-hidden
                      className="text-muted-foreground h-4 w-4"
                    />
                  ),
                  href: P('/conversaciones?sentiment=neutral'),
                },
                {
                  key: 'neg',
                  label: 'Negativo',
                  value: cur.negative,
                  color: 'chart-neg',
                  icon: (
                    <Frown aria-hidden className="text-critical-fg h-4 w-4" />
                  ),
                  href: P('/conversaciones?sentiment=negative'),
                },
              ]}
            />
          )}
        </ChartCard>
      </div>

      {/* Foxy (ancho) y, a su lado, temas y canales apilados: sin columnas estiradas. */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-12">
        <div id="foxy" className="scroll-mt-24 xl:col-span-7">
          <FoxyInsightPanel
            wide
            title="Tendencias y hallazgos de Foxy IA"
            subtitle={`Con base en ${num(cur.total)} conversaciones y ${num(curPosts.length)} publicaciones del periodo`}
            findings={findingViews}
            limitation="Solo considera las fuentes conectadas (ver cobertura). Foxy no ejecuta acciones: propone y enlaza la evidencia."
            actions={actions}
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2 xl:col-span-5 xl:grid-cols-1">
          <ChartCard
            icon={Radio}
            tone="info"
            title="Menciones por canal"
            description="Solo redes con fuente conectada. Abre las conversaciones."
            table={{
              caption: 'Conversaciones por red',
              columns: ['Red', 'Conversaciones', '%'],
              rows: channels.map((c) => [
                PLATFORM_LABEL[c.platform],
                c.count,
                pctOf(c.count, cur.total),
              ]),
            }}
          >
            {channels.length === 0 ? (
              <EmptyStateV2 compact title="Sin conversaciones en el periodo" />
            ) : (
              <ChannelShare
                rows={channels.map((c) => ({
                  platform: c.platform,
                  label: PLATFORM_LABEL[c.platform],
                  value: c.count,
                  href: P(`/conversaciones?platform=${c.platform}`),
                }))}
              />
            )}
          </ChartCard>
          <ChartCard
            icon={Tags}
            tone="high"
            title="Temas principales"
            description="Abre el detalle por tema."
            table={{
              caption: 'Temas principales',
              columns: ['Tema', 'Conversaciones'],
              rows: topics,
            }}
          >
            {topics.length === 0 ? (
              <EmptyStateV2 compact title="Sin temas en el periodo" />
            ) : (
              <BarList
                rows={topics.map(([label, value]) => ({
                  label,
                  value,
                  href: P('/temas'),
                }))}
                total={cur.total}
              />
            )}
          </ChartCard>
        </div>
      </div>

      {/* Publicaciones relevantes y alertas */}
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-12">
        <Panel className="xl:col-span-8" aria-labelledby="home-posts">
          <PanelHeader
            icon={Images}
            tone="info"
            title="Publicaciones relevantes"
            titleId="home-posts"
            description="Las de más interacciones del periodo."
            action={
              <Link
                href={P('/publicaciones')}
                className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
              >
                Social Explorer <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            }
          />
          {relevant.length === 0 ? (
            <EmptyStateV2 compact title="Sin publicaciones en el periodo">
              Aparecen cuando una fuente conectada las entrega.
            </EmptyStateV2>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {relevant.map(({ p, s, comments }) => (
                <SocialPostCard
                  key={p.id}
                  post={p}
                  stats={s}
                  comments={comments.length}
                  dominant={dominantSentiment(comments)}
                  href={P(`/publicaciones/${encodeURIComponent(p.id)}`)}
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel className="xl:col-span-4" aria-labelledby="home-alerts">
          <PanelHeader
            icon={BellRing}
            tone="critical"
            title="Alertas de mayor prioridad"
            titleId="home-alerts"
            action={
              <Link
                href={P('/alertas')}
                className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
              >
                Todas <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            }
          />
          {topAlerts.length === 0 ? (
            <EmptyStateV2 compact title="Sin alertas" />
          ) : (
            <ul className="divide-border divide-y">
              {topAlerts.map((a) => (
                <li key={a.id} className="py-3">
                  <p className="text-sm font-bold leading-snug">{a.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill tone={SEVERITY_TONE[a.severity]}>
                      {SEVERITY_LABEL[a.severity]}
                    </StatusPill>
                    {a.isSynthetic && <SyntheticBadge />}
                    <span className="text-muted-foreground text-xs">
                      Prioridad {Math.round(a.priorityScore)} ·{' '}
                      {fmtRelative(a.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </ModuleSurface>
  );
}
