import type { BrandContext } from '@/lib/brain/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { interactions } from '@/lib/insights';
import type { Platform, Post } from '@/lib/types';
import {
  analyzeCopy,
  comparisonRef,
  engagementBasis,
  engagementOf,
  formatGroup as formatGroupOf,
  formatOf,
  groupBy,
  hasStrategy,
  matchPillar,
  median,
  metricRef,
  num,
  pct,
  postRef,
  reachLabel,
  reachOf,
  savesOf,
} from './common';
import { interactionBreakdown, type InteractionBreakdownData } from './metrics';
import type { Finding } from './schema';

/**
 * Inteligencia a nivel de marca (Intelligence Home, Ask Foxy general). Motor local por reglas.
 *
 * Reglas de consistencia de métricas (WO-HF-V2-UX-REFINEMENT-002):
 *  - Nada se compara ni se ordena ENTRE redes: Instagram y Facebook definen engagement y
 *    alcance de forma distinta (Facebook: impresiones únicas). Cada red se resume por separado.
 *  - Un acumulado de alcance es la suma por publicación: NO son personas únicas alcanzadas.
 *  - Los hechos no llevan nivel de confianza; las interpretaciones e hipótesis, sí.
 *  - Toda comparación declara tamaño de muestra y periodo; describe, no prueba causalidad.
 */

const MIN_SAMPLE = 3;

export interface FormatStat {
  format: string;
  n: number;
  engagementMedian: number | null;
}

export interface NetworkSummary {
  platform: Platform;
  label: string;
  posts: number;
  /** Publicaciones con al menos una medición. */
  measured: number;
  reachLabel: string;
  /** Suma por publicación (no personas únicas). null si la red no lo entrega. */
  reachSum: number | null;
  impressionsSum: number | null;
  /** Suma de las interacciones que reporta la propia red. */
  interactionsSum: number | null;
  engagementMedian: number | null;
  engagementBasis: string;
  savesSum: number | null;
  formats: FormatStat[];
}

const sumOf = (xs: Array<number | null | undefined>) => {
  const known = xs.filter((x): x is number => x != null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
};

export function networkSummaries(posts: Post[]): NetworkSummary[] {
  return [...groupBy(posts, (p) => p.platform)].map(([platform, ps]) => {
    const measured = ps.filter((p) => p.metrics.length > 0);
    const engs = measured
      .map(engagementOf)
      .filter((x): x is number => x != null);
    const formats = [...groupBy(measured, formatOf)]
      .map(([format, fs]) => {
        const e = fs.map(engagementOf).filter((x): x is number => x != null);
        return { format, n: fs.length, engagementMedian: median(e) };
      })
      .sort((a, b) => b.n - a.n);
    return {
      platform,
      label: PLATFORM_LABEL[platform],
      posts: ps.length,
      measured: measured.length,
      reachLabel: reachLabel(platform),
      reachSum: sumOf(measured.map(reachOf)),
      impressionsSum: sumOf(measured.map((p) => p.metrics[0]?.impressions)),
      interactionsSum: sumOf(
        measured.map((p) => p.metrics[0]?.interactions ?? null),
      ),
      engagementMedian: median(engs),
      engagementBasis: engagementBasis(platform),
      savesSum:
        platform === 'facebook' ? null : sumOf(measured.map((p) => savesOf(p))),
      formats,
    };
  });
}

export interface FeaturedPost {
  post: Post;
  metricLabel: string;
  metricValue: string;
  /** Motivo verificable (con la comparación y su base). */
  reason: string;
}

/**
 * Publicaciones destacadas: la de mayor engagement de CADA red (frente a la mediana de esa
 * misma red), y la de más guardados en Instagram si es otra. Nunca un ranking entre redes.
 */
export function featuredPosts(posts: Post[], max = 4): FeaturedPost[] {
  const out: FeaturedPost[] = [];
  for (const [platform, ps] of groupBy(
    posts.filter((p) => p.metrics.length > 0),
    (p) => p.platform,
  )) {
    const withE = ps
      .map((p) => ({ p, e: engagementOf(p) }))
      .filter((x): x is { p: Post; e: number } => x.e != null);
    const net = PLATFORM_LABEL[platform];
    if (withE.length >= 2) {
      const top = [...withE].sort((a, b) => b.e - a.e)[0]!;
      const med = median(withE.map((x) => x.e))!;
      out.push({
        post: top.p,
        metricLabel: 'Engagement',
        metricValue: pct(top.e),
        reason: `Mayor engagement de ${net} en el periodo: ${pct(top.e)} frente a una mediana de ${pct(med)} en ${withE.length} publicaciones de ${net} (${engagementBasis(platform)}).`,
      });
    }
    const withS = ps
      .map((p) => ({ p, s: savesOf(p) }))
      .filter((x): x is { p: Post; s: number } => x.s != null && x.s > 0);
    if (withS.length >= 2) {
      const top = [...withS].sort((a, b) => b.s - a.s)[0]!;
      if (!out.some((f) => f.post.id === top.p.id))
        out.push({
          post: top.p,
          metricLabel: 'Guardados',
          metricValue: num(top.s),
          reason: `Más guardados de ${net} en el periodo (${num(top.s)} de ${num(withS.reduce((a, x) => a + x.s, 0))} entre ${withS.length} publicaciones con guardados).`,
        });
    }
  }
  return out.slice(0, max);
}

/** Mejor formato por red con muestra suficiente (≥ 3 por formato) y diferencia ≥ 20 %. */
export function formatLearnings(posts: Post[]) {
  const res: Array<{
    platform: Platform;
    best: FormatStat;
    other: FormatStat;
    insufficient: false;
  }> = [];
  const insufficient: Array<{ platform: Platform; formats: FormatStat[] }> = [];
  for (const s of networkSummaries(posts)) {
    const ok = s.formats.filter(
      (f) => f.n >= MIN_SAMPLE && f.engagementMedian != null,
    );
    if (ok.length < 2) {
      if (s.formats.length > 1)
        insufficient.push({ platform: s.platform, formats: s.formats });
      continue;
    }
    const sorted = [...ok].sort(
      (a, b) => b.engagementMedian! - a.engagementMedian!,
    );
    const [best, other] = sorted as [FormatStat, FormatStat];
    if (best.engagementMedian! >= other.engagementMedian! * 1.2)
      res.push({ platform: s.platform, best, other, insufficient: false });
  }
  return { learnings: res, insufficient };
}

export interface PillarCoverage {
  pillar: string;
  posts: Post[];
}

/** Publicaciones del periodo por pilar de Brand Brain (reconocido por vocabulario). */
export function strategyAlignment(posts: Post[], brand: BrandContext | null) {
  if (!hasStrategy(brand)) return null;
  const pillars: PillarCoverage[] = brand.strategy.pillars.map((p) => ({
    pillar: p.name,
    posts: [],
  }));
  const unmatched: Post[] = [];
  for (const post of posts) {
    const p = matchPillar(post.body, brand);
    if (p) pillars.find((x) => x.pillar === p.name)!.posts.push(post);
    else unmatched.push(post);
  }
  return { pillars, unmatched, total: posts.length };
}

export type BriefArea =
  'performance' | 'change' | 'creative' | 'learning' | 'strategy' | 'risk';

export const BRIEF_AREA_LABEL: Record<BriefArea, string> = {
  performance: 'Rendimiento destacado',
  change: 'Cambios relevantes',
  creative: 'Oportunidad creativa',
  learning: 'Aprendizaje de contenido',
  strategy: 'Alineación estratégica',
  risk: 'Riesgo',
};

export interface BriefItem {
  area: BriefArea;
  finding: Finding;
  /** Recomendación derivada, si la hay (siempre separada del hallazgo). */
  recommendation: Finding | null;
  /** Acceso al detalle (ruta interna sin periodo). */
  href: string | null;
  hrefLabel: string | null;
}

const postHref = (p: Post) => `/publicaciones/${encodeURIComponent(p.id)}`;

/**
 * Foxy Executive Brief: «¿Qué debería saber hoy el director de marca?». Entre 3 y 5 hallazgos
 * priorizados, cada uno con evidencia, limitación y acceso al detalle. Si no hay base, lo dice.
 */
export function executiveBrief(input: {
  posts: Post[];
  brand: BrandContext | null;
  periodLabel: string;
  /** Solo con comentarios autorizados (nunca con la importación desactivada por privacidad). */
  risk?: { pendingAlerts: number; negatives: number } | null;
}): BriefItem[] {
  const { posts, brand } = input;
  const period = input.periodLabel.toLowerCase();
  const items: BriefItem[] = [];
  const measured = posts.filter((p) => p.metrics.length > 0);

  if (!measured.length)
    return [
      {
        area: 'performance',
        finding: {
          kind: 'fact',
          title: 'Sin publicaciones con métricas en el periodo',
          detail: `No hay mediciones de publicaciones propias en ${period}. Foxy no estima ni completa datos.`,
          evidence: [],
          confidence: null,
          limitation: 'Amplía el periodo o revisa las fuentes conectadas.',
        },
        recommendation: null,
        href: '/cobertura',
        hrefLabel: 'Ver fuentes y cobertura',
      },
    ];

  // 1. Rendimiento destacado (una por red, frente a su propia mediana).
  for (const f of featuredPosts(posts, 4).filter(
    (x) => x.metricLabel === 'Engagement',
  )) {
    const net = PLATFORM_LABEL[f.post.platform];
    items.push({
      area: 'performance',
      finding: {
        kind: 'fact',
        title: `${net}: la publicación con más engagement alcanzó ${f.metricValue}`,
        detail: f.reason,
        evidence: [postRef(f.post), metricRef('Engagement', f.metricValue)],
        confidence: null,
        limitation:
          'Comparación dentro de la misma red; no controla horario, pauta ni tema.',
      },
      recommendation: null,
      href: postHref(f.post),
      hrefLabel: 'Ver publicación',
    });
  }

  // 2. Aprendizaje de formato (dentro de cada red, muestra mínima).
  const { learnings, insufficient } = formatLearnings(posts);
  for (const l of learnings) {
    const net = PLATFORM_LABEL[l.platform];
    const n = l.best.n + l.other.n;
    items.push({
      area: 'learning',
      finding: {
        kind: 'interpretation',
        title: `En ${net}, ${l.best.format.toLowerCase()} rinde más que ${l.other.format.toLowerCase()}`,
        detail: `Mediana de engagement ${pct(l.best.engagementMedian!)} (${l.best.n} publicaciones) frente a ${pct(l.other.engagementMedian!)} (${l.other.n}), ${period}.`,
        evidence: [
          comparisonRef(
            `${net} · ${l.best.format} (n = ${l.best.n})`,
            pct(l.best.engagementMedian!),
          ),
          comparisonRef(
            `${net} · ${l.other.format} (n = ${l.other.n})`,
            pct(l.other.engagementMedian!),
          ),
        ],
        confidence: n >= 10 ? 'media' : 'baja',
        limitation:
          'Diferencia descriptiva entre medianas: no demuestra que el formato cause el resultado.',
      },
      recommendation: {
        kind: 'recommendation',
        title: `Probar más ${l.best.format.toLowerCase()} en ${net}`,
        detail:
          'Planifícalo como prueba (mismo tema y horario) y compara con la mediana actual.',
        evidence: [],
        confidence: 'baja',
        limitation: null,
      },
      href: `/publicaciones?platform=${l.platform}`,
      hrefLabel: `Ver publicaciones de ${net}`,
    });
  }

  // 3. Alineación estratégica (Brand Brain).
  const align = strategyAlignment(posts, brand);
  if (!align)
    items.push({
      area: 'strategy',
      finding: {
        kind: 'fact',
        title: 'Foxy aún no conoce la estrategia de la marca',
        detail:
          'Brand Brain no tiene pilares, campañas ni objetivos registrados: no se evalúa la alineación estratégica ni se inventa.',
        evidence: [],
        confidence: null,
        limitation: null,
      },
      recommendation: null,
      href: '/brand-brain',
      hrefLabel: 'Configurar Brand Brain',
    });
  else {
    const empty = align.pillars.filter((p) => p.posts.length === 0);
    const covered = align.pillars.filter((p) => p.posts.length > 0);
    items.push({
      area: 'strategy',
      finding: {
        kind: empty.length ? 'hypothesis' : 'interpretation',
        title: empty.length
          ? `${empty.length === 1 ? 'Un pilar' : `${empty.length} pilares`} sin publicaciones reconocidas: ${empty.map((p) => p.pillar).join(', ')}`
          : 'Todos los pilares tienen publicaciones en el periodo',
        detail: `${align.total - align.unmatched.length} de ${align.total} publicaciones se asocian a un pilar por su vocabulario${covered.length ? ` (${covered.map((p) => `${p.pillar}: ${p.posts.length}`).join(' · ')})` : ''}.`,
        evidence: [
          {
            type: 'brand',
            label: 'Pilares de Brand Brain',
            postId: null,
            value: String(align.pillars.length),
          },
          ...covered.slice(0, 2).map((p) => postRef(p.posts[0]!)),
        ],
        confidence: 'baja',
        limitation:
          'Asociación por palabras clave del pilar; confírmala con el equipo.',
      },
      recommendation: null,
      href: '/brand-brain',
      hrefLabel: 'Abrir Brand Brain',
    });
  }

  // 4. Oportunidad creativa: llamados a la acción.
  const texts = measured.filter((p) => analyzeCopy(p.body).hasText);
  const noCta = texts.filter((p) => !analyzeCopy(p.body).cta);
  if (texts.length >= MIN_SAMPLE && noCta.length > 0)
    items.push({
      area: 'creative',
      finding: {
        kind: 'fact',
        title: `${noCta.length} de ${texts.length} publicaciones no piden una acción concreta`,
        detail:
          'Su copy no incluye un llamado a la acción explícito (comentar, guardar, agendar).',
        evidence: noCta.slice(0, 3).map((p) => postRef(p)),
        confidence: null,
        limitation: null,
      },
      recommendation: {
        kind: 'recommendation',
        title: 'Añadir un llamado a la acción coherente con el objetivo',
        detail:
          '«Guárdalo» para contenido de referencia; «cuéntanos» para conversación; «agenda» para conversión.',
        evidence: [],
        confidence: 'media',
        limitation: null,
      },
      href: postHref(noCta[0]!),
      hrefLabel: 'Ver un ejemplo',
    });

  // 5. Cambios relevantes entre mediciones (por red).
  for (const [platform, ps] of groupBy(
    measured.filter((p) => p.metrics.length >= 2),
    (p) => p.platform,
  )) {
    const deltas = ps.map((p) => ({
      p,
      d: interactions(p.metrics[0]) - interactions(p.metrics[1]),
    }));
    const total = deltas.reduce((a, x) => a + x.d, 0);
    if (total === 0) continue;
    const top = [...deltas].sort((a, b) => b.d - a.d)[0]!;
    const net = PLATFORM_LABEL[platform];
    items.push({
      area: 'change',
      finding: {
        kind: 'fact',
        title: `${total > 0 ? '+' : ''}${num(total)} interacciones en ${net} desde la medición anterior`,
        detail: `${ps.length} publicaciones con dos o más mediciones; la que más cambió: ${top.d > 0 ? '+' : ''}${num(top.d)}.`,
        evidence: [postRef(top.p)],
        confidence: null,
        limitation: 'Solo entre mediciones reales; no se interpolan puntos.',
      },
      recommendation: null,
      href: postHref(top.p),
      hrefLabel: 'Ver evolución',
    });
  }

  // 6. Riesgo: solo con comentarios autorizados.
  if (input.risk && input.risk.pendingAlerts > 0)
    items.push({
      area: 'risk',
      finding: {
        kind: 'fact',
        title: `${input.risk.pendingAlerts} ${input.risk.pendingAlerts === 1 ? 'alerta pendiente' : 'alertas pendientes'} de revisión humana`,
        detail: `${input.risk.negatives} conversaciones negativas en el periodo.`,
        evidence: [],
        confidence: null,
        limitation: 'Solo fuentes de conversación autorizadas.',
      },
      recommendation: null,
      href: '/revision',
      hrefLabel: 'Revisar alertas',
    });

  // Base insuficiente para comparar formatos: solo si faltan hallazgos.
  if (items.length < 3)
    for (const i of insufficient) {
      const net = PLATFORM_LABEL[i.platform];
      items.push({
        area: 'learning',
        finding: {
          kind: 'fact',
          title: `Base insuficiente para comparar formatos en ${net}`,
          detail: `${i.formats.map((f) => `${f.format}: ${f.n}`).join(' · ')}. Se necesitan al menos ${MIN_SAMPLE} publicaciones por formato.`,
          evidence: [],
          confidence: null,
          limitation: 'Amplía el periodo para comparar.',
        },
        recommendation: null,
        href: `/publicaciones?platform=${i.platform}`,
        hrefLabel: `Ver publicaciones de ${net}`,
      });
    }

  const ORDER: BriefArea[] = [
    'risk',
    'performance',
    'learning',
    'strategy',
    'creative',
    'change',
  ];
  return items
    .map((x, i) => ({ x, i }))
    .sort(
      (a, b) => ORDER.indexOf(a.x.area) - ORDER.indexOf(b.x.area) || a.i - b.i,
    )
    .map(({ x }) => x)
    .slice(0, 5);
}

/** Reach se mantiene por red: utilidad para tablas y respuestas de Ask Foxy. */
export function reachByNetwork(posts: Post[]) {
  return networkSummaries(posts).map((s) => ({
    platform: s.platform,
    label: s.reachLabel,
    sum: s.reachSum,
    n: s.measured,
  }));
}

export interface ComparisonMetric {
  key: 'engagement' | 'reach' | 'interactions';
  label: string;
  unit: string;
  value: number | null;
  median: number | null;
  max: number | null;
}

/**
 * Rendimiento comparable de una publicación: solo frente a publicaciones de la MISMA red y del
 * mismo tipo de formato (estático o video), con la definición de esa red. Declara el tamaño
 * de muestra; con menos de 3 equivalentes no se calcula la mediana.
 */
export function postComparison(post: Post, peers: Post[]) {
  const comps = peers.filter(
    (p) =>
      p.id !== post.id &&
      p.platform === post.platform &&
      formatGroupOf(p) === formatGroupOf(post) &&
      p.metrics.length > 0,
  );
  const enough = comps.length >= MIN_SAMPLE;
  const read = (p: Post, k: ComparisonMetric['key']) =>
    k === 'engagement'
      ? engagementOf(p)
      : k === 'reach'
        ? reachOf(p)
        : (p.metrics[0]?.interactions ?? null);
  const metrics: ComparisonMetric[] = (
    [
      ['engagement', 'Engagement', '%'],
      ['reach', reachLabel(post.platform), ''],
      [
        'interactions',
        `Interacciones según ${PLATFORM_LABEL[post.platform]}`,
        '',
      ],
    ] as const
  ).map(([key, label, unit]) => {
    const xs = comps
      .map((p) => read(p, key))
      .filter((x): x is number => x != null);
    const value = read(post, key);
    return {
      key,
      label,
      unit,
      value,
      median: enough && xs.length >= MIN_SAMPLE ? median(xs) : null,
      max: Math.max(value ?? 0, ...xs, 0) || null,
    };
  });
  const formats =
    networkSummaries(
      peers.some((p) => p.id === post.id) ? peers : [...peers, post],
    ).find((s) => s.platform === post.platform)?.formats ?? [];
  return {
    network: PLATFORM_LABEL[post.platform],
    group: formatGroupOf(post) === 'video' ? 'video' : 'estático',
    sample: comps.length,
    enough,
    minSample: MIN_SAMPLE,
    engagementBasis: engagementBasis(post.platform),
    metrics,
    formats,
  };
}
export type PostComparison = ReturnType<typeof postComparison>;

/**
 * Distribución de interacciones agregada de UNA red (suma de la última medición de cada
 * publicación de esa red). Nunca mezcla redes: los componentes no son equivalentes.
 */
export function networkInteractionBreakdown(
  posts: Post[],
  platform: Platform,
): InteractionBreakdownData | null {
  const ps = posts.filter((p) => p.platform === platform && p.metrics.length);
  if (!ps.length) return null;
  const per = ps.map(interactionBreakdown);
  const parts = new Map<string, InteractionBreakdownData['parts'][number]>();
  for (const b of per)
    for (const p of b.parts) {
      const cur = parts.get(p.key);
      parts.set(p.key, cur ? { ...cur, value: cur.value + p.value } : { ...p });
    }
  const list = [...parts.values()];
  const componentsTotal = list.reduce((a, p) => a + p.value, 0);
  const nets = per.map((b) => b.networkTotal);
  const networkTotal = nets.every((x) => x != null)
    ? nets.reduce((a, b) => a! + b!, 0)
    : null;
  return {
    parts: list,
    componentsTotal,
    networkTotal,
    difference:
      networkTotal != null && networkTotal !== componentsTotal
        ? `${PLATFORM_LABEL[platform]} reporta ${num(networkTotal)} interacciones en total; los componentes que entrega por separado suman ${num(componentsTotal)} (acciones que la red no desglosa).`
        : null,
    unavailable: [...new Set(per.flatMap((b) => b.unavailable))].filter(
      (u) => !list.some((p) => p.label === u),
    ),
  };
}
