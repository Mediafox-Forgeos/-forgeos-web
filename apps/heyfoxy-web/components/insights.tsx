import type { DaySentiment } from '@/lib/insights';

/** Barras apiladas de sentimiento por día (compartido por Resumen y Reportes). */
export function SentimentDays({ days }: { days: DaySentiment[] }) {
  const max = Math.max(1, ...days.map((d) => d.pos + d.neg + d.other));
  return (
    <>
      <div
        className="mt-4 flex h-40 items-end gap-2"
        role="img"
        aria-label="Barras de sentimiento por día"
      >
        {days.map((d) => (
          <div
            key={d.d}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          >
            <div
              className="flex w-full max-w-10 flex-col-reverse overflow-hidden rounded"
              style={{ height: `${((d.pos + d.neg + d.other) / max) * 100}%` }}
            >
              <div
                className="bg-chart-pos"
                style={{ flex: d.pos }}
                title={`${d.pos} positivas`}
              />
              <div
                className="bg-chart-neu"
                style={{ flex: d.other }}
                title={`${d.other} neutrales/mixtas`}
              />
              <div
                className="bg-chart-neg"
                style={{ flex: d.neg }}
                title={`${d.neg} negativas`}
              />
            </div>
            <span className="text-muted-foreground text-[10px]">
              {d.d.slice(5)}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground mt-3 flex gap-4 text-xs">
        <span>
          <i className="bg-chart-pos mr-1 inline-block h-2 w-2 rounded-sm" />
          Positivo
        </span>
        <span>
          <i className="bg-chart-neu mr-1 inline-block h-2 w-2 rounded-sm" />
          Neutral/mixto
        </span>
        <span>
          <i className="bg-chart-neg mr-1 inline-block h-2 w-2 rounded-sm" />
          Negativo
        </span>
      </p>
    </>
  );
}

export function TopicList({ topics }: { topics: Array<[string, number]> }) {
  if (!topics.length)
    return <p className="text-muted-foreground mt-3 text-sm">Sin temas aún.</p>;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {topics.map(([t, n]) => (
        <li key={t} className="flex justify-between gap-2">
          <span className="truncate">{t}</span>
          <span className="text-muted-foreground tabular-nums">{n}</span>
        </li>
      ))}
    </ul>
  );
}
