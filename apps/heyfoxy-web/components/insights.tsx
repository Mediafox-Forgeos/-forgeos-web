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
                className="bg-emerald-400/80"
                style={{ flex: d.pos }}
                title={`${d.pos} positivas`}
              />
              <div
                className="bg-slate-500/70"
                style={{ flex: d.other }}
                title={`${d.other} neutrales/mixtas`}
              />
              <div
                className="bg-red-400/80"
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
          <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-400/80" />
          Positivo
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-slate-500/70" />
          Neutral/mixto
        </span>
        <span>
          <i className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-400/80" />
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
