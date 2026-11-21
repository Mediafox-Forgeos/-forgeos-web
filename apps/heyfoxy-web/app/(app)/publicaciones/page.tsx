import {
  Heart,
  ImageOff,
  Images,
  LayoutGrid,
  Newspaper,
  Search,
  Users,
} from 'lucide-react';
import { z } from 'zod';
import {
  CoverageBannerV2,
  ModuleSurface,
  PageHeaderV2,
} from '@/components/ds/layout';
import { NetworkIcon } from '@/components/ds/network-icons';
import { SocialPostCard } from '@/components/ds/post';
import {
  ChipLink,
  IconBadge,
  StatusPill,
  btn,
} from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { PLATFORM_LABEL } from '@/lib/format';
import { inWindow, postTotals } from '@/lib/home-insights';
import { dominantSentiment, postStats } from '@/lib/insights';
import {
  PERIOD_PARAM,
  parsePeriod,
  periodDays,
  periodLabel,
  withPeriod,
} from '@/lib/period';
import { getUiTheme } from '@/lib/shell';
import type { Platform } from '@/lib/types';
import { isV2 } from '@/lib/ui-theme';
import { LegacyPosts } from './legacy-posts';

export const metadata = { title: 'Social Explorer' };

const PLATFORMS = [
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'x',
  'web',
  'other',
] as const;
const Filters = z.object({
  q: z.string().trim().max(100).optional(),
  platform: z.enum(PLATFORMS).optional(),
  orden: z.enum(['recientes', 'interacciones']).optional(),
});

/** Social Explorer (WO-HF-V2-06): galería de publicaciones monitoreadas. */
export default async function SocialExplorerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  if (!isV2(await getUiTheme())) return <LegacyPosts params={sp} />;

  const raw = Object.fromEntries(Object.entries(sp).filter(([, v]) => v));
  const parsed = Filters.safeParse(raw);
  const f = parsed.success ? parsed.data : {};
  const period = parsePeriod(sp[PERIOD_PARAM]);
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  // Todas las lecturas van acotadas a la organización activa (y RLS en Supabase).
  const [allPosts, filtered, items, coverage] = await Promise.all([
    repo.posts(orgId),
    repo.posts(orgId, { q: f.q, platform: f.platform }),
    repo.items(orgId, { limit: 1000 }),
    repo.coverage(orgId),
  ]);
  const days = periodDays(period);
  const inPeriod = inWindow(allPosts, days);
  const rows = inWindow(filtered, days).map((p) => {
    const comments = items.filter((i) => i.postId === p.id);
    return {
      p,
      s: postStats(p),
      comments,
      dominant: dominantSentiment(comments),
    };
  });
  if (f.orden === 'interacciones')
    rows.sort((a, b) => b.s.interactions - a.s.interactions);
  const networks = [...new Set(inPeriod.map((p) => p.platform))] as Platform[];
  const totals = postTotals(rows.map((r) => r.p));
  const withMedia = rows.filter((r) => (r.p.media?.length ?? 0) > 0).length;

  const href = (
    over: Partial<Record<'platform' | 'q' | 'orden', string | undefined>>,
  ) => {
    const p = new URLSearchParams();
    const merged = { q: f.q, platform: f.platform, orden: f.orden, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return withPeriod(`/publicaciones${qs ? `?${qs}` : ''}`, period);
  };

  return (
    <ModuleSurface module="explorer">
      <PageHeaderV2
        icon={Images}
        tone="info"
        eyebrow="Social Explorer"
        title="Publicaciones monitoreadas"
        description={`Publicaciones de las cuentas conectadas, con métricas, comentarios clasificados y actividad inusual · ${periodLabel(period).toLowerCase()}.`}
      />
      <CoverageBannerV2 {...summarizeCoverage(coverage)} />

      <h2 className="sr-only">Resumen de la selección</h2>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            icon: Newspaper,
            tone: 'info' as const,
            label: 'Publicaciones',
            value: rows.length.toLocaleString('es-CO'),
          },
          {
            icon: Heart,
            tone: 'high' as const,
            label: 'Interacciones',
            value: totals.interactions.toLocaleString('es-CO'),
          },
          {
            icon: Users,
            tone: 'ai' as const,
            label: 'Alcance',
            value:
              totals.reach === null
                ? '—'
                : totals.reach.toLocaleString('es-CO'),
          },
          {
            icon: ImageOff,
            tone: 'neutral' as const,
            label: 'Con fotos o videos',
            value: `${withMedia} de ${rows.length}`,
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-card border-border/80 bg-card shadow-card flex items-center gap-3 border p-3.5"
          >
            <IconBadge icon={k.icon} tone={k.tone} size="sm" />
            <dl className="min-w-0">
              <dt className="text-muted-foreground text-xs font-bold">
                {k.label}
              </dt>
              <dd className="text-xl font-black tabular-nums">{k.value}</dd>
            </dl>
          </div>
        ))}
      </div>

      <section
        aria-label="Filtros"
        className="rounded-card border-border/80 bg-card shadow-card mb-5 space-y-3 border p-3.5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ChipLink
            href={href({ platform: undefined })}
            active={!f.platform}
            icon={<LayoutGrid aria-hidden className="h-4 w-4" />}
          >
            Todas
          </ChipLink>
          {networks.map((p) => (
            <ChipLink
              key={p}
              href={href({ platform: p })}
              active={f.platform === p}
              icon={<NetworkIcon platform={p} />}
            >
              {PLATFORM_LABEL[p]}
            </ChipLink>
          ))}
        </div>
        <form role="search" className="flex flex-wrap items-center gap-2">
          {f.platform && (
            <input type="hidden" name="platform" value={f.platform} />
          )}
          {period !== '7d' && (
            <input type="hidden" name={PERIOD_PARAM} value={period} />
          )}
          <label htmlFor="q-posts" className="sr-only">
            Buscar en el texto de las publicaciones
          </label>
          <div className="relative min-w-48 flex-1">
            <Search
              aria-hidden
              className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <input
              id="q-posts"
              name="q"
              type="search"
              defaultValue={f.q}
              maxLength={100}
              placeholder="Buscar en el texto"
              className="border-border bg-card hover:border-control w-full rounded-xl border py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <label htmlFor="orden" className="sr-only">
            Orden
          </label>
          <select
            id="orden"
            name="orden"
            defaultValue={f.orden ?? 'recientes'}
            className="border-border bg-card hover:border-control rounded-xl border px-3 py-2 text-sm font-semibold"
          >
            <option value="recientes">Más recientes</option>
            <option value="interacciones">Más interacciones</option>
          </select>
          <button className={btn.secondary}>Aplicar</button>
        </form>
        {withMedia === 0 && rows.length > 0 && (
          <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
            <ImageOff aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Las fuentes conectadas aún no entregan fotos, videos ni carruseles:
            se muestra la red y el enlace al original. Las vistas previas
            aparecerán cuando una fuente autorizada las entregue.
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyStateV2 title="Sin publicaciones para estos filtros">
          Las publicaciones aparecen cuando una fuente conectada las entrega.
          Prueba con otro periodo o red.
        </EmptyStateV2>
      ) : (
        <>
          <p className="text-muted-foreground mb-3 text-sm" aria-live="polite">
            <StatusPill tone="info">{rows.length}</StatusPill>{' '}
            {rows.length === 1 ? 'publicación' : 'publicaciones'}
            {f.platform ? ` de ${PLATFORM_LABEL[f.platform]}` : ''}
            {f.q ? ` que contienen «${f.q}»` : ''}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {rows.map(({ p, s, comments, dominant }) => (
              <li key={p.id}>
                <SocialPostCard
                  post={p}
                  stats={s}
                  comments={comments.length}
                  dominant={dominant}
                  href={withPeriod(
                    `/publicaciones/${encodeURIComponent(p.id)}`,
                    period,
                  )}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </ModuleSurface>
  );
}
