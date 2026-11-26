import {
  ArrowLeft,
  CalendarClock,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  MessagesSquare,
  ShieldAlert,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChartCard } from '@/components/ds/charts';
import { ConversationRow } from '@/components/ds/conversation';
import {
  BrandContextCard,
  FoxyContentIntelligence,
} from '@/components/ds/intel';
import {
  AskFoxyContextual,
  ExpandableCopy,
  PerformanceTimeline,
  type TimelineSeries,
} from '@/components/ds/intel-client';
import { ModuleSurface } from '@/components/ds/layout';
import {
  InteractionBreakdown,
  MetricAvailabilityState,
  PerformanceMetricCard,
} from '@/components/ds/performance';
import { AuthorChip, OriginalLink, PostMedia } from '@/components/ds/post';
import {
  Panel,
  PanelHeader,
  StatusPill,
  SyntheticBadge,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { brainAvailability, getBrandContext } from '@/lib/brain/store';
import { explorerQuery, parseExplorerFilters } from '@/lib/explorer-filters';
import { PLATFORM_LABEL, fmtDateTime } from '@/lib/format';
import { inWindow } from '@/lib/home-insights';
import { commentsDisabledFor, getPostIntel } from '@/lib/intel/engine';
import { formatOf, SUGGESTED_QUESTIONS } from '@/lib/intel/local';
import {
  interactionBreakdown,
  metricSeries,
  reactionsByType,
  readMetric,
  type MetricKey,
} from '@/lib/intel/metrics';
import {
  PERIOD_PARAM,
  parsePeriod,
  periodDays,
  periodLabel,
  withPeriod,
} from '@/lib/period';
import { getUiTheme } from '@/lib/shell';
import { isV2 } from '@/lib/ui-theme';
import { LegacyPostDetail } from './legacy-post-detail';

export const metadata = { title: 'Detalle de publicación' };

const capLabel = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Bogota',
});

/**
 * Centro de inteligencia de contenido de una publicación (WO-HF-V2-INTELLIGENCE-001 + addendum).
 * Publicación original · rendimiento · Foxy Content Intelligence · Ask Foxy · navegación.
 * Todo acotado a la organización activa (y RLS en Supabase). Nunca se inventan datos.
 */
export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  if (!isV2(await getUiTheme())) return <LegacyPostDetail id={id} />;
  const sp = await searchParams;
  const period = parsePeriod(sp[PERIOD_PARAM]);
  const filters = parseExplorerFilters(sp);
  const fq = explorerQuery(filters);
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const post = await repo.post(orgId, decodeURIComponent(id));
  if (!post) notFound();
  const [allPosts, filtered, stored] = await Promise.all([
    repo.posts(orgId),
    repo.posts(orgId, { q: filters.q, platform: filters.platform }),
    getBrandContext(orgId),
  ]);
  const days = periodDays(period);
  const peers = inWindow(allPosts, days);
  const comments = commentsDisabledFor(post)
    ? []
    : await repo.items(orgId, { postId: post.id });

  // Navegación entre publicaciones con los mismos filtros y periodo que la galería.
  const nav = inWindow(filtered, days);
  const idx = nav.findIndex((p) => p.id === post.id);
  const linkTo = (pid: string) =>
    withPeriod(
      `/publicaciones/${encodeURIComponent(pid)}${fq ? `?${fq}` : ''}`,
      period,
    );
  const prev = idx > 0 ? nav[idx - 1] : null;
  const next = idx >= 0 && idx < nav.length - 1 ? nav[idx + 1] : null;

  const { intel, meta, reason, status } = getPostIntel({
    orgId,
    post,
    peers,
    brand: stored?.context ?? null,
    periodLabel: periodLabel(period),
  });
  const availability = brainAvailability();
  const canSave =
    ['owner', 'admin', 'analyst'].includes(active.role) &&
    availability === 'ready';
  const net = PLATFORM_LABEL[post.platform];

  const reach = readMetric(post, 'reach');
  const engagement = readMetric(post, 'engagement');
  const impressions = readMetric(post, 'impressions');
  const ixNet = readMetric(post, 'interactions');
  const views = readMetric(post, 'views');
  const breakdown = interactionBreakdown(post);
  const engFinding = intel?.performance.findings.find((f) =>
    /equivalentes/.test(f.title),
  );
  const engComparison =
    engFinding?.evidence.find((e) => e.type === 'comparison')?.value != null
      ? `Mediana de equivalentes: ${engFinding.evidence.find((e) => e.type === 'comparison')!.value}`
      : null;

  const series: TimelineSeries[] = (
    [
      ['components', 'Interacciones', 'interacciones'],
      [
        'reach',
        reach.label,
        post.platform === 'facebook' ? 'impresiones únicas' : 'cuentas',
      ],
      ['impressions', 'Impresiones', 'impresiones'],
      ['engagement', 'Engagement', '%'],
      [
        'likes',
        post.platform === 'facebook' ? 'Reacciones' : 'Me gusta',
        'me gusta',
      ],
      ['saves', 'Guardados', 'guardados'],
      ['shares', 'Compartidos', 'compartidos'],
    ] as Array<[MetricKey | 'components', string, string]>
  ).map(([key, label, unit]) => ({
    key,
    label,
    unit,
    points: metricSeries(post, key).map((p) => ({
      at: p.at,
      value: p.value,
      label: capLabel.format(Date.parse(p.at)).replace('.', ''),
    })),
  }));

  return (
    <ModuleSurface module="explorer">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={withPeriod(`/publicaciones${fq ? `?${fq}` : ''}`, period)}
          className="text-primary-text inline-flex items-center gap-1.5 text-sm font-extrabold"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" /> Social Explorer
        </Link>
        <nav
          aria-label="Navegar entre publicaciones"
          className="flex items-center gap-1.5 text-sm"
        >
          {prev ? (
            <Link
              href={linkTo(prev.id)}
              className="border-border hover:bg-card inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-extrabold"
              rel="prev"
            >
              <ChevronLeft aria-hidden className="h-4 w-4" /> Anterior
            </Link>
          ) : (
            <span className="text-muted-foreground border-border inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-bold opacity-50">
              <ChevronLeft aria-hidden className="h-4 w-4" /> Anterior
            </span>
          )}
          {idx >= 0 && (
            <span className="text-muted-foreground px-1 text-xs font-bold tabular-nums">
              {idx + 1} de {nav.length}
            </span>
          )}
          {next ? (
            <Link
              href={linkTo(next.id)}
              className="border-border hover:bg-card inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-extrabold"
              rel="next"
            >
              Siguiente <ChevronRight aria-hidden className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-muted-foreground border-border inline-flex items-center gap-1 rounded-full border px-3 py-1.5 font-bold opacity-50">
              Siguiente <ChevronRight aria-hidden className="h-4 w-4" />
            </span>
          )}
        </nav>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        {/* A. Publicación original */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:col-span-4">
          <Panel as="article" aria-labelledby="post-title">
            <div className="mb-3 flex items-start justify-between gap-2">
              <AuthorChip post={post} size={42} />
              {post.isSynthetic && <SyntheticBadge />}
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <StatusPill tone="info">{formatOf(post)}</StatusPill>
              {post.publishedAt && (
                <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-semibold">
                  <CalendarClock aria-hidden className="h-3.5 w-3.5" />
                  {fmtDateTime(post.publishedAt)}
                </span>
              )}
            </div>
            <PostMedia post={post} variant="detail" />
            <h1 id="post-title" className="sr-only">
              Publicación de {net}
              {post.publishedAt ? ` del ${fmtDateTime(post.publishedAt)}` : ''}
            </h1>
            <div className="mt-4">
              <ExpandableCopy text={post.body} />
            </div>
            <OriginalLink post={post} className="mt-3" />
          </Panel>
          <BrandContextCard
            stored={stored}
            href={withPeriod('/brand-brain', period)}
            availability={availability}
          />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-8">
          {/* B. Rendimiento: KPI principales */}
          <h2 className="sr-only">Rendimiento</h2>
          <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
            <PerformanceMetricCard reading={reach} tone="reach" />
            <PerformanceMetricCard
              reading={engagement}
              tone="engagement"
              comparison={engComparison}
            />
            <PerformanceMetricCard reading={impressions} tone="impressions" />
            <PerformanceMetricCard reading={ixNet} tone="interactions" />
          </div>
          {(views.state === 'value' || views.state === 'zero') &&
            views.value !== impressions.value && (
              <p className="text-muted-foreground text-xs">
                <b className="text-foreground">{views.label}:</b>{' '}
                {views.display} · {views.definition}
              </p>
            )}
          {views.state === 'not_applicable' && (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <b className="text-foreground">Vistas:</b>{' '}
              <MetricAvailabilityState state="not_applicable" /> {net} no
              entrega vistas para este formato.
            </p>
          )}

          {/* C. Inteligencia */}
          <FoxyContentIntelligence
            intel={status === 'ok' ? intel : null}
            meta={meta}
            postId={post.id}
            postHref={linkTo}
            canSave={canSave}
            saveDisabledReason={
              availability !== 'ready'
                ? 'Memoria estratégica pendiente de la migración 0007'
                : !canSave
                  ? 'Tu rol no puede proponer aprendizajes'
                  : undefined
            }
            brandHref={withPeriod('/brand-brain', period)}
            disabledReason={reason}
          />

          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 2xl:grid-cols-2">
            <InteractionBreakdown
              data={breakdown}
              networkLabel={net}
              reactions={reactionsByType(post)}
            />
            <div id="historial" className="scroll-mt-24">
              <ChartCard
                icon={ChartColumn}
                tone="info"
                title="Evolución del rendimiento"
                description={`${post.metrics.length} ${post.metrics.length === 1 ? 'medición' : 'mediciones'} de Metricool. Elige la métrica.`}
                table={{
                  caption: 'Historial de mediciones de la publicación',
                  columns: [
                    'Medición',
                    'Me gusta',
                    'Comentarios en la red',
                    'Compartidos',
                    'Guardados',
                    reach.label,
                    'Impresiones',
                    'Engagement',
                  ],
                  rows: post.metrics.map((m) => [
                    fmtDateTime(m.capturedAt),
                    m.likes ?? '—',
                    m.comments ?? '—',
                    m.shares ?? '—',
                    m.saves ?? '—',
                    (post.platform === 'facebook' && m.reach == null
                      ? m.impressionsUnique
                      : m.reach) ?? '—',
                    m.impressions ?? '—',
                    m.engagement != null
                      ? `${m.engagement.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`
                      : '—',
                  ]),
                }}
              >
                <PerformanceTimeline series={series} />
              </ChartCard>
            </div>
          </div>

          {/* D. Experiencia conversacional */}
          <AskFoxyContextual
            postId={post.id}
            period={period}
            platform={post.platform}
            suggestions={SUGGESTED_QUESTIONS}
            scopeLabel={`${active.organization.name} · ${net} · ${formatOf(post)} · ${periodLabel(period).toLowerCase()}`}
            postHrefPattern={withPeriod(
              `/publicaciones/{id}${fq ? `?${fq}` : ''}`,
              period,
            )}
          />

          {/* Conversación: reputación solo con comentarios autorizados */}
          <Panel
            aria-labelledby="comentarios-titulo"
            id="comentarios"
            className="scroll-mt-24"
          >
            {commentsDisabledFor(post) ? (
              <>
                <PanelHeader
                  icon={ShieldAlert}
                  tone="neutral"
                  title="Comentarios"
                  titleId="comentarios-titulo"
                  description="Importación de comentarios desactivada por la política de privacidad del piloto."
                />
                <p className="text-muted-foreground text-sm">
                  {net} reporta{' '}
                  <b className="text-foreground">
                    {post.metrics[0]?.comments != null
                      ? post.metrics[0].comments.toLocaleString('es-CO')
                      : 'un número no disponible de'}
                  </b>{' '}
                  comentarios en la red. Hey Foxy no los importa ni los
                  clasifica: que no se muestren aquí no significa que no haya
                  conversación.
                </p>
              </>
            ) : (
              <>
                <PanelHeader
                  icon={MessagesSquare}
                  title={`Comentarios clasificados por Hey Foxy (${comments.length})`}
                  titleId="comentarios-titulo"
                />
                {comments.length === 0 ? (
                  <EmptyStateV2
                    compact
                    title="Sin comentarios clasificados para esta publicación"
                  />
                ) : (
                  <div className="divide-border divide-y">
                    {comments.map((i) => (
                      <ConversationRow key={i.id} i={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      </div>
    </ModuleSurface>
  );
}
