import Link from 'next/link';
import { z } from 'zod';
import {
  Badge,
  Card,
  CoverageNotice,
  EmptyState,
  PageHeader,
  SentimentBadge,
  SyntheticTag,
  buttonCls,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { PLATFORM_LABEL, fmtRelative } from '@/lib/format';
import { dominantSentiment, postStats } from '@/lib/insights';

const Filters = z.object({
  q: z.string().max(100).optional(),
  platform: z
    .enum([
      'facebook',
      'instagram',
      'linkedin',
      'youtube',
      'tiktok',
      'x',
      'web',
      'other',
    ])
    .optional(),
  orden: z.enum(['recientes', 'interacciones']).optional(),
});

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('es-CO');

/** Publicaciones V1 (tema «Clásico»), sin cambios respecto de Gate 2 (D-1). */
export async function LegacyPosts({
  params,
}: {
  params: Record<string, string>;
}) {
  const raw = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const parsed = Filters.safeParse(raw);
  const f = parsed.success ? parsed.data : {};
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [posts, items, coverage] = await Promise.all([
    repo.posts(orgId, { q: f.q, platform: f.platform }),
    repo.items(orgId, { limit: 1000 }),
    repo.coverage(orgId),
  ]);
  const rows = posts.map((p) => {
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
  const sel = 'rounded-md border bg-background px-2 py-1.5 text-sm';

  return (
    <>
      <PageHeader
        layer="reputational"
        title="Publicaciones monitoreadas"
        description="Publicaciones de las cuentas conectadas, con interacciones, comentarios clasificados y actividad inusual."
      />
      <CoverageNotice {...summarizeCoverage(coverage)} />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <label className="sr-only" htmlFor="q">
          Buscar
        </label>
        <input
          id="q"
          name="q"
          defaultValue={f.q}
          placeholder="Buscar en el texto"
          className={sel + ' min-w-48 flex-1'}
        />
        <select
          name="platform"
          defaultValue={f.platform ?? ''}
          className={sel}
          aria-label="Red"
        >
          <option value="">Todas las redes</option>
          {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          name="orden"
          defaultValue={f.orden ?? 'recientes'}
          className={sel}
          aria-label="Orden"
        >
          <option value="recientes">Más recientes</option>
          <option value="interacciones">Más interacciones</option>
        </select>
        <button className={buttonCls.ghost}>Filtrar</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Sin publicaciones para estos filtros">
          Las publicaciones aparecen cuando una fuente conectada las entrega.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {rows.map(({ p, s, comments, dominant }) => (
            <li key={p.id}>
              <Card className="p-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    {PLATFORM_LABEL[p.platform]}
                  </span>
                  {p.accountHandle && (
                    <>
                      <span>·</span>
                      <span>{p.accountHandle}</span>
                    </>
                  )}
                  {p.publishedAt && (
                    <>
                      <span>·</span>
                      <time dateTime={p.publishedAt}>
                        {fmtRelative(p.publishedAt)}
                      </time>
                    </>
                  )}
                  {p.isSynthetic && <SyntheticTag />}
                  {s.unusual && <Badge t="amber">Actividad inusual</Badge>}
                </div>
                <Link
                  href={`/publicaciones/${encodeURIComponent(p.id)}`}
                  className="mt-1.5 block text-sm font-medium hover:underline"
                >
                  {p.body ?? 'Publicación sin texto'}
                </Link>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums">
                  <span>Interacciones: {fmt(s.interactions)}</span>
                  <span>Alcance: {fmt(s.latest?.reach)}</span>
                  <span>Vistas: {fmt(s.latest?.views)}</span>
                  <span>Comentarios analizados: {comments.length}</span>
                  {dominant && <SentimentBadge s={dominant} />}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
