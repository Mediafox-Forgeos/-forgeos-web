import type { BrandContext } from '@/lib/brain/types';
import { PLATFORM_LABEL } from '@/lib/format';
import { interactions } from '@/lib/insights';
import type { Post } from '@/lib/types';
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

// --- Utilidades de texto ------------------------------------------------------------------------
const fold = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const CTA_RE =
  /(comenta|cuentanos|escribenos|agenda|reserva|descubre|conoce|visita|link en (la )?bio|haz clic|inscribete|afiliate|llamanos|dejanos|comparte|guarda|etiqueta|descarga|solicita|cotiza)/;

function sentences(body: string): string[] {
  return body
    .split(/(?<=[.!?¡¿])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function analyzeCopy(body: string | null) {
  const text = body ?? '';
  const ss = sentences(text);
  const hook = ss[0] ? ss[0].slice(0, 160) : null;
  const ctaSentence = ss.find((s) => CTA_RE.test(fold(s))) ?? null;
  const hashtags = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  const emojis = text.match(/\p{Extended_Pictographic}/gu) ?? [];
  return {
    hook,
    cta: ctaSentence ? ctaSentence.slice(0, 160) : null,
    hashtags: hashtags.length,
    emojis: emojis.length,
    length: text.length,
    questionHook: hook ? /[¿?]/.test(hook) : false,
    hasText: text.trim().length > 0,
  };
}

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

const formatGroup = (post: Post) =>
  ['reel', 'video'].includes(post.contentType ?? '') ||
  (post.media ?? []).some((m) => m.kind === 'video')
    ? 'video'
    : 'static';

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

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const pct = (n: number) =>
  `${n.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`;
const num = (n: number) => Math.round(n).toLocaleString('es-CO');

const postRef = (p: Post, label?: string): Evidence => ({
  type: 'post',
  label:
    label ??
    `${PLATFORM_LABEL[p.platform]} · ${formatOf(p)}${p.body ? ` · «${p.body.slice(0, 40)}…»` : ''}`,
  postId: p.id,
  value: null,
});
const metricRef = (label: string, value: string): Evidence => ({
  type: 'metric',
  label,
  postId: null,
  value,
});

/** Engagement comparable: el de la fuente; si no hay, interacciones / alcance. */
function engagementOf(p: Post): number | null {
  const m = p.metrics[0];
  if (!m) return null;
  if (m.engagement != null) return m.engagement;
  const reach = m.reach ?? m.impressionsUnique ?? null;
  return reach ? (interactions(m) / reach) * 100 : null;
}
const reachOf = (p: Post) =>
  p.metrics[0]?.reach ?? p.metrics[0]?.impressionsUnique ?? null;

function comparables(post: Post, peers: Post[]) {
  return peers.filter(
    (p) =>
      p.id !== post.id &&
      p.platform === post.platform &&
      formatGroup(p) === formatGroup(post) &&
      p.metrics.length > 0,
  );
}

function matchPillar(body: string | null, brand: BrandContext | null) {
  if (!brand || !body) return null;
  const t = fold(body);
  for (const p of brand.strategy.pillars) {
    const keys = [p.name, ...p.keywords].map(fold).filter((k) => k.length >= 4);
    if (keys.some((k) => t.includes(k))) return p;
  }
  return null;
}
function matchCampaign(body: string | null, brand: BrandContext | null) {
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
            'Análisis reputacional no disponible: importación de comentarios desactivada por política de privacidad del piloto. Que no haya comentarios importados no significa que no haya conversación en la red.',
        }
      : {
          status: 'no_data',
          reason: 'Sin comentarios clasificados para esta publicación.',
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
  '¿A qué pilar de contenido pertenece?',
  '¿Qué oportunidades creativas podemos aprovechar?',
  '¿Qué aprendizajes nos deja esta publicación?',
  '¿Cómo incorporamos este aprendizaje al próximo cronopost?',
  '¿Qué prueba A/B recomendarías?',
  '¿Qué podemos hacer para mejorar el engagement?',
] as const;

export const BRAND_QUESTIONS = [
  '¿Qué publicaciones rindieron mejor en el periodo?',
  '¿Qué formato funciona mejor en cada red?',
  '¿Cómo se comparan Instagram y Facebook?',
  '¿Qué deberíamos publicar la próxima semana?',
] as const;

type Intent =
  | 'improve'
  | 'format'
  | 'compare'
  | 'strategy'
  | 'pillar'
  | 'creative'
  | 'learnings'
  | 'cronopost'
  | 'abtest'
  | 'engagement'
  | 'top'
  | 'networks'
  | 'unknown';

export function intentOf(q: string): Intent {
  const t = fold(q);
  if (/a\/?b|prueba/.test(t)) return 'abtest';
  if (
    /cronopost|calendario|proxima semana|que deberiamos publicar|siguiente publicacion/.test(
      t,
    )
  )
    return 'cronopost';
  if (/pilar/.test(t)) return 'pillar';
  if (/estrategi|alinead|objetivo/.test(t)) return 'strategy';
  if (/aprendizaje|aprend|lecci/.test(t)) return 'learnings';
  if (/engagement|interaccion/.test(t)) return 'engagement';
  if (/formato|siguiente pieza/.test(t)) return 'format';
  if (/instagram y facebook|facebook e instagram|redes|por red/.test(t))
    return 'networks';
  if (/mejor(es)? (publicacion|rindi)|top|rindieron mejor/.test(t))
    return 'top';
  if (/compar/.test(t)) return 'compare';
  if (/oportunidad|creativ|idea/.test(t)) return 'creative';
  if (/mejorar/.test(t)) return 'improve';
  return 'unknown';
}

/**
 * Respuesta local: compone hallazgos YA fundamentados por el análisis (no genera texto nuevo).
 * Si la pregunta excede lo que se puede responder con reglas, lo dice.
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
  let unanswerable: string | null = null;
  if (i) {
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
          findings.push({
            kind: 'fact',
            title: 'Sin diferencias suficientes entre formatos',
            detail:
              'Ningún otro formato supera claramente al actual en el periodo con al menos 3 publicaciones. Amplía el periodo o prueba una A/B.',
            evidence: [],
            confidence: null,
            limitation: null,
          });
        break;
      case 'compare':
        findings = pick(i.performance.findings);
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
  }
  if (
    !i ||
    intent === 'top' ||
    intent === 'networks' ||
    (intent === 'unknown' && !i)
  ) {
    findings = brandLevel(intent, ctx.peers, ctx.periodLabel);
  }
  if (!findings.length)
    unanswerable =
      'El motor local de Foxy no puede responder esta pregunta con la evidencia disponible. Prueba una de las preguntas sugeridas; las preguntas abiertas requieren un proveedor de IA autorizado (pendiente de GO).';
  return {
    question: question.slice(0, 500),
    findings,
    unanswerable,
    suggestions: (ctx.post ? SUGGESTED_QUESTIONS : BRAND_QUESTIONS)
      .filter((s) => s !== question)
      .slice(0, 4),
  };
}

function brandLevel(
  intent: Intent,
  posts: Post[],
  periodLabel: string,
): Finding[] {
  const withEng = posts
    .map((p) => ({ p, e: engagementOf(p) }))
    .filter((x): x is { p: Post; e: number } => x.e != null);
  if (withEng.length === 0)
    return [
      {
        kind: 'fact',
        title: 'Sin publicaciones con métricas en el periodo',
        detail: `No hay mediciones en ${periodLabel.toLowerCase()}.`,
        evidence: [],
        confidence: null,
        limitation: null,
      },
    ];
  if (intent === 'networks') {
    const by = new Map<string, number[]>();
    for (const { p, e } of withEng)
      by.set(PLATFORM_LABEL[p.platform], [
        ...(by.get(PLATFORM_LABEL[p.platform]) ?? []),
        e,
      ]);
    return [...by].map(([net, xs]) => ({
      kind: 'fact' as const,
      title: `${net}: mediana de engagement ${pct(median(xs)!)}`,
      detail: `${xs.length} publicaciones con métricas en ${periodLabel.toLowerCase()}.`,
      evidence: [
        {
          type: 'comparison' as const,
          label: `${xs.length} publicaciones de ${net}`,
          postId: null,
          value: pct(median(xs)!),
        },
      ],
      confidence: null,
      limitation: xs.length < 3 ? 'Base pequeña.' : null,
    }));
  }
  if (intent === 'format' || intent === 'cronopost') {
    const by = new Map<string, number[]>();
    for (const { p, e } of withEng) {
      const k = `${PLATFORM_LABEL[p.platform]} · ${formatOf(p)}`;
      by.set(k, [...(by.get(k) ?? []), e]);
    }
    return [...by]
      .filter(([, xs]) => xs.length >= 2)
      .sort((a, b) => median(b[1])! - median(a[1])!)
      .slice(0, 4)
      .map(([k, xs], idx) => ({
        kind: idx === 0 ? ('interpretation' as const) : ('fact' as const),
        title: `${k}: mediana ${pct(median(xs)!)}`,
        detail: `${xs.length} publicaciones.`,
        evidence: [
          {
            type: 'comparison' as const,
            label: k,
            postId: null,
            value: pct(median(xs)!),
          },
        ],
        confidence: xs.length >= 5 ? 'media' : 'baja',
        limitation:
          idx === 0
            ? 'Descriptivo: confirma con una prueba antes de cambiar el plan.'
            : null,
      }));
  }
  const top = [...withEng].sort((a, b) => b.e - a.e).slice(0, 3);
  return top.map(({ p, e }, idx) => ({
    kind: 'fact' as const,
    title: `${idx + 1}. ${PLATFORM_LABEL[p.platform]} · ${formatOf(p)} · engagement ${pct(e)}`,
    detail: p.body ? `«${p.body.slice(0, 100)}…»` : 'Publicación sin texto.',
    evidence: [postRef(p)],
    confidence: null,
    limitation: null,
  }));
}
