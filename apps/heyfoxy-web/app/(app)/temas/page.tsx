import { Card, CoverageNotice, EmptyState, PageHeader } from '@/components/ui';
import { requireContext } from '@/lib/auth/session';
import { summarizeCoverage } from '@/lib/coverage';

export const metadata = { title: 'Temas' };

export default async function TopicsPage() {
  const { active, repo } = await requireContext();
  const [items, coverage] = await Promise.all([
    repo.items(active.organization.id, { limit: 1000 }),
    repo.coverage(active.organization.id),
  ]);
  const agg = new Map<
    string,
    { n: number; neg: number; maxPriority: number }
  >();
  for (const i of items) {
    for (const t of i.analysis?.topics ?? []) {
      const a = agg.get(t) ?? { n: 0, neg: 0, maxPriority: 0 };
      a.n++;
      if (i.analysis!.sentiment === 'negative') a.neg++;
      a.maxPriority = Math.max(a.maxPriority, i.analysis!.priorityScore);
      agg.set(t, a);
    }
  }
  const rows = [...agg.entries()].sort(
    (a, b) => b[1].maxPriority - a[1].maxPriority,
  );
  return (
    <>
      <PageHeader
        layer="reputational"
        title="Temas"
        description="Agrupación de conversaciones por tema detectado, con proporción negativa y prioridad máxima."
      />
      <CoverageNotice {...summarizeCoverage(coverage)} />
      {rows.length === 0 ? (
        <EmptyState title="Sin temas detectados" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-left text-xs">
              <tr>
                <th className="p-3">Tema</th>
                <th className="p-3 text-right">Menciones</th>
                <th className="p-3 text-right">% negativo</th>
                <th className="p-3 text-right">Prioridad máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(([t, a]) => (
                <tr key={t}>
                  <td className="p-3">{t}</td>
                  <td className="p-3 text-right tabular-nums">{a.n}</td>
                  <td className="p-3 text-right tabular-nums">
                    {Math.round((a.neg / a.n) * 100)}%
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {Math.round(a.maxPriority)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
