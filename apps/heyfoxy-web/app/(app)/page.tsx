import {
  ArrowRight,
  BellRing,
  CalendarRange,
  Clock3,
  Gauge,
  Images,
  Layers,
  MousePointerClick,
  Network,
  Percent,
  ShieldAlert,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { ChartCard } from '@/components/ds/charts';
import { AreaTrend } from '@/components/ds/charts-client';
import { CopilotAskButton, CopilotScope } from '@/components/ds/copilot';
import {
  BrandContextCard,
  CoverageStatus,
  FoxyExecutiveBrief,
} from '@/components/ds/intel';
import { KpiCard, ModuleSurface } from '@/components/ds/layout';
import { NetworkIcon } from '@/components/ds/network-icons';
import { InteractionBreakdown } from '@/components/ds/performance';
import { SocialPostCard } from '@/components/ds/post';
import {
  Avatar,
  Panel,
  PanelHeader,
  StatusPill,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import {
  brainAvailability,
  getBrandContext,
  listMemory,
} from '@/lib/brain/store';
import { conversationCoverage, summarizeCoverage } from '@/lib/coverage';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { inWindow, netSentiment } from '@/lib/home-insights';
import {
  dominantSentiment,
  postStats,
  sentimentBreakdown,
} from '@/lib/insights';
import {
  executiveBrief,
  featuredPosts,
  networkInteractionBreakdown,
  networkSummaries,
} from '@/lib/intel/brand';
import { engagementOf, formatOf } from '@/lib/intel/common';
import { BRAND_QUESTIONS } from '@/lib/intel/local';
import {
  PERIOD_PARAM,
  parsePeriod,
  periodDays,
  periodLabel,
  periodRange,
  withPeriod,
} from '@/lib/period';
import { getUiTheme } from '@/lib/shell';
import { isV2 } from '@/lib/ui-theme';
import { LegacyOverview } from './legacy-overview';

export const metadata = { title: 'Inicio' };

const num = (n: number) => n.toLocaleString('es-CO');
const pctFmt = (n: number) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
const dayFmt = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  timeZone: 'America/Bogota',
});

/**
 * Intelligence Home (WO-HF-V2-UX-REFINEMENT-002, fase A): centro ejecutivo de inteligencia
 * estratégica de marca. Contenido y rendimiento primero; la reputación se mantiene como módulo
 * y su ausencia de datos no domina la pantalla. Métricas por red, nunca sumadas entre redes.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (!isV2(await getUiTheme())) return <LegacyOverview />;

  const period = parsePeriod((await searchParams)[PERIOD_PARAM]);
  const days = periodDays(period);
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, alerts, incidents, coverage, posts, stored, memory] =
    await Promise.all([
      repo.items(orgId, { limit: 1000 }),
      repo.alerts(orgId),
      repo.incidents(orgId),
      repo.coverage(orgId),
      repo.posts(orgId),
      getBrandContext(orgId),
      listMemory(orgId),
    ]);
  const P = (href: string) => withPeriod(href, period);
  const now = Date.now();
  const curPosts = inWindow(posts, days, now);
  const current = inWindow(items, days, now);
  const sent = sentimentBreakdown(current);
  const pendingReview = alerts.filter(
    (a) => a.reviewStatus === 'pending',
  ).length;
  const openInc = incidents.filter(
    (i) => !['closed', 'false_positive', 'resolved'].includes(i.status),
  ).length;
  const conv = conversationCoverage(coverage, sent.total);
  const cov = summarizeCoverage(coverage);
  const nets = networkSummaries(curPosts);
  const connectedNets = [
    ...new Set(
      coverage
        .filter((r) => r.status === 'complete' || r.status === 'partial')
        .map((r) => r.platform),
    ),
  ];
  const lastUpdate = curPosts
    .flatMap((p) => p.metrics.map((m) => m.capturedAt))
    .sort()
    .at(-1);
  const brand = stored?.context ?? null;
  const brief = executiveBrief({
    posts: curPosts,
    brand,
    periodLabel: periodLabel(period),
    risk:
      conv === 'available'
        ? { pendingAlerts: pendingReview, negatives: sent.negative }
        : null,
  });
  const featured = featuredPosts(curPosts, 4);
  const learnings = {
    proposed: memory.filter((m) => m.status === 'proposed').length,
    validated: memory.filter((m) => m.status === 'validated').length,
  };
  const postHrefPattern = P('/publicaciones/{id}');
  const postHref = (id: string) =>
    postHrefPattern.replace('{id}', encodeURIComponent(id));
  const measured = curPosts.filter((p) => p.metrics.length > 0);
  // Clases literales (Tailwind solo genera las que aparecen escritas en el código).
  const perfCols =
    nets.length >= 3
      ? 'lg:grid-cols-2 2xl:grid-cols-3'
      : nets.length === 2
        ? 'lg:grid-cols-2'
        : '';
  const netCols =
    nets.length >= 3
      ? 'md:grid-cols-2 2xl:grid-cols-3'
      : nets.length === 2
        ? 'md:grid-cols-2'
        : '';

  return (
    <ModuleSurface module="home">
      <CopilotScope
        screen="Intelligence Home"
        postId={null}
        platform={null}
        label={`${active.organization.name} · todas las redes · ${periodLabel(period).toLowerCase()}`}
        suggestions={BRAND_QUESTIONS}
        postHrefPattern={postHrefPattern}
      />

      {/* A. Cabecera ejecutiva */}
      <section
        aria-labelledby="home-title"
        className="rounded-panel border-border/70 from-card to-primary-pale/60 shadow-card mb-4 border bg-gradient-to-br p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={active.organization.name} size={52} />
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-primary-text flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.12em]">
              <Gauge aria-hidden className="h-4 w-4" /> Intelligence Home
            </p>
            <h1
              id="home-title"
              className="mt-0.5 text-[24px] font-black leading-tight tracking-tight sm:text-[28px]"
            >
              {active.organization.name}
            </h1>
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange aria-hidden className="h-4 w-4" />
                {periodLabel(period)} · {periodRange(period)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Network aria-hidden className="h-4 w-4" />
                {cov.sources.length
                  ? `${cov.sources.join(', ')} · ${connectedNets.length} ${connectedNets.length === 1 ? 'red' : 'redes'}`
                  : 'Sin fuentes conectadas'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 aria-hidden className="h-4 w-4" />
                {lastUpdate
                  ? `Última medición ${fmtRelative(lastUpdate)} (${fmtDateTime(lastUpdate)})`
                  : 'Sin mediciones en el periodo'}
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {connectedNets.map((p) => (
                <StatusPill key={p} tone="success">
                  <span className="inline-flex items-center gap-1">
                    <NetworkIcon platform={p} size={12} /> Conectada
                  </span>
                </StatusPill>
              ))}
              {cov.disabled.length > 0 && (
                <StatusPill tone="ai">
                  Desactivado por privacidad: {cov.disabled.join(', ')}
                </StatusPill>
              )}
              <Link
                href={P('/cobertura')}
                className="text-primary-text inline-flex items-center gap-1 px-1 text-xs font-extrabold"
              >
                Cobertura <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
          <CopilotAskButton
            question="¿Qué contenidos están funcionando mejor?"
            className="bg-brand text-brand-foreground inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-extrabold sm:w-auto"
          >
            <Sparkles aria-hidden className="h-4 w-4" /> Preguntar a Foxy
          </CopilotAskButton>
        </div>
      </section>

      {/* B. KPI principales: por red, sin sumar métricas incompatibles */}
      <h2 className="sr-only">Indicadores del periodo</h2>
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 xl:col-span-3 xl:grid-cols-1">
          <KpiCard
            icon={Images}
            tone="info"
            label="Publicaciones"
            value={num(curPosts.length)}
            period={`${measured.length} con métricas · ${periodLabel(period).toLowerCase()}`}
            href={P('/publicaciones')}
          />
          <KpiCard
            icon={Network}
            tone="ai"
            label="Redes conectadas"
            value={num(connectedNets.length)}
            period={
              nets.length
                ? nets.map((n) => n.label).join(' · ')
                : 'Sin publicaciones'
            }
            href={P('/cobertura')}
          />
        </div>
        {nets.length === 0 ? (
          <div className="xl:col-span-9">
            <EmptyStateV2 title="Sin publicaciones en el periodo">
              Aparecen cuando una fuente conectada las entrega. Amplía el
              periodo o revisa la cobertura.
            </EmptyStateV2>
          </div>
        ) : (
          <div
            className={`grid grid-cols-[minmax(0,1fr)] gap-3 xl:col-span-9 ${netCols}`}
          >
            {nets.map((n) => (
              <section
                key={n.platform}
                aria-label={`Indicadores de ${n.label}`}
                className="rounded-card border-border/80 bg-card shadow-card border p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold">
                    <NetworkIcon platform={n.platform} size={18} /> {n.label}
                  </h3>
                  <span className="text-muted-foreground text-xs font-bold">
                    {n.measured} de {n.posts} con métricas
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                  {(
                    [
                      [
                        Users,
                        'text-metric-reach',
                        `${n.reachLabel} acumulado`,
                        n.reachSum != null ? num(n.reachSum) : '—',
                        'Suma por publicación; no son personas únicas.',
                      ],
                      [
                        Percent,
                        'text-metric-engagement',
                        'Engagement mediano',
                        n.engagementMedian != null
                          ? pctFmt(n.engagementMedian)
                          : '—',
                        `Engagement = ${n.engagementBasis}.`,
                      ],
                      [
                        Eye,
                        'text-metric-impressions',
                        'Impresiones',
                        n.impressionsSum != null ? num(n.impressionsSum) : '—',
                        'Suma por publicación.',
                      ],
                      [
                        MousePointerClick,
                        'text-metric-interactions',
                        `Interacciones según ${n.label}`,
                        n.interactionsSum != null
                          ? num(n.interactionsSum)
                          : '—',
                        'Total que reporta la red.',
                      ],
                    ] as const
                  ).map(([Icon, cls, label, value, hint]) => (
                    <div key={label} className="min-w-0">
                      <dt className="text-muted-foreground flex items-center gap-1.5 text-[11.5px] font-bold leading-tight">
                        <Icon aria-hidden className={`h-3.5 w-3.5 ${cls}`} />
                        {label}
                      </dt>
                      <dd className="mt-1 text-[22px] font-extrabold tabular-nums leading-none">
                        {value}
                      </dd>
                      <dd className="text-muted-foreground mt-1 text-[11px] leading-snug">
                        {hint}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* C. Foxy Executive Brief + Brand Brain + Ask Foxy */}
      <div className="mb-4 grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <FoxyExecutiveBrief
            items={brief}
            hrefFor={P}
            postHref={postHref}
            subtitle={`${measured.length} publicaciones con métricas · ${periodLabel(period).toLowerCase()}`}
            footer={
              <p className="text-muted-foreground text-xs">
                Solo datos autorizados de las fuentes conectadas. Cada red se
                evalúa con su propia definición de engagement y alcance; Foxy
                propone y enlaza la evidencia, no ejecuta acciones.
              </p>
            }
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
          <BrandContextCard
            stored={stored}
            href={P('/brand-brain')}
            availability={brainAvailability()}
            learnings={learnings}
            detailed
          />
          <Panel aria-labelledby="home-ask">
            <PanelHeader
              icon={Sparkles}
              tone="ai"
              title="Pregúntale a Foxy"
              titleId="home-ask"
              description="Se abre a un lado, sin salir de esta pantalla."
            />
            <div className="flex flex-col gap-1.5">
              {BRAND_QUESTIONS.slice(0, 5).map((q) => (
                <CopilotAskButton
                  key={q}
                  question={q}
                  className="bg-card hover:border-ai-fg/40 border-border rounded-xl border px-3 py-2 text-left text-[13px] font-bold"
                />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* E. Publicaciones destacadas */}
      <Panel className="mb-4" aria-labelledby="home-featured">
        <PanelHeader
          icon={Star}
          tone="high"
          title="Publicaciones destacadas"
          titleId="home-featured"
          description="Cada una con el motivo verificable por el que destaca, dentro de su propia red."
          action={
            <Link
              href={P('/publicaciones')}
              className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
            >
              Social Explorer <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          }
        />
        {featured.length === 0 ? (
          <EmptyStateV2 compact title="Sin base para destacar publicaciones">
            Se necesitan al menos dos publicaciones con métricas en la misma
            red.
          </EmptyStateV2>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((f) => (
              <div key={f.post.id} className="flex flex-col gap-2">
                <SocialPostCard
                  post={f.post}
                  stats={postStats(f.post)}
                  comments={items.filter((i) => i.postId === f.post.id).length}
                  dominant={dominantSentiment(
                    items.filter((i) => i.postId === f.post.id),
                  )}
                  href={postHref(f.post.id)}
                />
                <p className="bg-high-bg/60 rounded-xl px-3 py-2 text-[12.5px] leading-snug">
                  <b>
                    {f.metricLabel} {f.metricValue}
                  </b>{' '}
                  · {formatOf(f.post)} ·{' '}
                  {f.post.publishedAt
                    ? dayFmt.format(Date.parse(f.post.publishedAt))
                    : 'sin fecha'}
                  <span className="text-muted-foreground block">
                    {f.reason}
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* D. Content performance (por red) */}
      {nets.length > 0 && (
        <section aria-labelledby="home-perf" className="mb-4">
          <h2
            id="home-perf"
            className="mb-3 flex items-center gap-2 text-base font-extrabold"
          >
            <TrendingUp aria-hidden className="text-info-fg h-5 w-5" /> Content
            performance
          </h2>
          <div
            className={`grid grid-cols-[minmax(0,1fr)] items-start gap-4 ${perfCols}`}
          >
            {nets.map((n) => {
              const ps = measured
                .filter((p) => p.platform === n.platform && p.publishedAt)
                .sort(
                  (a, b) =>
                    Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!),
                );
              const pts = ps
                .map((p) => ({ p, e: engagementOf(p) }))
                .filter(
                  (x): x is { p: (typeof ps)[number]; e: number } =>
                    x.e != null,
                );
              const fmtMax = Math.max(
                0,
                ...n.formats.map((f) => f.engagementMedian ?? 0),
              );
              const ix = networkInteractionBreakdown(curPosts, n.platform);
              return (
                <div key={n.platform} className="min-w-0 space-y-4">
                  <ChartCard
                    icon={Layers}
                    tone="info"
                    title={`${n.label} · rendimiento`}
                    description={`Engagement = ${n.engagementBasis} · ${n.measured} publicaciones · ${periodLabel(period).toLowerCase()}`}
                    table={{
                      caption: `Engagement por formato y por publicación en ${n.label}`,
                      columns: ['Fecha', 'Formato', 'Engagement'],
                      rows: pts.map(({ p, e }) => [
                        fmtDateTime(p.publishedAt),
                        formatOf(p),
                        pctFmt(e),
                      ]),
                    }}
                  >
                    <p className="text-muted-foreground mb-2 text-[11px] font-extrabold uppercase tracking-wider">
                      Mediana de engagement por formato
                    </p>
                    <ul className="space-y-2.5">
                      {n.formats.map((f) => (
                        <li
                          key={f.format}
                          className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-2 text-sm"
                        >
                          <span className="truncate font-bold">
                            {f.format}{' '}
                            <span className="text-muted-foreground text-xs font-semibold">
                              (n = {f.n})
                            </span>
                          </span>
                          <span
                            className="bg-muted h-2.5 overflow-hidden rounded-full"
                            aria-hidden
                          >
                            <span
                              className={`block h-full rounded-full ${f.n >= 3 ? 'bg-metric-engagement' : 'bg-metric-engagement/40'}`}
                              style={{
                                width: `${fmtMax > 0 && f.engagementMedian != null ? Math.max(2, (f.engagementMedian / fmtMax) * 100) : 0}%`,
                              }}
                            />
                          </span>
                          <b className="w-14 text-right tabular-nums">
                            {f.engagementMedian != null
                              ? pctFmt(f.engagementMedian)
                              : '—'}
                          </b>
                        </li>
                      ))}
                    </ul>
                    <div className="border-border mt-4 border-t pt-3">
                      <p className="text-muted-foreground mb-2 text-[11px] font-extrabold uppercase tracking-wider">
                        Engagement de cada publicación por fecha
                      </p>
                      {pts.length < 2 ? (
                        <p className="text-muted-foreground text-[13px]">
                          {pts.length === 1
                            ? `Una sola publicación con engagement (${pctFmt(pts[0]!.e)}): la evolución aparece con más publicaciones.`
                            : 'Sin publicaciones con engagement en el periodo.'}
                        </p>
                      ) : (
                        <AreaTrend
                          height={150}
                          unit="% de engagement"
                          points={pts.map(({ p, e }) => ({
                            label: dayFmt
                              .format(Date.parse(p.publishedAt!))
                              .replace('.', ''),
                            value: Math.round(e * 10) / 10,
                            detail: formatOf(p),
                          }))}
                        />
                      )}
                    </div>
                    <p className="text-muted-foreground mt-3 text-[11.5px]">
                      Barra atenuada: menos de 3 publicaciones (base pequeña).
                      Un punto por publicación real; sin puntos intermedios.
                      Descriptivo: no demuestra causalidad.
                    </p>
                  </ChartCard>
                  {ix && (
                    <InteractionBreakdown
                      data={ix}
                      networkLabel={n.label}
                      stacked={nets.length >= 3}
                      description={`Suma de la última medición de ${n.measured} ${n.measured === 1 ? 'publicación' : 'publicaciones'} de ${n.label}.`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* G. Reputación: módulo propio, sin dominar la pantalla */}
      <Panel aria-labelledby="home-rep">
        <PanelHeader
          icon={ShieldAlert}
          tone="neutral"
          title="Reputación"
          titleId="home-rep"
          description="Conversación sobre la marca en las fuentes autorizadas."
          action={
            <Link
              href={P('/conversaciones')}
              className="text-primary-text inline-flex items-center gap-1 text-sm font-extrabold"
            >
              Conversaciones <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          }
        />
        {conv === 'available' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
            <KpiCard
              icon={Users}
              tone="ai"
              label="Conversaciones analizadas"
              value={num(sent.total)}
              period={periodLabel(period)}
              href={P('/conversaciones')}
            />
            <KpiCard
              icon={TrendingUp}
              tone={netSentiment(sent) >= 0 ? 'success' : 'critical'}
              label="Sentimiento neto"
              value={`${netSentiment(sent) > 0 ? '+' : ''}${netSentiment(sent)} pts`}
              period={`${sent.positive} positivas · ${sent.negative} negativas`}
            />
          </div>
        ) : (
          <CoverageStatus
            state={conv}
            compact
            detail={
              conv === 'privacy_disabled'
                ? 'La importación de comentarios está desactivada por la política de privacidad del piloto. Que Hey Foxy no los importe no significa que no haya conversación en la red.'
                : conv === 'not_connected'
                  ? 'Ninguna fuente de comentarios, menciones o reseñas está conectada para esta organización.'
                  : conv === 'not_imported'
                    ? 'Hay fuentes de conversación configuradas, pero todavía no entregan comentarios.'
                    : `Las fuentes conectadas no registraron conversaciones en ${periodLabel(period).toLowerCase()}.`
            }
          />
        )}
      </Panel>
    </ModuleSurface>
  );
}
