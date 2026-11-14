import type { ConversationItem, Post, PostMetrics } from '@/lib/types';

/**
 * Indicadores derivados de conversaciones y publicaciones. Funciones puras,
 * compartidas por Resumen, Reportes y Publicaciones (una sola fuente de cálculo).
 */

const DAY = 86_400_000;

export interface SentimentBreakdown {
  total: number;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
  /** % de negativas sobre las analizadas (0 si no hay datos). */
  negativePct: number;
}

export function analyzed(items: ConversationItem[]) {
  return items.filter((i) => i.analysis);
}

export function sentimentBreakdown(
  items: ConversationItem[],
): SentimentBreakdown {
  const a = analyzed(items);
  const count = (s: string) =>
    a.filter((i) => i.analysis!.sentiment === s).length;
  const negative = count('negative');
  return {
    total: a.length,
    positive: count('positive'),
    negative,
    neutral: count('neutral'),
    mixed: count('mixed'),
    negativePct: a.length ? Math.round((negative / a.length) * 100) : 0,
  };
}

export interface DaySentiment {
  d: string;
  pos: number;
  neg: number;
  other: number;
}

/** Sentimiento por día (UTC) de los últimos `days` días, del más antiguo al más reciente. */
export function dailySentiment(
  items: ConversationItem[],
  days = 7,
  now = Date.now(),
): DaySentiment[] {
  const a = analyzed(items);
  return [...Array(days)].map((_, k) => {
    const d = new Date(now - (days - 1 - k) * DAY).toISOString().slice(0, 10);
    const day = a.filter((i) => i.publishedAt.slice(0, 10) === d);
    return {
      d,
      pos: day.filter((i) => i.analysis!.sentiment === 'positive').length,
      neg: day.filter((i) => i.analysis!.sentiment === 'negative').length,
      other: day.filter(
        (i) => !['positive', 'negative'].includes(i.analysis!.sentiment),
      ).length,
    };
  });
}

/** Temas más frecuentes, ordenados por volumen. */
export function topTopics(
  items: ConversationItem[],
  n = 6,
): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const i of analyzed(items))
    for (const t of i.analysis!.topics) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export interface PeriodTrend {
  current: SentimentBreakdown;
  previous: SentimentBreakdown;
  /** Diferencia de % negativo (actual − anterior), en puntos. */
  negativeDelta: number;
  /** Variación de volumen analizado (actual − anterior). */
  volumeDelta: number;
}

/** Compara los últimos `days` días con los `days` anteriores. */
export function periodTrend(
  items: ConversationItem[],
  days = 7,
  now = Date.now(),
): PeriodTrend {
  const inRange = (from: number, to: number) =>
    items.filter((i) => {
      const t = Date.parse(i.publishedAt);
      return t > from && t <= to;
    });
  const current = sentimentBreakdown(inRange(now - days * DAY, now));
  const previous = sentimentBreakdown(
    inRange(now - 2 * days * DAY, now - days * DAY),
  );
  return {
    current,
    previous,
    negativeDelta: current.negativePct - previous.negativePct,
    volumeDelta: current.total - previous.total,
  };
}

export function interactions(m: PostMetrics | undefined | null): number {
  if (!m) return 0;
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0);
}

export interface PostStats {
  latest: PostMetrics | null;
  interactions: number;
  /** Crecimiento de interacciones respecto de la medición anterior (null si no hay dos). */
  growth: number | null;
  /** Interacciones crecieron ≥ 2× entre las dos últimas mediciones. */
  unusual: boolean;
}

export function postStats(post: Post): PostStats {
  const [latest, prev] = post.metrics;
  const now = interactions(latest);
  const before = prev ? interactions(prev) : null;
  const growth = before !== null ? now - before : null;
  return {
    latest: latest ?? null,
    interactions: now,
    growth,
    unusual: before !== null && before > 0 && now >= before * 2,
  };
}

/** Sentimiento dominante de los comentarios de una publicación. */
export function dominantSentiment(
  items: ConversationItem[],
): 'positive' | 'negative' | 'neutral' | null {
  const b = sentimentBreakdown(items);
  if (!b.total) return null;
  if (b.negative > b.positive && b.negative >= b.neutral + b.mixed)
    return 'negative';
  if (b.positive > b.negative && b.positive >= b.neutral + b.mixed)
    return 'positive';
  return 'neutral';
}
