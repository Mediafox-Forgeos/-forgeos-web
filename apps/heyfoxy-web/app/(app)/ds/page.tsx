import { BrandContextCard, FutureActions } from '@/components/ds/intel';
import { FindingCard } from '@/components/ds/intel-findings';
import {
  InteractionBreakdown,
  MetricAvailabilityState,
  PerformanceMetricCard,
} from '@/components/ds/performance';
import { interactionBreakdown, readMetric } from '@/lib/intel/metrics';
import { FINDING_KIND_LABEL } from '@/lib/intel/schema';
import {
  BellRing,
  Heart,
  Images,
  LayoutGrid,
  MessagesSquare,
  Palette,
  ShieldAlert,
  Smile,
  Sparkles,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import { BarList, ChannelShare, ChartCard } from '@/components/ds/charts';
import { AreaTrend, Donut } from '@/components/ds/charts-client';
import { ConversationRow } from '@/components/ds/conversation';
import { FoxyMark } from '@/components/ds/foxy';
import { KpiCard, PageHeaderV2 } from '@/components/ds/layout';
import { NetworkIcon } from '@/components/ds/network-icons';
import { AuthorChip, PostMedia, PostMetricsRow } from '@/components/ds/post';
import {
  Avatar,
  ChipLink,
  Delta,
  Panel,
  PanelHeader,
  StatusPill,
  SyntheticBadge,
  btn,
} from '@/components/ds/primitives';
import {
  ComingSoonState,
  EmptyStateV2,
  ErrorState,
  LoadingState,
  NotAvailableState,
  PermissionState,
} from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { dataMode } from '@/lib/env';
import { postStats, sentimentBreakdown, topTopics } from '@/lib/insights';
import type { Platform, Post } from '@/lib/types';

export const metadata = { title: 'Catálogo del Design System' };

/** Muestra técnica para los componentes de medios. NO es contenido: se rotula como tal. */
const sample = (n: number, hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="hsl(${hue} 70% 88%)"/><text x="200" y="150" text-anchor="middle" font-family="sans-serif" font-size="22" fill="hsl(${hue} 50% 25%)">Muestra técnica ${n}</text><text x="200" y="182" text-anchor="middle" font-family="sans-serif" font-size="14" fill="hsl(${hue} 50% 25%)">no es una publicación</text></svg>`,
  )}`;

const SWATCHES = [
  'brand',
  'accent-2',
  'primary-pale',
  'success-bg',
  'info-bg',
  'warning-bg',
  'critical-bg',
  'high-bg',
  'background',
  'card',
  'muted',
  'border',
  'control',
  'foreground',
];

/** Catálogo interno de componentes V2. Solo en modo demo; nunca en Supabase ni Production. */
export default async function DesignSystemCatalog() {
  if (dataMode() !== 'demo' || process.env.VERCEL_ENV === 'production')
    notFound();
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, posts] = await Promise.all([
    repo.items(orgId, { limit: 1000 }),
    repo.posts(orgId),
  ]);
  const sent = sentimentBreakdown(items);
  const post = posts[0];
  const mediaPost = (kind: 'carousel' | 'video'): Post | null =>
    post
      ? {
          ...post,
          media:
            kind === 'carousel'
              ? [1, 2, 3].map((n) => ({
                  kind: 'image' as const,
                  url: sample(n, 250 + n * 30),
                  alt: `Muestra técnica ${n} del componente de carrusel`,
                }))
              : [
                  {
                    kind: 'video' as const,
                    url: 'about:blank',
                    previewUrl: sample(4, 200),
                    alt: 'Muestra técnica del componente de video',
                    durationSec: 42,
                  },
                ],
        }
      : null;
  const platforms: Platform[] = [
    'instagram',
    'facebook',
    'x',
    'tiktok',
    'youtube',
    'linkedin',
    'web',
  ];

  return (
    <>
      <PageHeaderV2
        icon={Palette}
        eyebrow="Design System V2 · v0.2"
        title="Catálogo de componentes"
        description="Componentes en sus variantes, con datos de la organización demo activa. Solo visible en modo demo."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader
            icon={Sparkles}
            title="Foxy"
            description="SVG original, colores de tokens."
          />
          <div className="flex flex-wrap items-end gap-6">
            <FoxyMark size={24} label="Foxy, marca" />
            <FoxyMark size={40} />
            <FoxyMark variant="avatar" size={48} label="Foxy, avatar" />
            <FoxyMark
              variant="illustration"
              size={96}
              label="Foxy, ilustración"
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={Palette} title="Tokens del tema activo" />
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {SWATCHES.map((t) => (
              <li key={t} className="text-center">
                <span
                  className="border-border block h-10 rounded-lg border"
                  style={{ background: `hsl(var(--${t}))` }}
                />
                <span className="text-muted-foreground mt-1 block text-[10px] font-semibold">
                  {t}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader icon={LayoutGrid} title="Controles y estados" />
          <div className="flex flex-wrap gap-2">
            <button className={btn.primary}>Botón primario</button>
            <button className={btn.secondary}>Secundario</button>
            <button className={btn.ghost}>Fantasma</button>
            <button className={btn.danger}>Peligro</button>
            <button className={btn.primary} disabled>
              Deshabilitado
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <StatusPill tone="success">Positivo</StatusPill>
            <StatusPill tone="critical">Crítica</StatusPill>
            <StatusPill tone="warning">Atención</StatusPill>
            <StatusPill tone="high">Alta</StatusPill>
            <StatusPill tone="info">Seguimiento</StatusPill>
            <StatusPill tone="ai">Foxy IA</StatusPill>
            <SyntheticBadge />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Delta value={28} comparable />
            <Delta value={-12} comparable />
            <Delta value={6} unit=" pts" comparable goodWhen="down" />
            <Delta value={null} comparable={false} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ChipLink
              href="/ds"
              active
              icon={<LayoutGrid aria-hidden className="h-4 w-4" />}
            >
              Todas
            </ChipLink>
            {platforms.slice(0, 3).map((p) => (
              <ChipLink key={p} href="/ds" icon={<NetworkIcon platform={p} />}>
                {p}
              </ChipLink>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {['Laura Ríos', 'Andrés Demo', '@clinica.aurora'].map((n) => (
              <Avatar key={n} name={n} />
            ))}
            {platforms.map((p) => (
              <NetworkIcon key={p} platform={p} size={22} title={p} />
            ))}
          </div>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            icon={MessagesSquare}
            tone="ai"
            label="Conversaciones"
            value={sent.total.toLocaleString('es-CO')}
            period="Últimos 7 días"
            delta={{ value: 12, comparable: true }}
          />
          <KpiCard
            icon={Heart}
            tone="high"
            label="Sin periodo previo"
            value="—"
            period="Ejemplo de comparabilidad"
            delta={{ value: null, comparable: false }}
          />
        </div>

        <ChartCard
          icon={MessagesSquare}
          title="AreaTrend"
          description="Puntos enfocables con tooltip y tabla alternativa."
          table={{
            caption: 'Ejemplo',
            columns: ['Día', 'Valor'],
            rows: [
              ['1', 2],
              ['2', 5],
              ['3', 3],
              ['4', 8],
            ],
          }}
        >
          <AreaTrend
            unit="conversaciones"
            highlight="Último día"
            points={[2, 5, 3, 8].map((v, i) => ({
              label: `Día ${i + 1}`,
              value: v,
            }))}
          />
        </ChartCard>

        <ChartCard
          icon={Smile}
          tone="success"
          title="Donut"
          table={{
            caption: 'Sentimiento',
            columns: ['Sentimiento', 'Conversaciones'],
            rows: [
              ['Positivo', sent.positive],
              ['Neutral o mixto', sent.neutral + sent.mixed],
              ['Negativo', sent.negative],
            ],
          }}
        >
          <Donut
            centerValue={sent.total.toLocaleString('es-CO')}
            centerLabel="analizadas"
            segments={[
              {
                key: 'pos',
                label: 'Positivo',
                value: sent.positive,
                color: 'chart-pos',
              },
              {
                key: 'neu',
                label: 'Neutral o mixto',
                value: sent.neutral + sent.mixed,
                color: 'chart-neu',
              },
              {
                key: 'neg',
                label: 'Negativo',
                value: sent.negative,
                color: 'chart-neg',
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          icon={BellRing}
          title="BarList y ChannelShare"
          table={{
            caption: 'Temas',
            columns: ['Tema', 'Conversaciones'],
            rows: topTopics(items),
          }}
        >
          <BarList
            rows={topTopics(items, 4).map(([label, value]) => ({
              label,
              value,
            }))}
          />
          <div className="mt-5">
            <ChannelShare
              rows={(['instagram', 'facebook', 'x'] as Platform[]).map((p) => ({
                platform: p,
                label: p,
                value: items.filter((i) => i.platform === p).length,
                href: `/conversaciones?platform=${p}`,
              }))}
            />
          </div>
        </ChartCard>

        <Panel>
          <PanelHeader icon={ShieldAlert} title="Estados" />
          <div className="grid gap-3 sm:grid-cols-2">
            <EmptyStateV2 compact />
            <LoadingState compact />
            <ErrorState compact>Reintenta en unos minutos.</ErrorState>
            <PermissionState compact />
            <NotAvailableState compact>
              Requiere una fuente autorizada.
            </NotAvailableState>
            <ComingSoonState compact>
              Benchmark frente a competidores.
            </ComingSoonState>
          </div>
        </Panel>
      </div>

      {post && (
        <Panel className="mt-5">
          <PanelHeader
            icon={Images}
            tone="info"
            title="Publicaciones: medios, autor y métricas"
            description="La primera tarjeta usa la publicación demo real (sin medios: fallback). Las otras dos son muestras técnicas rotuladas del componente; no son publicaciones."
          />
          <div className="grid gap-4 md:grid-cols-3">
            {[post, mediaPost('carousel'), mediaPost('video')].map((p, k) =>
              p ? (
                <div
                  key={k}
                  className="rounded-card border-border overflow-hidden border"
                >
                  <PostMedia post={p} />
                  <div className="space-y-2 p-3">
                    <AuthorChip post={p} />
                    <PostMetricsRow stats={postStats(p)} />
                    {k > 0 && (
                      <StatusPill tone="warning">
                        Muestra técnica del componente
                      </StatusPill>
                    )}
                  </div>
                </div>
              ) : null,
            )}
          </div>
          <div className="divide-border mt-4 divide-y">
            {items.slice(0, 2).map((i) => (
              <ConversationRow key={i.id} i={i} />
            ))}
          </div>
        </Panel>
      )}
      {post && (
        <Panel className="mt-4" aria-labelledby="ds-intel">
          <PanelHeader
            icon={Sparkles}
            title="Inteligencia de contenido (WO-HF-V2-INTELLIGENCE-001)"
            titleId="ds-intel"
            description="PerformanceMetricCard · MetricAvailabilityState · InteractionBreakdown · PerformanceTimeline · FindingCard (Strategic/Creative) · EvidenceReference · BrandContextCard · AccountIdentity · MediaViewer · RecommendationAction. Muestra técnica con datos sintéticos."
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PerformanceMetricCard
              reading={readMetric(post, 'reach')}
              tone="reach"
            />
            <PerformanceMetricCard
              reading={readMetric(post, 'engagement')}
              tone="engagement"
            />
            <PerformanceMetricCard
              reading={readMetric(post, 'impressions')}
              tone="impressions"
            />
            <PerformanceMetricCard
              reading={readMetric(post, 'interactions')}
              tone="interactions"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                'value',
                'zero',
                'unavailable',
                'not_applicable',
                'pending',
                'privacy',
              ] as const
            ).map((st) => (
              <MetricAvailabilityState key={st} state={st} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <InteractionBreakdown
              data={interactionBreakdown(post)}
              networkLabel="la red"
            />
            <div className="space-y-2">
              {(
                [
                  'fact',
                  'interpretation',
                  'hypothesis',
                  'recommendation',
                ] as const
              ).map((k) => (
                <FindingCard
                  key={k}
                  compact
                  f={{
                    kind: k,
                    title: `Ejemplo de ${FINDING_KIND_LABEL[k].toLowerCase()}`,
                    detail: 'Texto de muestra del componente (sintético).',
                    evidence: [
                      {
                        type: 'metric',
                        label: 'Engagement',
                        postId: null,
                        value: '5 %',
                      },
                    ],
                    confidence: k === 'fact' ? null : 'media',
                    limitation:
                      k === 'hypothesis' ? 'Requiere validación.' : null,
                  }}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <BrandContextCard
              stored={null}
              href="/brand-brain"
              availability="ready"
            />
            <FutureActions />
          </div>
        </Panel>
      )}
    </>
  );
}
