import {
  CoverageNotice,
  EmptyState,
  PageHeader,
  buttonCls,
} from '@/components/ui';
import { ItemCard } from '@/components/item-card';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { PLATFORM_LABEL } from '@/lib/format';
import type { ItemFilters } from '@/lib/data/repository';
import { z } from 'zod';

export const metadata = { title: 'Conversaciones' };

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
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
  severity: z.enum(['info', 'attention', 'high', 'critical']).optional(),
  layer: z.enum(['operational', 'reputational']).optional(),
});

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const raw = Object.fromEntries(
    Object.entries(await searchParams).filter(([, v]) => v),
  );
  const parsed = Filters.safeParse(raw);
  const f: ItemFilters = parsed.success ? parsed.data : {};
  const { active, repo } = await requireContext();
  const [items, coverage] = await Promise.all([
    repo.items(active.organization.id, f),
    repo.coverage(active.organization.id),
  ]);
  const sel = 'rounded-md border bg-background px-2 py-1.5 text-sm';

  return (
    <>
      <PageHeader
        layer="operational"
        title="Conversaciones"
        description="Comentarios clasificados por IA. Filtra para priorizar la atención; los filtros se comparten por enlace."
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
          placeholder="Buscar texto o tema"
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
          name="sentiment"
          defaultValue={f.sentiment ?? ''}
          className={sel}
          aria-label="Sentimiento"
        >
          <option value="">Todo sentimiento</option>
          <option value="negative">Negativo</option>
          <option value="positive">Positivo</option>
          <option value="neutral">Neutral</option>
          <option value="mixed">Mixto</option>
        </select>
        <select
          name="severity"
          defaultValue={f.severity ?? ''}
          className={sel}
          aria-label="Gravedad"
        >
          <option value="">Toda gravedad</option>
          <option value="critical">Crítica</option>
          <option value="high">Alta</option>
          <option value="attention">Atención</option>
          <option value="info">Informativa</option>
        </select>
        <select
          name="layer"
          defaultValue={f.layer ?? ''}
          className={sel}
          aria-label="Capa"
        >
          <option value="">Ambas capas</option>
          <option value="operational">Operativa</option>
          <option value="reputational">Reputacional</option>
        </select>
        <button className={buttonCls.ghost}>Filtrar</button>
      </form>
      {items.length === 0 ? (
        <EmptyState title="Sin conversaciones para estos filtros" />
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li key={i.id}>
              <ItemCard i={i} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
