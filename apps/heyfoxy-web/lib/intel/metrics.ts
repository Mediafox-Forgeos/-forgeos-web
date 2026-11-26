import type { Platform, Post, PostMetrics } from '@/lib/types';
import { PLATFORM_LABEL } from '@/lib/format';

/**
 * Definiciones de métricas de rendimiento y su disponibilidad (addendum §4–§5).
 *
 * Reglas:
 *  - Nunca se inventa un valor: cada métrica tiene un estado (valor, cero real, no disponible,
 *    no aplica, pendiente de sincronización, desactivado por privacidad).
 *  - Alcance ≠ impresiones ≠ vistas. En Facebook no hay «alcance»: su equivalente con nombre
 *    propio son las impresiones únicas, y se muestran como tales.
 *  - Interacciones: la cifra que reporta la red y la suma de componentes que la red entrega por
 *    separado. Si difieren, se explica por qué (componentes que la red no desglosa).
 */

export type MetricKey =
  | 'reach'
  | 'engagement'
  | 'impressions'
  | 'interactions'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'views';

export type MetricState =
  'value' | 'zero' | 'unavailable' | 'not_applicable' | 'pending' | 'privacy';

export interface MetricReading {
  key: MetricKey;
  label: string;
  state: MetricState;
  value: number | null;
  /** Texto para mostrar: el valor formateado o el motivo de su ausencia. */
  display: string;
  /** Definición de la métrica tal como la usa Hey Foxy (tooltip). */
  definition: string;
  /** De dónde viene el dato. */
  source: string;
  /** Variación respecto a la medición anterior, si existe en ambas. */
  delta: number | null;
}

export const METRIC_STATE_LABEL: Record<MetricState, string> = {
  value: 'Disponible',
  zero: 'Cero real',
  unavailable: 'No disponible en la fuente',
  not_applicable: 'No aplica a este formato',
  pending: 'Pendiente de sincronización',
  privacy: 'Desactivado por privacidad',
};

const fmt = (n: number, pct = false) =>
  pct
    ? `${n.toLocaleString('es-CO', { maximumFractionDigits: 2 })} %`
    : n.toLocaleString('es-CO');

const isVideo = (post: Post) =>
  post.contentType === 'video' ||
  post.contentType === 'reel' ||
  (post.media ?? []).some((m) => m.kind === 'video');

function raw(
  m: PostMetrics | undefined,
  key: MetricKey,
  platform: Platform,
): number | null | undefined {
  if (!m) return undefined;
  switch (key) {
    case 'reach':
      // Facebook no entrega alcance: su equivalente son las impresiones únicas.
      return platform === 'facebook' && m.reach == null
        ? m.impressionsUnique
        : m.reach;
    case 'engagement':
      return m.engagement;
    case 'impressions':
      return m.impressions;
    case 'interactions':
      return m.interactions;
    case 'views':
      return m.views;
    default:
      return m[key];
  }
}

export function metricLabel(key: MetricKey, platform: Platform): string {
  if (key === 'reach' && platform === 'facebook') return 'Impresiones únicas';
  return {
    reach: 'Alcance',
    engagement: 'Engagement',
    impressions: 'Impresiones',
    interactions: `Interacciones según ${PLATFORM_LABEL[platform]}`,
    likes: 'Me gusta',
    comments: 'Comentarios en la red',
    shares: 'Compartidos',
    saves: 'Guardados',
    views: 'Vistas',
  }[key];
}

export function metricDefinition(key: MetricKey, platform: Platform): string {
  const net = PLATFORM_LABEL[platform];
  return {
    reach:
      platform === 'facebook'
        ? 'Facebook no entrega «alcance»: son las impresiones únicas (personas distintas que vieron la publicación), con el nombre que usa la red.'
        : `Cuentas únicas de ${net} que vieron la publicación al menos una vez. No es la suma de vistas.`,
    engagement:
      'Porcentaje de interacción calculado por Metricool sobre el alcance de la publicación.',
    impressions: `Veces que se mostró la publicación en ${net}, incluidas repeticiones de una misma cuenta.`,
    interactions: `Total de interacciones que reporta ${net} (puede incluir acciones que la red no desglosa).`,
    likes: `Me gusta o reacciones de «me gusta» reportados por ${net}.`,
    comments: `Comentarios que reporta ${net}. No son los comentarios importados ni clasificados por Hey Foxy.`,
    shares: `Veces que la publicación se compartió en ${net}.`,
    saves: `Veces que una cuenta guardó la publicación en ${net}.`,
    views: `Reproducciones o visualizaciones según ${net}.`,
  }[key];
}

/** Lectura de una métrica con su estado; `history` de la más reciente a la más antigua. */
export function readMetric(post: Post, key: MetricKey): MetricReading {
  const [cur, prev] = post.metrics;
  const v = raw(cur, key, post.platform);
  const p = raw(prev, key, post.platform);
  const label = metricLabel(key, post.platform);
  const definition = metricDefinition(key, post.platform);
  const source = post.isSynthetic
    ? 'Dato sintético de prueba'
    : `Metricool · ${PLATFORM_LABEL[post.platform]}`;
  let state: MetricState;
  if (!cur) state = 'pending';
  else if (
    (key === 'views' && post.platform === 'facebook' && !isVideo(post)) ||
    (key === 'saves' && post.platform === 'facebook')
  )
    state = 'not_applicable';
  else if (v == null) state = 'unavailable';
  else if (v === 0) state = 'zero';
  else state = 'value';
  const value = state === 'value' || state === 'zero' ? (v as number) : null;
  return {
    key,
    label,
    state,
    value,
    display:
      value != null
        ? fmt(value, key === 'engagement')
        : METRIC_STATE_LABEL[state],
    definition,
    source,
    delta: value != null && typeof p === 'number' ? value - p : null,
  };
}

export interface InteractionPart {
  key: 'likes' | 'comments' | 'shares' | 'saves' | 'reactions';
  label: string;
  value: number;
  /** Variable CSS del color semántico. */
  color: string;
}

export interface InteractionBreakdownData {
  parts: InteractionPart[];
  /** Suma de los componentes que la red entrega por separado. */
  componentsTotal: number;
  /** Interacciones que la red reporta como total (puede no coincidir). */
  networkTotal: number | null;
  /** Explicación de la diferencia, o null si coinciden o no hay total de la red. */
  difference: string | null;
  /** Componentes que la red no entrega para este formato. */
  unavailable: string[];
}

/**
 * Distribución de interacciones de la última medición. Solo componentes compatibles que la
 * red entrega por separado; las reacciones de Facebook se muestran por tipo y no se suman a
 * «me gusta» si la red ya las incluye ahí.
 */
export function interactionBreakdown(post: Post): InteractionBreakdownData {
  const m = post.metrics[0];
  const parts: InteractionPart[] = [];
  const unavailable: string[] = [];
  const add = (
    key: InteractionPart['key'],
    label: string,
    v: number | null | undefined,
    color: string,
  ) => {
    if (v == null) unavailable.push(label);
    else parts.push({ key, label, value: v, color });
  };
  add(
    'likes',
    post.platform === 'facebook' ? 'Reacciones' : 'Me gusta',
    m?.likes,
    'ix-likes',
  );
  add('comments', 'Comentarios en la red', m?.comments, 'ix-comments');
  add('shares', 'Compartidos', m?.shares, 'ix-shares');
  if (post.platform !== 'facebook')
    add('saves', 'Guardados', m?.saves, 'ix-saves');
  const componentsTotal = parts.reduce((a, p) => a + p.value, 0);
  const networkTotal = m?.interactions ?? null;
  let difference: string | null = null;
  if (networkTotal != null && networkTotal !== componentsTotal)
    difference =
      networkTotal > componentsTotal
        ? `${PLATFORM_LABEL[post.platform]} reporta ${fmt(networkTotal)} interacciones; los componentes que entrega por separado suman ${fmt(componentsTotal)}. La diferencia (${fmt(networkTotal - componentsTotal)}) corresponde a acciones que la red no desglosa.`
        : `${PLATFORM_LABEL[post.platform]} reporta ${fmt(networkTotal)} interacciones y los componentes suman ${fmt(componentsTotal)}: la red cuenta algunas acciones de forma distinta. Se muestran ambas cifras con su nombre.`;
  return { parts, componentsTotal, networkTotal, difference, unavailable };
}

/** Reacciones por tipo de Facebook (like, love, haha…) si la red las entrega. */
export function reactionsByType(
  post: Post,
): Array<{ type: string; value: number }> {
  const r = post.metrics[0]?.reactions ?? null;
  if (!r) return [];
  const LABEL: Record<string, string> = {
    like: 'Me gusta',
    love: 'Me encanta',
    wow: 'Me asombra',
    haha: 'Me divierte',
    sorry: 'Me entristece',
    anger: 'Me enoja',
  };
  return Object.entries(r)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ type: LABEL[k] ?? k, value: v }));
}

/** Serie temporal de una métrica: solo mediciones reales (sin interpolar). */
export function metricSeries(
  post: Post,
  key: MetricKey | 'components',
): Array<{ at: string; value: number }> {
  return [...post.metrics]
    .reverse()
    .map((m) => {
      if (key === 'components') {
        const parts = [
          m.likes,
          m.comments,
          m.shares,
          post.platform === 'facebook' ? null : m.saves,
        ];
        const known = parts.filter((x): x is number => x != null);
        return {
          at: m.capturedAt,
          value: known.length ? known.reduce((a, b) => a + b, 0) : null,
        };
      }
      const v = raw(m, key, post.platform);
      return { at: m.capturedAt, value: v ?? null };
    })
    .filter((p): p is { at: string; value: number } => p.value != null);
}
