import type { BrandContext } from '@/lib/brain/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { interactions } from '@/lib/insights';
import type { Platform, Post } from '@/lib/types';
import type { Evidence } from './schema';

/*
 * Utilidades compartidas del motor local de Foxy (publicación y marca). Sin red, sin IA.
 */

export const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

export const pct = (n: number) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
export const num = (n: number) => Math.round(n).toLocaleString('es-CO');

const FORMAT_LABEL: Record<string, string> = {
  reel: 'Reel (video corto)',
  video: 'Video',
  carousel: 'Carrusel',
  image: 'Imagen',
  text: 'Texto',
  link: 'Enlace',
  story: 'Historia',
};

export function formatOf(post: Post): string {
  return (
    FORMAT_LABEL[post.contentType ?? ''] ??
    ((post.media ?? []).some((m) => m.kind === 'video') ? 'Video' : 'Imagen')
  );
}

export const formatGroup = (post: Post) =>
  ['reel', 'video'].includes(post.contentType ?? '') ||
  (post.media ?? []).some((m) => m.kind === 'video')
    ? 'video'
    : 'static';

/** Engagement comparable: el de la fuente; si no hay, interacciones / alcance. */
export function engagementOf(p: Post): number | null {
  const m = p.metrics[0];
  if (!m) return null;
  if (m.engagement != null) return m.engagement;
  const reach = m.reach ?? m.impressionsUnique ?? null;
  return reach ? (interactions(m) / reach) * 100 : null;
}

/** Alcance (Instagram) o impresiones únicas (Facebook): solo comparable dentro de la red. */
export const reachOf = (p: Post) =>
  p.metrics[0]?.reach ?? p.metrics[0]?.impressionsUnique ?? null;

export const savesOf = (p: Post) =>
  p.platform === 'facebook' ? null : (p.metrics[0]?.saves ?? null);

/**
 * Cómo calcula cada red (vía Metricool) el engagement. Las definiciones no coinciden entre
 * redes: por eso Foxy nunca ordena publicaciones de redes distintas por engagement.
 */
export const ENGAGEMENT_BASIS: Partial<Record<Platform, string>> = {
  instagram: 'interacciones sobre el alcance',
  facebook: 'interacciones sobre las impresiones únicas',
};
export const engagementBasis = (p: Platform) =>
  ENGAGEMENT_BASIS[p] ?? 'la definición de la fuente';

export const reachLabel = (p: Platform) =>
  p === 'facebook' ? 'Impresiones únicas' : 'Alcance';

export const postRef = (p: Post, label?: string): Evidence => ({
  type: 'post',
  label:
    label ??
    `${PLATFORM_LABEL[p.platform]} · ${formatOf(p)}${p.body ? ` · «${p.body.slice(0, 40)}…»` : ''}`,
  postId: p.id,
  value: null,
});

export const metricRef = (label: string, value: string): Evidence => ({
  type: 'metric',
  label,
  postId: null,
  value,
});

export const comparisonRef = (label: string, value: string): Evidence => ({
  type: 'comparison',
  label,
  postId: null,
  value,
});

/** Agrupa por clave conservando el orden de aparición. */
export function groupBy<T, K>(xs: T[], key: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of xs) m.set(key(x), [...(m.get(key(x)) ?? []), x]);
  return m;
}

/** Pilar de Brand Brain reconocido por el vocabulario del copy (palabras de 4+ letras). */
export function matchPillar(body: string | null, brand: BrandContext | null) {
  if (!brand || !body) return null;
  const t = fold(body);
  for (const p of brand.strategy.pillars) {
    const keys = [p.name, ...p.keywords].map(fold).filter((k) => k.length >= 4);
    if (keys.some((k) => t.includes(k))) return p;
  }
  return null;
}

/** Campaña activa reconocida por su nombre o canales en el copy. */
export function matchCampaign(body: string | null, brand: BrandContext | null) {
  if (!brand || !body) return null;
  const t = fold(body);
  return (
    brand.campaigns.find(
      (c) =>
        c.status === 'active' &&
        [c.name, ...c.channels]
          .map(fold)
          .some((k) => k.length >= 5 && t.includes(k)),
    ) ?? null
  );
}

/** Brand Brain con algo que evaluar (pilares, campañas u objetivos). */
export const hasStrategy = (b: BrandContext | null): b is BrandContext =>
  !!b &&
  (b.strategy.pillars.length > 0 ||
    b.campaigns.length > 0 ||
    b.strategy.communicationGoals.length > 0);

// --- Copy -----------------------------------------------------------------------------------
const CTA_RE =
  /(comenta|cuentanos|escribenos|agenda|reserva|descubre|conoce|visita|link en (la )?bio|haz clic|inscribete|afiliate|llamanos|dejanos|comparte|guarda|etiqueta|descarga|solicita|cotiza)/;

function sentences(body: string): string[] {
  return body
    .split(/(?<=[.!?¡¿])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Plegado carácter a carácter: conserva las posiciones del texto original. */
const foldKeepIndex = (s: string) => Array.from(s, (c) => fold(c)).join('');

/**
 * Estructura del copy. El CTA es la frase con un verbo de acción; si esa frase es también el
 * hook (copy de una sola frase), el CTA se recorta desde el verbo de acción y, si empieza en
 * el mismo punto, se marca `ctaInHook` en lugar de repetir el mismo texto dos veces.
 */
export function analyzeCopy(body: string | null) {
  const text = body ?? '';
  const ss = sentences(text);
  const hook = ss[0] ? ss[0].slice(0, 160) : null;
  const ctaSentence = ss.find((s) => CTA_RE.test(fold(s))) ?? null;
  let cta = ctaSentence ? ctaSentence.slice(0, 160) : null;
  let ctaInHook = false;
  if (ctaSentence && ctaSentence === ss[0]) {
    const folded = foldKeepIndex(ctaSentence);
    const at =
      folded.length === ctaSentence.length ? folded.search(CTA_RE) : -1;
    if (at > 0) cta = ctaSentence.slice(at, at + 160);
    else ctaInHook = true;
  }
  const hashtags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const emojis = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  return {
    hook,
    cta,
    ctaInHook,
    hashtags: hashtags.length,
    emojis: emojis.length,
    length: text.length,
    questionHook: hook ? /[¿?]/.test(hook) : false,
    hasText: text.trim().length > 0,
  };
}
