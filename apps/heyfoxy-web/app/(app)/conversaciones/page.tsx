import {
  Card,
  CoverageNotice,
  EmptyState,
  PageHeader,
  SentimentBadge,
  SeverityBadge,
  SyntheticTag,
  Badge,
  buttonCls,
} from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';
import { INTENT_LABEL, PLATFORM_LABEL, fmtRelative } from '@/lib/format';
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
              <Card className="p-3">
                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground font-medium">
                    {PLATFORM_LABEL[i.platform]}
                  </span>
                  <span>·</span>
                  <span>{i.authorDisplay ?? 'autor no disponible'}</span>
                  <span>·</span>
                  <time dateTime={i.publishedAt}>
                    {fmtRelative(i.publishedAt)}
                  </time>
                  {i.isSynthetic && <SyntheticTag />}
                </div>
                <p className="mt-1.5 text-sm">{i.body}</p>
                {i.analysis ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <SentimentBadge s={i.analysis.sentiment} />
                    <SeverityBadge s={i.analysis.severity} />
                    <Badge>{INTENT_LABEL[i.analysis.intent]}</Badge>
                    <Badge
                      t={
                        i.analysis.layer === 'reputational' ? 'violet' : 'blue'
                      }
                    >
                      {i.analysis.layer === 'reputational'
                        ? 'Reputacional'
                        : 'Operativa'}
                    </Badge>
                    {i.analysis.topics.map((t) => (
                      <Badge key={t}>#{t}</Badge>
                    ))}
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      Prioridad {Math.round(i.analysis.priorityScore)} ·
                      confianza {Math.round(i.analysis.confidence * 100)}%
                    </span>
                  </div>
                ) : (
                  <p className="text-muted-foreground mt-2 text-xs">
                    Sin analizar (presupuesto o cola).
                  </p>
                )}
                {i.analysis && (
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    IA: {i.analysis.explanation}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
