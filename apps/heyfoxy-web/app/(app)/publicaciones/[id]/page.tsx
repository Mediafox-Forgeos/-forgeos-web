import {
  ArrowLeft,
  ChartColumn,
  Eye,
  Heart,
  Lightbulb,
  MessagesSquare,
  Radio,
  Smile,
  Tags,
  TrendingUp,
  TriangleAlert,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarList, ChartCard } from '@/components/ds/charts';
import { AreaTrend, Donut } from '@/components/ds/charts-client';
import { ConversationRow } from '@/components/ds/conversation';
import {
  FoxyInsightPanel,
  KpiCard,
  ModuleSurface,
  type FoxyFindingView,
} from '@/components/ds/layout';
import {
  AuthorChip,
  NetworkMetrics,
  OriginalLink,
  PostMedia,
  PostMetricsRow,
  SentimentPill,
  fmtNum,
} from '@/components/ds/post';
import {
  Panel,
  PanelHeader,
  StatusPill,
  SyntheticBadge,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { explorerQuery, parseExplorerFilters } from '@/lib/explorer-filters';
import { SENTIMENT_LABEL, fmtDateTime } from '@/lib/format';
import { pctOf } from '@/lib/home-insights';
import {
  dominantSentiment,
  interactions,
  postStats,
  sentimentBreakdown,
  topTopics,
} from '@/lib/insights';
import { PERIOD_PARAM, parsePeriod, withPeriod } from '@/lib/period';
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

/** Detalle de publicación de Social Explorer (WO-HF-V2-06) con análisis contextual de Foxy. */
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
  // «Volver» conserva los filtros con los que se llegó desde la galería.
  const fq = explorerQuery(parseExplorerFilters(sp));
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  // La publicación se busca SIEMPRE dentro de la organización activa (y RLS en Supabase).
  const post = await repo.post(orgId, decodeURIComponent(id));
  if (!post) notFound();
  const comments = await repo.items(orgId, { postId: post.id });
  const s = postStats(post);
  const b = sentimentBreakdown(comments);
  const dominant = dominantSentiment(comments);
  const topics = topTopics(comments, 5);
  const history = [...post.metrics].reverse();
  const negatives = comments.filter(
    (c) => c.analysis?.sentiment === 'negative',
  );
  const negTopic = topTopics(negatives, 1)[0];

  const findings: FoxyFindingView[] = [];
  if (dominant)
    findings.push({
      id: 'dominant',
      tone:
        dominant === 'negative'
          ? 'critical'
          : dominant === 'positive'
            ? 'success'
            : 'neutral',
      icon: Smile,
      text: `Sentimiento dominante en los comentarios: ${SENTIMENT_LABEL[dominant].toLowerCase()}.`,
      basis: `${b.positive} positivos · ${b.negative} negativos · ${b.neutral + b.mixed} neutrales o mixtos, de ${b.total} clasificados.`,
      evidence: [{ label: 'Ver comentarios', href: '#comentarios' }],
    });
  if (negTopic && negTopic[1] >= 1)
    findings.push({
      id: 'neg-topic',
      tone: 'high',
      icon: Tags,
      text: `Los comentarios negativos hablan sobre todo de «${negTopic[0]}».`,
      basis: `${negTopic[1]} de ${negatives.length} comentarios negativos.`,
      evidence: [{ label: 'Ver comentarios', href: '#comentarios' }],
    });
  if (s.unusual && s.growth !== null)
    findings.push({
      id: 'unusual',
      tone: 'info',
      icon: TrendingUp,
      text: 'Actividad inusual: las interacciones al menos se duplicaron entre las dos últimas mediciones.',
      basis: `+${fmtNum(s.growth)} interacciones.`,
      evidence: [{ label: 'Ver historial', href: '#historial' }],
    });
  if (b.total > 0 && b.negativePct >= 50)
    findings.push({
      id: 'respond',
      tone: 'critical',
      icon: TriangleAlert,
      text: 'Conviene revisar y responder: la mayoría de los comentarios son negativos.',
      basis: `${b.negativePct} % negativos.`,
      evidence: [
        { label: 'Ver alertas', href: withPeriod('/alertas', period) },
      ],
    });

  return (
    <ModuleSurface module="explorer">
      <Link
        href={withPeriod(`/publicaciones${fq ? `?${fq}` : ''}`, period)}
        className="text-primary-text mb-4 inline-flex items-center gap-1.5 text-sm font-extrabold"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Social Explorer
      </Link>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-12">
        {/* Publicación original */}
        <Panel
          as="article"
          className="self-start lg:sticky lg:top-24 lg:col-span-4"
          aria-labelledby="post-title"
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <AuthorChip post={post} size={40} />
            {post.isSynthetic && <SyntheticBadge />}
          </div>
          <PostMedia post={post} variant="detail" />
          <h1
            id="post-title"
            className="mt-4 text-lg font-extrabold leading-snug"
          >
            {post.body ?? 'Publicación sin texto'}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Publicada {fmtDateTime(post.publishedAt)}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {dominant && (
              <SentimentPill
                s={dominant}
                label={`Comentarios: ${SENTIMENT_LABEL[dominant].toLowerCase()}`}
              />
            )}
            {s.unusual && (
              <StatusPill tone="high" icon={TrendingUp}>
                Actividad inusual
              </StatusPill>
            )}
          </div>
          <PostMetricsRow
            stats={s}
            size="md"
            className="border-border mt-4 border-t pt-4"
          />
          <OriginalLink post={post} className="mt-3" />
        </Panel>

        {/* Métricas, Foxy (ancho), historial, sentimiento y comentarios */}
        <div className="min-w-0 space-y-4 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <KpiCard
              icon={Heart}
              tone="high"
              label="Interacciones"
              value={fmtNum(s.interactions)}
              period={
                s.growth === null
                  ? 'Una sola medición'
                  : `${s.growth >= 0 ? '+' : ''}${fmtNum(s.growth)} desde la anterior`
              }
            />
            <KpiCard
              icon={Users}
              tone="ai"
              label="Alcance"
              value={fmtNum(s.latest?.reach)}
              period="Última medición"
            />
            <KpiCard
              icon={Eye}
              tone="info"
              label="Vistas"
              value={fmtNum(s.latest?.views)}
              period="Última medición"
            />
            <KpiCard
              icon={MessagesSquare}
              tone="critical"
              label="Comentarios clasificados"
              value={fmtNum(b.total)}
              period={
                b.total ? `${b.negativePct} % negativos` : 'Sin comentarios'
              }
            />
          </div>

          <NetworkMetrics metrics={s.latest} platform={post.platform} />

          <FoxyInsightPanel
            wide
            title="Análisis de Foxy IA"
            subtitle="Sobre esta publicación y sus comentarios"
            findings={findings}
            limitation="Basado solo en los comentarios clasificados de esta publicación. Responder requiere permisos de la red y confirmación humana."
          />
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-2">
            <div id="historial" className="scroll-mt-24">
              <ChartCard
                icon={ChartColumn}
                tone="info"
                title="Historial de métricas"
                description="Interacciones por medición."
                table={{
                  caption: 'Historial de métricas de la publicación',
                  columns: [
                    'Medición',
                    'Me gusta',
                    'Comentarios',
                    'Compartidos',
                    'Interacciones',
                    'Alcance',
                  ],
                  rows: post.metrics.map((m) => [
                    fmtDateTime(m.capturedAt),
                    fmtNum(m.likes),
                    fmtNum(m.comments),
                    fmtNum(m.shares),
                    fmtNum(interactions(m)),
                    fmtNum(m.reach),
                  ]),
                }}
              >
                {history.length < 2 ? (
                  <EmptyStateV2
                    compact
                    title={
                      history.length
                        ? 'Una sola medición'
                        : 'Sin mediciones todavía'
                    }
                  >
                    La evolución aparece a partir de dos mediciones.
                  </EmptyStateV2>
                ) : (
                  <AreaTrend
                    height={170}
                    unit="interacciones"
                    points={history.map((m) => ({
                      label: capLabel
                        .format(Date.parse(m.capturedAt))
                        .replace('.', ''),
                      value: interactions(m),
                      detail: `alcance ${fmtNum(m.reach)}`,
                    }))}
                  />
                )}
              </ChartCard>
            </div>

            <div className="space-y-4">
              {b.total > 0 && (
                <ChartCard
                  icon={Radio}
                  tone="ai"
                  title="Sentimiento de los comentarios"
                  table={{
                    caption: 'Sentimiento de los comentarios',
                    columns: ['Sentimiento', 'Comentarios', '%'],
                    rows: [
                      ['Positivo', b.positive, pctOf(b.positive, b.total)],
                      [
                        'Neutral o mixto',
                        b.neutral + b.mixed,
                        pctOf(b.neutral + b.mixed, b.total),
                      ],
                      ['Negativo', b.negative, pctOf(b.negative, b.total)],
                    ],
                  }}
                >
                  <Donut
                    stacked
                    centerValue={fmtNum(b.total)}
                    centerLabel="comentarios"
                    segments={[
                      {
                        key: 'pos',
                        label: 'Positivo',
                        value: b.positive,
                        color: 'chart-pos',
                      },
                      {
                        key: 'neu',
                        label: 'Neutral o mixto',
                        value: b.neutral + b.mixed,
                        color: 'chart-neu',
                      },
                      {
                        key: 'neg',
                        label: 'Negativo',
                        value: b.negative,
                        color: 'chart-neg',
                      },
                    ]}
                  />
                </ChartCard>
              )}
              {topics.length > 0 && (
                <ChartCard
                  icon={Lightbulb}
                  tone="high"
                  title="Temas detectados"
                  table={{
                    caption: 'Temas de los comentarios',
                    columns: ['Tema', 'Comentarios'],
                    rows: topics,
                  }}
                >
                  <BarList
                    rows={topics.map(([label, value]) => ({ label, value }))}
                    total={b.total}
                    unit="comentarios"
                  />
                </ChartCard>
              )}
            </div>
          </div>
          <Panel
            aria-labelledby="comentarios-titulo"
            id="comentarios"
            className="scroll-mt-24"
          >
            <PanelHeader
              icon={MessagesSquare}
              title={`Comentarios asociados (${comments.length})`}
              titleId="comentarios-titulo"
              description={`${b.positive} positivos · ${b.negative} negativos`}
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
          </Panel>
        </div>
      </div>
    </ModuleSurface>
  );
}
