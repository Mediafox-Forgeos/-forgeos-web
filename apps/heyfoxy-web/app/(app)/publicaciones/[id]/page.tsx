import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ItemCard } from '@/components/item-card';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  SyntheticTag,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { PLATFORM_LABEL, fmtDateTime } from '@/lib/format';
import { interactions, postStats, sentimentBreakdown } from '@/lib/insights';

export const metadata = { title: 'Detalle de publicación' };

const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n.toLocaleString('es-CO');

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  // La publicación se busca SIEMPRE dentro de la organización activa (y RLS en Supabase).
  const post = await repo.post(orgId, decodeURIComponent(id));
  if (!post) notFound();
  const comments = await repo.items(orgId, { postId: post.id });
  const s = postStats(post);
  const b = sentimentBreakdown(comments);

  return (
    <>
      <Link
        href="/publicaciones"
        className="text-primary-text text-sm hover:underline"
      >
        ← Publicaciones
      </Link>
      <PageHeader
        layer="reputational"
        title={post.body ?? 'Publicación sin texto'}
        description={`${PLATFORM_LABEL[post.platform]}${post.accountHandle ? ` · ${post.accountHandle}` : ''} · publicada ${fmtDateTime(post.publishedAt)}`}
        actions={
          <div className="flex items-center gap-2">
            {post.isSynthetic && <SyntheticTag />}
            {s.unusual && <Badge t="amber">Actividad inusual</Badge>}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Interacciones"
          value={fmt(s.interactions)}
          hint={
            s.growth === null
              ? 'Una sola medición'
              : `${s.growth >= 0 ? '+' : ''}${fmt(s.growth)} desde la medición anterior`
          }
        />
        <Stat
          label="Alcance"
          value={fmt(s.latest?.reach)}
          hint="Última medición"
        />
        <Stat
          label="Vistas"
          value={fmt(s.latest?.views)}
          hint="Última medición"
        />
        <Stat
          label="Comentarios clasificados"
          value={b.total}
          hint={`${b.negativePct} % negativos`}
        />
      </div>

      <Card className="mt-4">
        <h2 className="text-sm font-medium">Historial de métricas</h2>
        {post.metrics.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Sin mediciones todavía.
          </p>
        ) : (
          <div
            className="mt-3 overflow-x-auto"
            role="region"
            aria-label="Historial de métricas"
            tabIndex={0}
          >
            <table className="w-full text-left text-sm tabular-nums">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="py-1 pr-4 font-normal">Medición</th>
                  <th className="py-1 pr-4 font-normal">Me gusta</th>
                  <th className="py-1 pr-4 font-normal">Comentarios</th>
                  <th className="py-1 pr-4 font-normal">Compartidos</th>
                  <th className="py-1 pr-4 font-normal">Interacciones</th>
                  <th className="py-1 pr-4 font-normal">Alcance</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {post.metrics.map((m) => (
                  <tr key={m.capturedAt}>
                    <td className="py-1.5 pr-4">{fmtDateTime(m.capturedAt)}</td>
                    <td className="py-1.5 pr-4">{fmt(m.likes)}</td>
                    <td className="py-1.5 pr-4">{fmt(m.comments)}</td>
                    <td className="py-1.5 pr-4">{fmt(m.shares)}</td>
                    <td className="py-1.5 pr-4">{fmt(interactions(m))}</td>
                    <td className="py-1.5 pr-4">{fmt(m.reach)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <h2 className="mb-2 mt-6 text-sm font-medium">
        Comentarios asociados ({comments.length}) · {b.positive} positivos ·{' '}
        {b.negative} negativos
      </h2>
      {comments.length === 0 ? (
        <EmptyState title="Sin comentarios clasificados para esta publicación" />
      ) : (
        <ul className="space-y-2">
          {comments.map((i) => (
            <li key={i.id}>
              <ItemCard i={i} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
