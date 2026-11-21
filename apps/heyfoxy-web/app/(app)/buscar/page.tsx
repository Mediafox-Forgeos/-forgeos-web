import { Images, MessagesSquare, Search } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';
import { ConversationRow } from '@/components/ds/conversation';
import { PageHeaderV2 } from '@/components/ds/layout';
import { AuthorChip } from '@/components/ds/post';
import { Panel, PanelHeader, btn } from '@/components/ds/primitives';
import { EmptyStateV2 } from '@/components/ds/states';
import { requireContext } from '@/lib/auth/session';

export const metadata = { title: 'Buscar' };

const Q = z.string().trim().max(100);

/** Buscador global (WO-HF-V2-03): conversaciones y publicaciones de la organización activa. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const parsed = Q.safeParse((await searchParams).q ?? '');
  const q = parsed.success ? parsed.data : '';
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const [items, posts] = q
    ? await Promise.all([
        repo.items(orgId, { q, limit: 50 }),
        repo.posts(orgId, { q, limit: 24 }),
      ])
    : [[], []];

  return (
    <>
      <PageHeaderV2
        icon={Search}
        eyebrow="Búsqueda"
        title={q ? `Resultados para «${q}»` : 'Buscar'}
        description="Conversaciones y publicaciones de la organización activa."
      />
      <form role="search" className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="q-page" className="sr-only">
          Texto a buscar
        </label>
        <input
          id="q-page"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={100}
          placeholder="Ej.: citas, app, urgencias"
          className="border-border bg-card hover:border-control w-full rounded-xl border px-3 py-2 text-sm"
        />
        <button className={btn.primary}>Buscar</button>
      </form>
      {!q ? (
        <EmptyStateV2 title="Escribe un texto para buscar" />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Panel>
            <PanelHeader
              icon={MessagesSquare}
              title={`Conversaciones (${items.length})`}
            />
            {items.length === 0 ? (
              <EmptyStateV2 compact title="Sin conversaciones que coincidan" />
            ) : (
              <div className="divide-border divide-y">
                {items.map((i) => (
                  <ConversationRow key={i.id} i={i} />
                ))}
              </div>
            )}
          </Panel>
          <Panel>
            <PanelHeader
              icon={Images}
              tone="info"
              title={`Publicaciones (${posts.length})`}
            />
            {posts.length === 0 ? (
              <EmptyStateV2 compact title="Sin publicaciones que coincidan" />
            ) : (
              <ul className="divide-border divide-y">
                {posts.map((p) => (
                  <li key={p.id} className="py-3">
                    <AuthorChip post={p} size={30} />
                    <Link
                      href={`/publicaciones/${encodeURIComponent(p.id)}`}
                      className="mt-1.5 line-clamp-2 block text-sm font-semibold hover:underline"
                    >
                      {p.body ?? 'Publicación sin texto'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
