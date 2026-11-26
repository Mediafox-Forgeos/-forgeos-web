import type { BrandContext } from '@/lib/brain/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { interactions } from '@/lib/insights';
import type { Post } from '@/lib/types';
import {
  featuredPosts,
  formatLearnings,
  networkSummaries,
  strategyAlignment,
} from './brand';
import {
  analyzeCopy,
  comparisonRef,
  engagementBasis,
  engagementOf,
  fold,
  formatGroup,
  formatOf,
  groupBy,
  matchCampaign,
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
import { readMetric } from './metrics';
import type { AskAnswer, Evidence, Finding, PostIntel } from './schema';

/**
 * Motor LOCAL de Foxy (sin red, sin IA generativa, costo 0). Analiza lo que se puede
 * fundamentar con reglas sobre datos autorizados: copy, formato, métricas, histórico,
 * publicaciones equivalentes del periodo y el contexto de Foxy Brand Brain.
 * Lo que requiere un modelo (análisis visual, matices de tono) se declara como limitación.
 * Todo texto de la publicación se trata como DATO, nunca como instrucción.
 */
export const LOCAL_PROVIDER = { id: 'local', model: 'reglas-foxy-v1' } as const;

export interface IntelInput {
  post: Post;
  /** Publicaciones de la misma organización en el periodo (incluida o no la propia). */
  peers: Post[];
  brand: BrandContext | null;
  /** Comentarios reales desactivados por la política de privacidad del piloto. */
  commentsDisabled: boolean;
  periodLabel: string;
}

export { analyzeCopy, formatOf } from './common';

const THEMES: Array<{ re: RegExp; theme: string; territory: string }> = [
  {
    re: /prevenci|prevenir|chequeo|deteccion|tamizaje|examen|control/,
    theme: 'Prevención y chequeos',
    territory: 'Educación en salud',
  },
  {
    re: /bienestar|emocional|salud mental|plenitud|habito/,
    theme: 'Bienestar integral',
    territory: 'Educación en salud',
  },
  {
    re: /afiliad|afiliacion|plan|beneficio|ventaja|cobertura/,
    theme: 'Beneficios y afiliación',
    territory: 'Propuesta de valor',
  },
  {
    re: /app|directorio|asistente|virtual|digital|en linea/,
    theme: 'Servicios digitales',
    territory: 'Producto y servicio',
  },
  {
    re: /concierto|evento|navidad|celebra|sorteo|concurso/,
    theme: 'Eventos y temporada',
    territory: 'Marca y comunidad',
  },
  {
    re: /especialista|medico|doctor|dra\.|dr\.|pediatra|ginecolog|optometr/,
    theme: 'Especialistas',
    territory: 'Autoridad y confianza',
  },
];

function detectTheme(body: string | null) {
  const t = fold(body ?? '');
  const hit = THEMES.find((x) => x.re.test(t));
  return hit ?? null;
}

function objectiveOf(post: Post, cta: string | null): string {
  const c = fold(cta ?? '');
  if (/agenda|reserva|afiliate|solicita|cotiza|link en|descarga/.test(c))
    return 'Conversión (acción concreta)';
  if (/comenta|cuentanos|dejanos|etiqueta/.test(c))
    return 'Conversación con la audiencia';
  if (/guarda/.test(c)) return 'Guardados (contenido de referencia)';
  if (formatGroup(post) === 'video') return 'Alcance y descubrimiento';
  if (post.contentType === 'carousel') return 'Educación y guardados';
  return 'Reconocimiento de marca';
}

function comparables(post: Post, peers: Post[]) {
  return peers.filter(
    (p) =>
      p.id !== post.id &&
      p.platform === post.platform &&
      formatGroup(p) === formatGroup(post) &&
      p.metrics.length > 0,
  );
}

// --- Análisis de una publicación ---------------------------------------------------------------
export function analyzePostLocal(input: IntelInput): PostIntel {
  const { post, peers, brand } = input;
  const copy = analyzeCopy(post.body);
  const theme = detectTheme(post.body);
  const format = formatOf(post);
  const objective = objectiveOf(post, copy.cta);
  const limitations: string[] = [
    'Motor local por reglas: sin IA generativa. El análisis visual y los matices de tono requieren un proveedor de IA autorizado.',
  ];
  if (post.isSynthetic)
    limitations.push(
      'Publicación sintética de prueba: el análisis no describe una marca real.',
    );

  // A. Contenido
  const content: Finding[] = [];
  content.push({
    kind: 'fact',
    title: `Formato: ${format}`,
    detail:
      [
        (post.media?.length ?? 0) > 0
          ? `${post.media!.length} ${post.media!.length === 1 ? 'medio entregado' : 'medios entregados'} por la fuente`
          : 'La fuente no entregó medios',
        post.mediaCountReported &&
        post.mediaCountReported > (post.media?.length ?? 0)
          ? `la red informa ${post.mediaCountReported} elementos (solo llega la portada)`
          : null,
      ]
        .filter(Boolean)
        .join('; ') + '.',
    evidence: [postRef(post)],
    confidence: null,
    limitation: null,
  });
  if (copy.hasText) {
    content.push({
      kind: 'fact',
      title: 'Estructura del copy',
      detail: `${num(copy.length)} caracteres · ${copy.hashtags} hashtags · ${copy.emojis} emojis${copy.questionHook ? ' · abre con una pregunta' : ''}${copy.cta ? ' · incluye llamado a la acción' : ' · sin llamado a la acción explícito'}.`,
      evidence: [postRef(post)],
      confidence: null,
      limitation: null,
    });
    if (theme)
      content.push({
        kind: 'interpretation',
        title: `Temática: ${theme.theme}`,
        detail: `El vocabulario del copy corresponde al territorio «${theme.territory}».`,
        evidence: [postRef(post)],
        confidence: 'media',
        limitation: 'Detectado por vocabulario; no por la imagen.',
      });
    content.push({
      kind: 'hypothesis',
      title: `Objetivo probable: ${objective}`,
      detail: 'Inferido del formato y del llamado a la acción.',
      evidence: [postRef(post)],
      confidence: 'baja',
      limitation: 'El objetivo real lo define la estrategia de la marca.',
    });
  } else {
    content.push({
      kind: 'fact',
      title: 'Publicación sin texto',
      detail: 'No hay copy para analizar hook ni llamado a la acción.',
      evidence: [postRef(post)],
      confidence: null,
      limitation: null,
    });
  }

  // B. Rendimiento
  const perf: Finding[] = [];
  const comps = comparables(post, peers);
  const eng = engagementOf(post);
  const reach = reachOf(post);
  const engR = readMetric(post, 'engagement');
  if (eng != null)
    perf.push({
      kind: 'fact',
      title: `Engagement ${pct(eng)}`,
      detail:
        engR.state === 'value' || engR.state === 'zero'
          ? 'Calculado por Metricool.'
          : 'Calculado por Hey Foxy: interacciones / alcance.',
      evidence: [metricRef('Engagement', pct(eng))],
      confidence: null,
      limitation: null,
    });
  if (comps.length >= 3 && eng != null) {
    const med = median(
      comps.map(engagementOf).filter((x): x is number => x != null),
    );
    if (med != null && med > 0) {
      const ratio = eng / med;
      perf.push({
        kind: 'interpretation',
        title:
          ratio >= 1.2
            ? 'Rinde por encima de sus equivalentes'
            : ratio <= 0.8
              ? 'Rinde por debajo de sus equivalentes'
              : 'Rinde en línea con sus equivalentes',
        detail: `Engagement ${pct(eng)} frente a una mediana de ${pct(med)} en ${comps.length} publicaciones de ${PLATFORM_LABEL[post.platform]} con formato ${formatGroup(post) === 'video' ? 'de video' : 'estático'} (${input.periodLabel.toLowerCase()}).`,
        evidence: [
          metricRef('Engagement de la publicación', pct(eng)),
          {
            type: 'comparison',
            label: `Mediana de ${comps.length} equivalentes`,
            postId: null,
            value: pct(med),
          },
          ...comps.slice(0, 3).map((p) => postRef(p)),
        ],
        confidence: comps.length >= 6 ? 'media' : 'baja',
        limitation:
          'Comparación descriptiva; no controla horario, pauta ni tema.',
      });
    }
    const rMed = median(
      comps.map(reachOf).filter((x): x is number => x != null),
    );
    if (reach != null && rMed)
      perf.push({
        kind: 'fact',
        title: `Alcance ${num(reach)} (mediana de equivalentes: ${num(rMed)})`,
        detail: '',
        evidence: [
          metricRef('Alcance', num(reach)),
          {
            type: 'comparison',
            label: 'Mediana de equivalentes',
            postId: null,
            value: num(rMed),
          },
        ],
        confidence: null,
        limitation: null,
      });
  } else {
    perf.push({
      kind: 'fact',
      title: 'Sin base suficiente para comparar',
      detail: `Hay ${comps.length} publicaciones equivalentes (misma red y tipo de formato) en el periodo; se necesitan al menos 3.`,
      evidence: [],
      confidence: null,
      limitation: 'Amplía el periodo para comparar con más publicaciones.',
    });
  }
  const m = post.metrics;
  if (m.length >= 2) {
    const d = interactions(m[0]) - interactions(m[1]);
    perf.push({
      kind: 'fact',
      title:
        d === 0
          ? 'Sin variación entre las dos últimas mediciones'
          : `${d > 0 ? '+' : ''}${num(d)} interacciones desde la medición anterior`,
      detail: `${m.length} mediciones registradas.`,
      evidence: [metricRef('Mediciones', String(m.length))],
      confidence: null,
      limitation: null,
    });
  } else {
    perf.push({
      kind: 'fact',
      title: m.length ? 'Una sola medición' : 'Sin mediciones',
      detail: 'La evolución se podrá evaluar con nuevas sincronizaciones.',
      evidence: [],
      confidence: null,
      limitation: null,
    });
  }
  const last = m[0];
  if (last?.saves != null && reach)
    perf.push({
      kind: 'interpretation',
      title: `Guardados: ${num(last.saves)} (${pct((last.saves / reach) * 100)} del alcance)`,
      detail:
        'Los guardados indican contenido de referencia que la audiencia quiere conservar.',
      evidence: [metricRef('Guardados', num(last.saves))],
      confidence: 'media',
      limitation: null,
    });

  // C. Estrategia
  let strategicStatus: PostIntel['strategic']['status'] = 'no_context';
  const strategic: Finding[] = [];
  const pillar = matchPillar(post.body, brand);
  const campaign = matchCampaign(post.body, brand);
  if (
    !brand ||
    (!brand.strategy.pillars.length &&
      !brand.campaigns.length &&
      !brand.strategy.communicationGoals.length)
  ) {
    strategic.push({
      kind: 'fact',
      title: 'Sin contexto estratégico en Foxy Brand Brain',
      detail:
        'No hay pilares, campañas ni objetivos registrados para esta marca: no se evalúa la alineación estratégica ni se inventan.',
      evidence: [],
      confidence: null,
      limitation: 'Completa Foxy Brand Brain para personalizar el análisis.',
    });
  } else {
    strategicStatus = pillar || campaign ? 'ok' : 'partial';
    strategic.push(
      pillar
        ? {
            kind: 'interpretation',
            title: `Pilar de contenido: ${pillar.name}`,
            detail:
              pillar.description || 'Coincide con el vocabulario del pilar.',
            evidence: [
              {
                type: 'brand',
                label: `Pilar «${pillar.name}» (Brand Brain)`,
                postId: null,
                value: null,
              },
            ],
            confidence: 'media',
            limitation: 'Asignación por vocabulario; confírmala con el equipo.',
          }
        : {
            kind: 'interpretation',
            title: 'No se reconoce un pilar de contenido',
            detail: `Ningún pilar registrado (${brand.strategy.pillars.map((p) => p.name).join(', ') || 'ninguno'}) aparece en el copy.`,
            evidence: [
              {
                type: 'brand',
                label: 'Pilares de Brand Brain',
                postId: null,
                value: null,
              },
            ],
            confidence: 'baja',
            limitation: null,
          },
    );
    if (campaign)
      strategic.push({
        kind: 'interpretation',
        title: `Campaña: ${campaign.name}`,
        detail: campaign.concept || '',
        evidence: [
          {
            type: 'brand',
            label: `Campaña activa «${campaign.name}»`,
            postId: null,
            value: null,
          },
        ],
        confidence: 'media',
        limitation: null,
      });
    if (brand.strategy.communicationGoals.length)
      strategic.push({
        kind: 'hypothesis',
        title: 'Relación con los objetivos de comunicación',
        detail: `Objetivo probable de la pieza: ${objective.toLowerCase()}. Objetivos registrados: ${brand.strategy.communicationGoals.slice(0, 3).join('; ')}.`,
        evidence: [
          {
            type: 'brand',
            label: 'Objetivos de comunicación (Brand Brain)',
            postId: null,
            value: null,
          },
        ],
        confidence: 'baja',
        limitation:
          'La coherencia de tono requiere revisión humana o un proveedor de IA autorizado.',
      });
  }

  // D. Creatividad
  const creative: Finding[] = [];
  const better = bestFormat(post, peers);
  if (better)
    creative.push({
      kind: 'recommendation',
      title: `Probar ${better.format} para este tema`,
      detail: `En ${PLATFORM_LABEL[post.platform]}, ${better.format.toLowerCase()} tiene una mediana de engagement de ${pct(better.median)} frente a ${pct(better.current)} del formato actual (${better.n} publicaciones).`,
      evidence: [
        {
          type: 'comparison',
          label: `Mediana por formato (${better.n} publicaciones)`,
          postId: null,
          value: pct(better.median),
        },
      ],
      confidence: better.n >= 6 ? 'media' : 'baja',
      limitation: 'Diferencia descriptiva; confírmala con una prueba A/B.',
    });
  if (copy.hasText && !copy.cta)
    creative.push({
      kind: 'recommendation',
      title: 'Añadir un llamado a la acción explícito',
      detail:
        'El copy no pide una acción concreta (guardar, comentar, agendar).',
      evidence: [postRef(post)],
      confidence: 'media',
      limitation: null,
    });
  if (copy.length > 400)
    creative.push({
      kind: 'recommendation',
      title: 'Acortar el copy o llevar el detalle a un carrusel',
      detail: `El copy tiene ${num(copy.length)} caracteres; la idea principal compite con el resto del texto.`,
      evidence: [postRef(post)],
      confidence: 'baja',
      limitation: null,
    });
  const topic = theme?.theme.toLowerCase() ?? 'este tema';
  const hooks = copy.hasText
    ? [
        copy.questionHook
          ? `3 señales de que es momento de pensar en ${topic}`
          : `¿Sabías esto sobre ${topic}?`,
        `Mito o realidad: ${topic}`,
        `Lo que nadie te dice sobre ${topic}`,
      ]
    : [];
  const ctas = objective.startsWith('Conversión')
    ? [
        'Agenda tu cita desde el enlace del perfil',
        'Escríbenos para conocer tu plan',
      ]
    : [
        'Guárdalo para tenerlo a mano',
        'Cuéntanos en comentarios qué te gustaría saber',
      ];
  const abTests = copy.hasText
    ? [
        {
          hypothesis: copy.questionHook
            ? 'Un hook afirmativo con dato concreto genera más interacción que una pregunta.'
            : 'Un hook en forma de pregunta genera más interacción que una afirmación.',
          variantA: copy.hook ?? 'Hook actual',
          variantB: hooks[0] ?? 'Hook alternativo',
          metric: 'Engagement',
        },
      ]
    : [];

  return {
    content: {
      theme: theme?.theme ?? null,
      territory: theme?.territory ?? null,
      format,
      objective,
      intent: copy.cta ? `Invitar a: «${copy.cta.slice(0, 80)}»` : null,
      hook: copy.hook,
      cta: copy.cta,
      ctaInHook: copy.ctaInHook,
      visual: null,
      findings: content,
    },
    performance: { findings: perf, peers: comps.length },
    strategic: {
      status: strategicStatus,
      pillar: pillar?.name ?? null,
      campaign: campaign?.name ?? null,
      findings: strategic,
    },
    creative: { findings: creative, hooks, ctas, abTests },
    reputation: input.commentsDisabled
      ? {
          status: 'disabled_privacy',
          reason:
            'La importación de comentarios está desactivada por la política de privacidad del piloto. Que Hey Foxy no los importe no significa que no haya conversación en la red.',
        }
      : {
          status: 'no_data',
          reason:
            'Hey Foxy no tiene comentarios clasificados de esta publicación en las fuentes conectadas.',
        },
    limitations,
  };
}

/** Formato con mejor mediana de engagement en la misma red (mínimo 3 por formato). */
function bestFormat(post: Post, peers: Post[]) {
  const byFormat = new Map<string, number[]>();
  for (const p of peers.filter((x) => x.platform === post.platform)) {
    const e = engagementOf(p);
    if (e == null) continue;
    const f = formatOf(p);
    byFormat.set(f, [...(byFormat.get(f) ?? []), e]);
  }
  const cur = byFormat.get(formatOf(post));
  const curMed = cur && cur.length >= 3 ? median(cur) : null;
  let best: {
    format: string;
    median: number;
    current: number;
    n: number;
  } | null = null;
  for (const [f, xs] of byFormat) {
    if (f === formatOf(post) || xs.length < 3 || curMed == null) continue;
    const md = median(xs)!;
    if (md > curMed * 1.2 && (!best || md > best.median))
      best = {
        format: f,
        median: md,
        current: curMed,
        n: xs.length + cur!.length,
      };
  }
  return best;
}

// --- Ask Foxy -------------------------------------------------------------------------------------
export const SUGGESTED_QUESTIONS = [
  '¿Cómo podemos mejorar este contenido?',
  '¿Qué formato debería tener la siguiente pieza?',
  '¿Cómo se compara con otras publicaciones?',
  '¿Está alineado con nuestra estrategia orgánica?',
  '¿Qué oportunidades creativas podemos aprovechar?',
  '¿Qué aprendizajes nos deja esta publicación?',
  '¿Qué prueba A/B recomendarías?',
  '¿Cómo conseguimos más guardados?',
] as const;

/** Preguntas generales de marca (Intelligence Home, Ask Foxy general, panel lateral). */
export const BRAND_QUESTIONS = [
  '¿Qué contenidos están funcionando mejor?',
  '¿Qué formatos deberíamos priorizar?',
  '¿Qué oportunidades creativas tenemos?',
  '¿Qué deberíamos publicar la próxima semana?',
  '¿Estamos cumpliendo nuestra estrategia?',
  '¿Cómo se comparan Instagram y Facebook?',
] as const;

export type Intent =
  | 'improve'
  | 'format'
  | 'compare'
  | 'strategy'
  | 'pillar'
  | 'creative'
  | 'learnings'
  | 'cronopost'
  | 'nextweek'
  | 'abtest'
  | 'engagement'
  | 'saves'
  | 'reach'
  | 'top'
  | 'networks'
  | 'unknown';

/** Reconocimiento de intención por reglas (vocabulario plegado, sin tildes). */
export function intentOf(q: string): Intent {
  const t = fold(q);
  if (/\ba\/b\b|\bab\b|prueba a\/?b|\bprueba\b|experiment/.test(t))
    return 'abtest';
  if (
    /proxima semana|proximo mes|que deberiamos publicar|que publicar|que publicamos|plan de contenido/.test(
      t,
    )
  )
    return 'nextweek';
  if (/cronopost|calendario|siguiente publicacion|proxima pieza/.test(t))
    return 'cronopost';
  if (/pilar/.test(t)) return 'pillar';
  if (/estrategi|alinead|objetivo|cumpli/.test(t)) return 'strategy';
  if (/aprendizaje|aprend|lecci/.test(t)) return 'learnings';
  if (/guardad|guardar/.test(t)) return 'saves';
  if (/alcance|llegar a mas|visibilidad|impresion/.test(t)) return 'reach';
  if (/engagement|interaccion/.test(t)) return 'engagement';
  if (/formato|siguiente pieza|priorizar/.test(t)) return 'format';
  if (
    /instagram y facebook|facebook e instagram|entre redes|por red|cada red|que red/.test(
      t,
    )
  )
    return 'networks';
  if (
    /mejor(es)? (publicacion|contenido)|funcionando mejor|funciona mejor|rindieron mejor|rinden mejor|\btop\b|destacad/.test(
      t,
    )
  )
    return 'top';
  if (/compar/.test(t)) return 'compare';
  if (/oportunidad|creativ|idea|hook|llamado a la accion|\bcta\b/.test(t))
    return 'creative';
  if (/mejorar|optimizar|subir|aumentar|crecer/.test(t)) return 'improve';
  return 'unknown';
}

const fact = (
  title: string,
  detail: string,
  evidence: Evidence[] = [],
  limitation: string | null = null,
): Finding => ({
  kind: 'fact',
  title,
  detail,
  evidence,
  confidence: null,
  limitation,
});

const NO_CROSS_NETWORK =
  'Las redes no se ordenan entre sí: Metricool calcula el engagement de Instagram sobre el alcance y el de Facebook sobre las impresiones únicas.';

/** Publicaciones de la misma red con más guardados y la recomendación por reglas. */
function savesFindings(posts: Post[], current: Post | null): Finding[] {
  const ig = posts.filter((p) => savesOf(p) != null);
  if (!ig.length)
    return [
      fact(
        'Sin datos de guardados',
        'Solo Instagram entrega guardados y no hay publicaciones con esa métrica en el periodo.',
      ),
    ];
  const sorted = [...ig].sort((a, b) => savesOf(b)! - savesOf(a)!);
  const out: Finding[] = [];
  if (current && savesOf(current) != null) {
    const med = median(
      ig.filter((p) => p.id !== current.id).map((p) => savesOf(p)!),
    );
    out.push(
      fact(
        `Esta publicación tiene ${num(savesOf(current)!)} guardados`,
        med != null
          ? `Mediana de ${ig.length - 1} publicaciones de Instagram del periodo: ${num(med)}.`
          : 'No hay otras publicaciones de Instagram con guardados para comparar.',
        [metricRef('Guardados', num(savesOf(current)!))],
      ),
    );
  }
  const top = sorted.slice(0, 3).filter((p) => savesOf(p)! > 0);
  if (top.length)
    out.push(
      fact(
        `Más guardados en Instagram: ${top.map((p) => `${formatOf(p)} (${num(savesOf(p)!)})`).join(' · ')}`,
        `${ig.length} publicaciones de Instagram con guardados medidos.`,
        top.map((p) => postRef(p)),
      ),
    );
  const formats = new Set(top.map(formatOf));
  out.push({
    kind: 'recommendation',
    title: 'Crear contenido de referencia y pedir que lo guarden',
    detail: `Los guardados premian lo que la audiencia quiere conservar: listas, pasos, datos útiles.${formats.size === 1 && top.length >= 2 ? ` En el periodo, lo más guardado fue ${[...formats][0]!.toLowerCase()}.` : ''} Cierra con «Guárdalo para tenerlo a mano».`,
    evidence: top.slice(0, 2).map((p) => postRef(p)),
    confidence: 'baja',
    limitation:
      top.length < 3
        ? 'Base pequeña: confírmalo con una prueba.'
        : 'Patrón descriptivo; confírmalo con una prueba.',
  });
  return out;
}

function topByNetwork(posts: Post[], period: string): Finding[] {
  const out: Finding[] = [];
  for (const [platform, ps] of groupBy(posts, (p) => p.platform)) {
    const withE = ps
      .map((p) => ({ p, e: engagementOf(p) }))
      .filter((x): x is { p: Post; e: number } => x.e != null)
      .sort((a, b) => b.e - a.e);
    if (!withE.length) continue;
    const net = PLATFORM_LABEL[platform];
    out.push(
      fact(
        `${net}: ${withE
          .slice(0, 3)
          .map((x) => `${formatOf(x.p)} ${pct(x.e)}`)
          .join(' · ')}`,
        `Las publicaciones con más engagement de ${net} en ${period} (${withE.length} con métricas; engagement = ${engagementBasis(platform)}).`,
        withE.slice(0, 3).map((x) => postRef(x.p)),
      ),
    );
  }
  if (out.length > 1)
    out.push(fact('Cada red se evalúa por separado', NO_CROSS_NETWORK));
  return out;
}

function networksOverview(posts: Post[], period: string): Finding[] {
  const out = networkSummaries(posts)
    .filter((s) => s.measured > 0)
    .map((s) =>
      fact(
        `${s.label}: ${s.measured} publicaciones con métricas · engagement mediano ${s.engagementMedian != null ? pct(s.engagementMedian) : 'no disponible'}`,
        [
          `Engagement = ${s.engagementBasis}.`,
          s.reachSum != null
            ? `${s.reachLabel} acumulado: ${num(s.reachSum)} (suma por publicación; no son personas únicas).`
            : null,
          s.interactionsSum != null
            ? `Interacciones según ${s.label}: ${num(s.interactionsSum)}.`
            : null,
        ]
          .filter(Boolean)
          .join(' '),
        [
          comparisonRef(
            `${s.label} (${period})`,
            s.engagementMedian != null ? pct(s.engagementMedian) : '—',
          ),
        ],
        s.measured < 3 ? 'Base pequeña.' : null,
      ),
    );
  if (out.length > 1)
    out.push(
      fact('No se comparan como si fueran la misma métrica', NO_CROSS_NETWORK),
    );
  return out;
}

function formatsOverview(posts: Post[], period: string): Finding[] {
  const out: Finding[] = [];
  const { learnings } = formatLearnings(posts);
  for (const l of learnings) {
    const net = PLATFORM_LABEL[l.platform];
    out.push({
      kind: 'interpretation',
      title: `${net}: priorizar ${l.best.format.toLowerCase()}`,
      detail: `Mediana de engagement ${pct(l.best.engagementMedian!)} (${l.best.n} publicaciones) frente a ${pct(l.other.engagementMedian!)} de ${l.other.format.toLowerCase()} (${l.other.n}), ${period}.`,
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
      confidence: l.best.n + l.other.n >= 10 ? 'media' : 'baja',
      limitation:
        'Descriptivo: confírmalo con una prueba antes de cambiar el plan.',
    });
  }
  for (const s of networkSummaries(posts)) {
    if (learnings.some((l) => l.platform === s.platform) || !s.formats.length)
      continue;
    out.push(
      fact(
        `${s.label}: ${s.formats.map((f) => `${f.format} ${f.engagementMedian != null ? pct(f.engagementMedian) : '—'} (n = ${f.n})`).join(' · ')}`,
        'Mediana de engagement por formato. Ningún formato supera a otro con al menos 3 publicaciones cada uno y una diferencia del 20 %.',
        [],
        'Amplía el periodo para tener una base comparable.',
      ),
    );
  }
  return out;
}

function creativeOverview(posts: Post[]): Finding[] {
  const texts = posts.filter(
    (p) => p.metrics.length && analyzeCopy(p.body).hasText,
  );
  if (!texts.length) return [];
  const noCta = texts.filter((p) => !analyzeCopy(p.body).cta);
  const questions = texts.filter((p) => analyzeCopy(p.body).questionHook);
  const out: Finding[] = [
    fact(
      `${noCta.length} de ${texts.length} publicaciones sin llamado a la acción explícito`,
      `${questions.length} abren con una pregunta.`,
      noCta.slice(0, 3).map((p) => postRef(p)),
    ),
  ];
  if (noCta.length)
    out.push({
      kind: 'recommendation',
      title: 'Cerrar cada pieza con una acción concreta',
      detail:
        '«Guárdalo» (referencia), «cuéntanos» (conversación) o «agenda» (conversión), según el objetivo.',
      evidence: [],
      confidence: 'media',
      limitation: null,
    });
  for (const l of formatLearnings(posts).learnings)
    out.push({
      kind: 'recommendation',
      title: `Probar el mismo tema en ${l.best.format.toLowerCase()} (${PLATFORM_LABEL[l.platform]})`,
      detail: `Es el formato con mejor mediana de engagement en ${PLATFORM_LABEL[l.platform]} (${l.best.n} publicaciones).`,
      evidence: [
        comparisonRef(
          `${PLATFORM_LABEL[l.platform]} · ${l.best.format}`,
          pct(l.best.engagementMedian!),
        ),
      ],
      confidence: 'baja',
      limitation: 'Confírmalo con una prueba A/B.',
    });
  return out;
}

function strategyOverview(
  posts: Post[],
  brand: BrandContext | null,
): Finding[] {
  const a = strategyAlignment(posts, brand);
  if (!a)
    return [
      fact(
        'Sin contexto estratégico en Foxy Brand Brain',
        'No hay pilares, campañas ni objetivos registrados: Foxy no puede evaluar si se cumple la estrategia ni la inventa.',
        [],
        'Completa Brand Brain para responder esta pregunta.',
      ),
    ];
  return [
    ...a.pillars.map((p) =>
      p.posts.length
        ? {
            kind: 'interpretation' as const,
            title: `Pilar «${p.pillar}»: ${p.posts.length} ${p.posts.length === 1 ? 'publicación' : 'publicaciones'}`,
            detail: 'Asociadas por el vocabulario del pilar en el copy.',
            evidence: p.posts.slice(0, 3).map((x) => postRef(x)),
            confidence: 'baja' as const,
            limitation: 'Confírmalo con el equipo.',
          }
        : {
            kind: 'hypothesis' as const,
            title: `Pilar «${p.pillar}» sin publicaciones reconocidas`,
            detail:
              'Ningún copy del periodo usa su vocabulario. Puede ser una brecha de la parrilla o un vocabulario distinto.',
            evidence: [
              {
                type: 'brand' as const,
                label: `Pilar «${p.pillar}» (Brand Brain)`,
                postId: null,
                value: null,
              },
            ],
            confidence: 'baja' as const,
            limitation: null,
          },
    ),
    fact(
      `${a.unmatched.length} de ${a.total} publicaciones sin pilar reconocido`,
      'Revisa si deberían pertenecer a un pilar o si faltan palabras clave en Brand Brain.',
      a.unmatched.slice(0, 2).map((p) => postRef(p)),
    ),
  ];
}

/** Propuesta por red para la próxima semana (reglas, con evidencia). No se agenda sola. */
function nextWeekProposal(
  posts: Post[],
  brand: BrandContext | null,
  period: string,
): Finding[] {
  const out: Finding[] = [];
  const align = strategyAlignment(posts, brand);
  const gap = align
    ? [...align.pillars].sort((a, b) => a.posts.length - b.posts.length)[0]
    : null;
  const { learnings } = formatLearnings(posts);
  for (const s of networkSummaries(posts).filter((x) => x.measured > 0)) {
    const l = learnings.find((x) => x.platform === s.platform);
    const best =
      l?.best ??
      [...s.formats]
        .filter((f) => f.engagementMedian != null)
        .sort((a, b) => b.engagementMedian! - a.engagementMedian!)[0];
    if (!best) continue;
    out.push({
      kind: 'recommendation',
      title: `${s.label}: ${best.format.toLowerCase()}${gap ? ` del pilar «${gap.pillar}»` : ''}, con un llamado a la acción explícito`,
      detail: [
        `Formato: ${best.format} (mediana de engagement ${pct(best.engagementMedian!)}, ${best.n} publicaciones de ${s.label}, ${period}).`,
        gap
          ? `Pilar: «${gap.pillar}» es el que menos publicaciones tiene (${gap.posts.length}).`
          : 'Pilar: sin Brand Brain, Foxy no propone uno.',
        'Cierre: «Guárdalo» si es educativo; «Cuéntanos» si busca conversación.',
      ].join(' '),
      evidence: [
        comparisonRef(
          `${s.label} · ${best.format} (n = ${best.n})`,
          pct(best.engagementMedian!),
        ),
      ],
      confidence: l ? 'media' : 'baja',
      limitation: l
        ? 'Propuesta por reglas para validar con el equipo; no se agenda automáticamente.'
        : 'Base pequeña para elegir formato: tómalo como prueba. No se agenda automáticamente.',
    });
  }
  return out;
}

function brandAnswer(
  intent: Intent,
  posts: Post[],
  brand: BrandContext | null,
  periodLabel: string,
): Finding[] {
  const period = periodLabel.toLowerCase();
  if (!posts.some((p) => p.metrics.length))
    return [
      fact(
        'Sin publicaciones con métricas en el periodo',
        `No hay mediciones en ${period}.`,
      ),
    ];
  switch (intent) {
    case 'top':
    case 'compare':
      return intent === 'compare'
        ? networksOverview(posts, period)
        : topByNetwork(posts, period);
    case 'networks':
      return networksOverview(posts, period);
    case 'format':
      return formatsOverview(posts, period);
    case 'saves':
      return savesFindings(posts, null);
    case 'reach':
      return networkSummaries(posts)
        .filter((s) => s.reachSum != null)
        .map((s) => {
          const top = [
            ...posts.filter(
              (p) => p.platform === s.platform && reachOf(p) != null,
            ),
          ].sort((a, b) => reachOf(b)! - reachOf(a)!)[0];
          return fact(
            `${s.label}: ${s.reachLabel.toLowerCase()} acumulado ${num(s.reachSum!)}`,
            `Suma por publicación de ${s.measured} publicaciones (no son personas únicas).${top ? ` Mayor: ${formatOf(top)} con ${num(reachOf(top)!)}.` : ''}`,
            top ? [postRef(top)] : [],
          );
        });
    case 'creative':
    case 'improve':
    case 'engagement':
      return creativeOverview(posts);
    case 'learnings':
      return [
        ...formatsOverview(posts, period).filter((f) => f.kind !== 'fact'),
        ...featuredPosts(posts).map((f) =>
          fact(
            `Destacada · ${PLATFORM_LABEL[f.post.platform]}: ${f.metricLabel.toLowerCase()} ${f.metricValue}`,
            f.reason,
            [postRef(f.post)],
          ),
        ),
      ];
    case 'strategy':
    case 'pillar':
      return strategyOverview(posts, brand);
    case 'nextweek':
    case 'cronopost':
      return nextWeekProposal(posts, brand, period);
    default:
      return [];
  }
}

/**
 * Respuesta local: compone hallazgos YA fundamentados (no genera texto libre). Si la pregunta
 * excede lo que se puede responder con reglas, lo dice. Respuesta principal = título del
 * hallazgo más relevante.
 */
export function answerLocal(
  question: string,
  ctx: {
    intel: PostIntel | null;
    post: Post | null;
    peers: Post[];
    brand: BrandContext | null;
    periodLabel: string;
  },
): AskAnswer {
  const intent = intentOf(question);
  const i = ctx.intel;
  const pick = (...fs: (Finding[] | undefined)[]) =>
    fs.flatMap((x) => x ?? []).slice(0, 6);
  let findings: Finding[] = [];
  const brandIntents: Intent[] = ['top', 'networks', 'nextweek'];
  if (i && !brandIntents.includes(intent)) {
    switch (intent) {
      case 'improve':
      case 'engagement':
        findings = pick(
          i.performance.findings.filter(
            (f) => f.kind !== 'fact' || /engagement/i.test(f.title),
          ),
          i.creative.findings,
        );
        break;
      case 'format':
        findings = pick(
          i.creative.findings.filter((f) => /probar/i.test(f.title)),
          i.content.findings.filter((f) => /formato/i.test(f.title)),
        );
        if (!findings.some((f) => f.kind === 'recommendation'))
          findings.push(
            fact(
              'Sin diferencias suficientes entre formatos',
              'Ningún otro formato supera claramente al actual en la misma red con al menos 3 publicaciones. Amplía el periodo o prueba una A/B.',
            ),
          );
        break;
      case 'compare':
      case 'reach':
        findings = pick(i.performance.findings);
        break;
      case 'saves':
        findings = savesFindings(
          ctx.peers
            .filter((p) => p.platform === ctx.post?.platform)
            .concat(
              ctx.post && !ctx.peers.some((p) => p.id === ctx.post!.id)
                ? [ctx.post]
                : [],
            ),
          ctx.post,
        );
        break;
      case 'strategy':
      case 'pillar':
        findings = pick(i.strategic.findings);
        break;
      case 'creative':
        findings = pick(i.creative.findings);
        break;
      case 'learnings':
        findings = pick(
          i.performance.findings.filter((f) => f.kind === 'interpretation'),
          i.content.findings.filter((f) => f.kind !== 'fact'),
        );
        break;
      case 'cronopost':
        findings = [
          {
            kind: 'recommendation',
            title: 'Próxima pieza sugerida',
            detail: [
              `Formato: ${
                i.creative.findings
                  .find((f) => /probar/i.test(f.title))
                  ?.title.replace('Probar ', '')
                  .replace(' para este tema', '') ?? i.content.format
              }.`,
              i.strategic.pillar
                ? `Pilar: ${i.strategic.pillar}.`
                : 'Pilar: define uno en Brand Brain.',
              i.creative.hooks[0] ? `Hook: «${i.creative.hooks[0]}».` : null,
              i.creative.ctas[0] ? `CTA: «${i.creative.ctas[0]}».` : null,
            ]
              .filter(Boolean)
              .join(' '),
            evidence: [
              {
                type: 'post',
                label: 'Basado en esta publicación',
                postId: ctx.post?.id ?? null,
                value: null,
              },
            ],
            confidence: 'baja',
            limitation:
              'Propuesta para validar con el equipo; no se agenda automáticamente.',
          },
        ];
        break;
      case 'abtest':
        findings = i.creative.abTests.map((t) => ({
          kind: 'recommendation' as const,
          title: 'Prueba A/B sugerida',
          detail: `${t.hypothesis} A: «${t.variantA}» · B: «${t.variantB}» · Métrica: ${t.metric}.`,
          evidence: [
            {
              type: 'post' as const,
              label: 'Publicación analizada',
              postId: ctx.post?.id ?? null,
              value: null,
            },
          ],
          confidence: 'baja' as const,
          limitation:
            'Mantén igual el resto de variables (formato, horario, pauta).',
        }));
        break;
    }
  } else {
    findings = brandAnswer(intent, ctx.peers, ctx.brand, ctx.periodLabel).slice(
      0,
      8,
    );
  }
  findings = findings.map((f) =>
    f.kind === 'fact' ? { ...f, confidence: null } : f,
  );
  const unanswerable = findings.length
    ? null
    : 'El motor local de Foxy no puede responder esta pregunta con la evidencia disponible. Prueba una de las preguntas sugeridas; las preguntas abiertas requieren un proveedor de IA autorizado (pendiente de GO).';
  const lead = ['nextweek', 'cronopost', 'abtest', 'creative'].includes(intent)
    ? (findings.find((f) => f.kind === 'recommendation') ?? findings[0])
    : (findings.find((f) => f.kind !== 'recommendation') ?? findings[0]);
  return {
    question: question.slice(0, 500),
    headline: lead ? lead.title : null,
    findings,
    unanswerable,
    suggestions: (ctx.post ? SUGGESTED_QUESTIONS : BRAND_QUESTIONS)
      .filter((s) => s !== question)
      .slice(0, 4),
  };
}

export { reachLabel };
