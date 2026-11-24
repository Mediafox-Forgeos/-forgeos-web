import {
  postStats,
  sentimentBreakdown,
  type SentimentBreakdown,
} from '@/lib/insights';
import type { Alert, ConversationItem, Platform, Post } from '@/lib/types';

/**
 * Indicadores de Intelligence Home (WO-HF-V2-04). Funciones puras y aditivas: se apoyan
 * en lib/insights.ts sin modificarlo. Nada se estima ni se completa: si no hay base, se dice.
 */

const DAY = 86_400_000;

/** Elementos publicados en (now − (offset+days)·día, now − offset·día]. */
export function inWindow<T extends { publishedAt: string | null }>(
  rows: T[],
  days: number,
  now = Date.now(),
  offsetDays = 0,
): T[] {
  const to = now - offsetDays * DAY;
  const from = to - days * DAY;
  return rows.filter((r) => {
    if (!r.publishedAt) return false;
    const t = Date.parse(r.publishedAt);
    return t > from && t <= to;
  });
}

/** Motivo por el que no se muestra variación. */
export type NoCompareReason = 'no_base' | 'no_current';

export interface Comparable {
  value: number | null;
  comparable: boolean;
  reason?: NoCompareReason;
}

/**
 * Una variación solo es válida si el periodo actual tiene datos. Sin datos actuales se
 * informa «sin datos en el periodo» en lugar de un «−100 %» o de una diferencia sobre «—»
 * (defecto del Preview V2, captura 01). Sin base anterior: «sin base comparable».
 */
export function compareWhen(hasCurrent: boolean, c: Comparable): Comparable {
  if (!hasCurrent)
    return { value: null, comparable: false, reason: 'no_current' };
  return c.comparable ? c : { ...c, reason: 'no_base' };
}

/** Variación porcentual; sin base (anterior = 0) no hay porcentaje. Regla del DS. */
export function pctDelta(current: number, previous: number): Comparable {
  if (previous <= 0) return { value: null, comparable: false };
  return {
    value: Math.round(((current - previous) / previous) * 100),
    comparable: true,
  };
}

/** Diferencia en puntos; sin datos en el periodo anterior no es comparable. */
export function ptsDelta(
  current: number,
  previous: number,
  previousBase: number,
): Comparable {
  if (previousBase <= 0) return { value: null, comparable: false };
  return { value: current - previous, comparable: true };
}

/** Sentimiento neto: % positivas − % negativas (puntos). */
export function netSentiment(b: SentimentBreakdown): number {
  if (!b.total) return 0;
  return (
    Math.round((b.positive / b.total) * 100) -
    Math.round((b.negative / b.total) * 100)
  );
}

export const pctOf = (v: number, total: number) =>
  total > 0 ? Math.round((v / total) * 100) : 0;

/** Volumen de conversaciones por red, de mayor a menor. */
export function channelBreakdown(
  items: ConversationItem[],
): Array<{ platform: Platform; count: number }> {
  const m = new Map<Platform, number>();
  for (const i of items) m.set(i.platform, (m.get(i.platform) ?? 0) + 1);
  return [...m.entries()]
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);
}

export interface PostTotals {
  posts: number;
  interactions: number;
  /** null si ninguna publicación del periodo trae alcance (no se muestra 0 inventado). */
  reach: number | null;
}

/** Suma de la última medición de cada publicación. */
export function postTotals(posts: Post[]): PostTotals {
  let interactions = 0;
  let reach: number | null = null;
  for (const p of posts) {
    const s = postStats(p);
    interactions += s.interactions;
    if (s.latest?.reach != null) reach = (reach ?? 0) + s.latest.reach;
  }
  return { posts: posts.length, interactions, reach };
}

export type FindingKind =
  | 'negative_rise'
  | 'negative_topic'
  | 'critical_pending'
  | 'unusual_post'
  | 'positive_topic';

export interface FoxyFinding {
  id: string;
  kind: FindingKind;
  text: string;
  /** Base cuantitativa verificable. */
  basis: string;
  evidence: Array<{ label: string; href: string }>;
}

function topTopicOf(items: ConversationItem[]): [string, number] | null {
  const m = new Map<string, number>();
  for (const i of items)
    for (const t of i.analysis?.topics ?? []) m.set(t, (m.get(t) ?? 0) + 1);
  const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ?? null;
}

/**
 * Hallazgos de Foxy por reglas deterministas (sin IA generativa). Cada hallazgo cita
 * su base y enlaza a la evidencia. Si una regla no tiene base suficiente, no se emite.
 */
export function foxyFindings(input: {
  current: ConversationItem[];
  previous: ConversationItem[];
  posts: Post[];
  alerts: Alert[];
}): FoxyFinding[] {
  const out: FoxyFinding[] = [];
  const cur = sentimentBreakdown(input.current);
  const prev = sentimentBreakdown(input.previous);

  const critical = input.alerts.filter(
    (a) => a.severity === 'critical' && a.reviewStatus === 'pending',
  );
  if (critical.length)
    out.push({
      id: 'critical_pending',
      kind: 'critical_pending',
      text: `${critical.length === 1 ? 'Una alerta crítica espera' : `${critical.length} alertas críticas esperan`} revisión humana antes de escalar.`,
      basis: critical
        .map((a) => a.title)
        .slice(0, 2)
        .join(' · '),
      evidence: [{ label: 'Ir a revisión humana', href: '/revision' }],
    });

  if (
    prev.total > 0 &&
    cur.total > 0 &&
    cur.negativePct - prev.negativePct >= 5
  )
    out.push({
      id: 'negative_rise',
      kind: 'negative_rise',
      text: `Aumenta la proporción de conversaciones negativas: ${cur.negativePct} % frente a ${prev.negativePct} % del periodo anterior.`,
      basis: `${cur.negative} de ${cur.total} conversaciones analizadas son negativas.`,
      evidence: [
        { label: 'Ver negativas', href: '/conversaciones?sentiment=negative' },
      ],
    });

  const negatives = input.current.filter(
    (i) => i.analysis?.sentiment === 'negative',
  );
  const negTopic = topTopicOf(negatives);
  if (negTopic && negTopic[1] >= 2)
    out.push({
      id: 'negative_topic',
      kind: 'negative_topic',
      text: `Las quejas se concentran en «${negTopic[0]}».`,
      basis: `${negTopic[1]} de ${negatives.length} conversaciones negativas tratan este tema.`,
      evidence: [
        { label: 'Ver negativas', href: '/conversaciones?sentiment=negative' },
        { label: 'Ver temas', href: '/temas' },
      ],
    });

  for (const p of input.posts) {
    const s = postStats(p);
    if (s.unusual && s.growth !== null) {
      out.push({
        id: `unusual_post:${p.id}`,
        kind: 'unusual_post',
        text: `Actividad inusual en una publicación de ${p.accountHandle ?? 'la cuenta'}: las interacciones al menos se duplicaron.`,
        basis: `+${s.growth.toLocaleString('es-CO')} interacciones desde la medición anterior.`,
        evidence: [
          {
            label: 'Ver publicación',
            href: `/publicaciones/${encodeURIComponent(p.id)}`,
          },
        ],
      });
      break;
    }
  }

  const positives = input.current.filter(
    (i) => i.analysis?.sentiment === 'positive',
  );
  const posTopic = topTopicOf(positives);
  if (posTopic && posTopic[1] >= 2)
    out.push({
      id: 'positive_topic',
      kind: 'positive_topic',
      text: `Oportunidad: «${posTopic[0]}» concentra la conversación positiva.`,
      basis: `${posTopic[1]} de ${positives.length} conversaciones positivas.`,
      evidence: [
        { label: 'Ver positivas', href: '/conversaciones?sentiment=positive' },
      ],
    });

  return out.slice(0, 4);
}

export type FoxyActionKind =
  'review_pending' | 'explore_negative' | 'explore_unusual';

export interface FoxyAction {
  kind: FoxyActionKind;
  label: string;
  href: string;
}

/**
 * Acciones sugeridas por Foxy: solo se proponen si hay evidencia en los datos que las
 * respalde (nunca «explorar negativas» con cero negativas). Máximo tres.
 */
export function foxyActions(input: {
  pendingReview: number;
  negatives: number;
  unusualPostId?: string | null;
}): FoxyAction[] {
  const out: FoxyAction[] = [];
  if (input.pendingReview > 0)
    out.push({
      kind: 'review_pending',
      label: `Revisar ${input.pendingReview === 1 ? 'la alerta pendiente' : `las ${input.pendingReview} alertas pendientes`}`,
      href: '/revision',
    });
  if (input.negatives > 0)
    out.push({
      kind: 'explore_negative',
      label: `Explorar ${input.negatives === 1 ? 'la conversación negativa' : `las ${input.negatives} conversaciones negativas`}`,
      href: '/conversaciones?sentiment=negative',
    });
  if (input.unusualPostId)
    out.push({
      kind: 'explore_unusual',
      label: 'Abrir la publicación con actividad inusual',
      href: `/publicaciones/${encodeURIComponent(input.unusualPostId)}`,
    });
  return out.slice(0, 3);
}
