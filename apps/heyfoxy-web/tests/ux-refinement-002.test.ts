import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ supabaseServer: async () => null }));

import { canTransition } from '@/lib/brain/types';
import { conversationCoverage } from '@/lib/coverage';
import {
  executiveBrief,
  featuredPosts,
  networkInteractionBreakdown,
  networkSummaries,
  postComparison,
} from '@/lib/intel/brand';
import { analyzeCopy } from '@/lib/intel/common';
import { normalizeFinding, validateIntel } from '@/lib/intel/guard';
import {
  BRAND_QUESTIONS,
  analyzePostLocal,
  answerLocal,
  intentOf,
} from '@/lib/intel/local';
import { summarizePostIntel } from '@/lib/intel/summary';
import type { CoverageRow, Post, PostMetrics } from '@/lib/types';

/*
 * WO-HF-V2-UX-REFINEMENT-002: pruebas de los defectos encontrados en la validación del Preview
 * b499fe1. Fixtures SINTÉTICOS con la forma del piloto (Instagram y Facebook, engagement de
 * Facebook alto por su definición distinta). Ningún dato real.
 */
const T = '2026-11-25T12:00:00Z';
const m = (o: Partial<PostMetrics> = {}): PostMetrics => ({
  capturedAt: T,
  likes: 9,
  comments: 0,
  shares: 0,
  views: null,
  reach: 200,
  ...o,
});
let n = 0;
const post = (o: Partial<Post> = {}): Post => ({
  id: `r${++n}`,
  organizationId: 'org',
  platform: 'instagram',
  accountHandle: null,
  body: '[SINTÉTICO] Prevenir es cuidarte. Guárdalo para tu próximo chequeo.',
  permalink: null,
  publishedAt: T,
  isSynthetic: true,
  metrics: [m({ saves: 1, interactions: 10, engagement: 5 })],
  contentType: 'image',
  ...o,
});

// Instagram: 4 carruseles (6 %) y 3 imágenes (3 %). Facebook: 21,6 % (otra definición).
const ig = [
  ...[6.1, 6.0, 5.8, 6.3].map((e, i) =>
    post({
      contentType: 'carousel',
      metrics: [
        m({ engagement: e, interactions: 12, saves: 3 + i, reach: 200 + i }),
      ],
    }),
  ),
  ...[3.3, 3.1, 3.5].map((e) =>
    post({ metrics: [m({ engagement: e, interactions: 7, saves: 1 })] }),
  ),
];
const fb = [21.6, 7.4, 9.1].map((e) =>
  post({
    platform: 'facebook',
    contentType: 'carousel',
    metrics: [
      m({ reach: null, impressionsUnique: 37, engagement: e, interactions: 8 }),
    ],
  }),
);
const all = [...ig, ...fb];
const ctx = {
  intel: null,
  post: null,
  peers: all,
  brand: null,
  periodLabel: 'Últimos 30 días',
};

describe('Consistencia de métricas entre redes (HF-AI-12, HF-HOME-01)', () => {
  it('«¿Qué contenidos están funcionando mejor?» no ordena entre redes', () => {
    const a = answerLocal('¿Qué contenidos están funcionando mejor?', ctx);
    const titles = a.findings.map((f) => f.title);
    expect(titles.some((t) => t.startsWith('Instagram:'))).toBe(true);
    expect(titles.some((t) => t.startsWith('Facebook:'))).toBe(true);
    // Ningún hallazgo mezcla publicaciones de ambas redes.
    for (const f of a.findings) {
      const nets = new Set(
        f.evidence
          .filter((e) => e.postId)
          .map((e) => all.find((p) => p.id === e.postId)!.platform),
      );
      expect(nets.size).toBeLessThanOrEqual(1);
    }
    expect(titles).toContain('Cada red se evalúa por separado');
  });

  it('el resumen por red no suma alcance de Instagram con impresiones únicas de Facebook', () => {
    const s = networkSummaries(all);
    const igS = s.find((x) => x.platform === 'instagram')!;
    const fbS = s.find((x) => x.platform === 'facebook')!;
    expect(igS.reachLabel).toBe('Alcance');
    expect(fbS.reachLabel).toBe('Impresiones únicas');
    expect(fbS.reachSum).toBe(111);
    expect(igS.reachSum).toBe(4 * 200 + 6 + 3 * 200);
    expect(fbS.engagementBasis).toMatch(/impresiones únicas/);
  });

  it('las publicaciones destacadas se eligen dentro de cada red', () => {
    const f = featuredPosts(all);
    const fbTop = f.find((x) => x.post.platform === 'facebook')!;
    expect(fbTop.reason).toMatch(/de Facebook/);
    expect(f.filter((x) => x.metricLabel === 'Engagement').length).toBe(2);
  });

  it('la distribución agregada de una red no incluye otra red', () => {
    const b = networkInteractionBreakdown(all, 'facebook')!;
    expect(b.parts.find((p) => p.key === 'likes')!.value).toBe(27);
    expect(b.parts.some((p) => p.key === 'saves')).toBe(false);
  });

  it('la comparación de una publicación usa solo su red y su tipo de formato', () => {
    const c = postComparison(ig[0]!, all);
    expect(c.sample).toBe(6); // los otros 6 estáticos de Instagram, ningún Facebook
    expect(c.enough).toBe(true);
    const few = postComparison(fb[0]!, [fb[0]!, fb[1]!]);
    expect(few.enough).toBe(false);
    expect(few.metrics.every((x) => x.median === null)).toBe(true);
  });
});

describe('Hechos sin nivel de confianza', () => {
  it('el validador quita la confianza de un hecho, venga del proveedor que venga', () => {
    const f = normalizeFinding(
      {
        kind: 'fact',
        title: 'x',
        detail: '',
        evidence: [],
        confidence: 'alta',
        limitation: null,
      },
      new Set(),
    );
    expect(f.confidence).toBeNull();
  });

  it('ninguna respuesta de marca ni análisis de publicación pone confianza en hechos', () => {
    for (const q of BRAND_QUESTIONS) {
      const a = answerLocal(q, ctx);
      expect(
        a.findings.filter((f) => f.kind === 'fact' && f.confidence),
      ).toEqual([]);
    }
    const intel = validateIntel(
      analyzePostLocal({
        post: ig[0]!,
        peers: all,
        brand: null,
        commentsDisabled: true,
        periodLabel: '30 días',
      }),
      all.map((p) => p.id),
    );
    const facts = [
      ...intel.content.findings,
      ...intel.performance.findings,
    ].filter((f) => f.kind === 'fact');
    expect(facts.length).toBeGreaterThan(0);
    expect(facts.every((f) => f.confidence === null)).toBe(true);
  });

  it('el Executive Brief tiene entre 3 y 5 hallazgos con evidencia o acceso al detalle', () => {
    const b = executiveBrief({
      posts: all,
      brand: null,
      periodLabel: 'Últimos 30 días',
    });
    expect(b.length).toBeGreaterThanOrEqual(3);
    expect(b.length).toBeLessThanOrEqual(5);
    for (const it of b) {
      expect(it.finding.evidence.length > 0 || it.href !== null).toBe(true);
      if (it.finding.kind === 'fact') expect(it.finding.confidence).toBeNull();
    }
    // Sin Brand Brain lo dice, no lo inventa.
    expect(
      b.some(
        (x) =>
          x.area === 'strategy' &&
          /no conoce la estrategia/.test(x.finding.title),
      ),
    ).toBe(true);
    // El aprendizaje de formato es dentro de Instagram (carrusel > imagen), no entre redes.
    const l = b.find((x) => x.area === 'learning')!;
    expect(l.finding.title).toMatch(
      /En Instagram, carrusel rinde más que imagen/,
    );
  });

  it('sin publicaciones con métricas, el brief lo dice', () => {
    const b = executiveBrief({
      posts: [],
      brand: null,
      periodLabel: 'Últimos 7 días',
    });
    expect(b).toHaveLength(1);
    expect(b[0]!.finding.title).toMatch(/Sin publicaciones con métricas/);
  });
});

describe('Ask Foxy: intenciones razonables (HF-AI-13)', () => {
  it.each([
    ['¿Cómo tener más guardados?', 'saves'],
    ['¿Qué formatos deberíamos priorizar?', 'format'],
    ['¿Qué deberíamos publicar la próxima semana?', 'nextweek'],
    ['¿Estamos cumpliendo nuestra estrategia?', 'strategy'],
    ['¿Qué contenidos están funcionando mejor?', 'top'],
    ['¿Qué oportunidades creativas tenemos?', 'creative'],
    ['¿Cómo se comparan Instagram y Facebook?', 'networks'],
    ['¿Qué formato funciona mejor en cada red?', 'format'],
  ])('«%s» → %s', (q, intent) => {
    expect(intentOf(q)).toBe(intent);
  });

  it('«¿Cómo tener más guardados?» se responde con evidencia (antes se declaraba no respondible)', () => {
    const a = answerLocal('¿Cómo tener más guardados?', ctx);
    expect(a.unanswerable).toBeNull();
    expect(a.findings.some((f) => f.kind === 'recommendation')).toBe(true);
    expect(a.headline).toBeTruthy();
  });

  it('«próxima semana» devuelve una propuesta por red, no un ranking', () => {
    const a = answerLocal('¿Qué deberíamos publicar la próxima semana?', ctx);
    expect(a.findings.length).toBe(2);
    expect(a.findings.every((f) => f.kind === 'recommendation')).toBe(true);
    expect(a.findings[0]!.title).toMatch(/^Instagram: carrusel/);
    expect(
      a.findings.every((f) => /no se agenda/i.test(f.limitation ?? '')),
    ).toBe(true);
  });

  it('una pregunta sin base sigue declarándose no respondible', () => {
    const a = answerLocal('¿Cuántos seguidores nuevos tuvimos?', ctx);
    expect(a.findings).toEqual([]);
    expect(a.unanswerable).toMatch(/no puede responder/);
    expect(a.headline).toBeNull();
  });
});

describe('Repeticiones en Foxy Intelligence (HF-UX-18, HF-UX-20)', () => {
  it('copy de una frase: el CTA no repite el hook', () => {
    const one = analyzeCopy('Prevenir es cuidarte, agenda tu chequeo hoy');
    expect(one.hook).toBe('Prevenir es cuidarte, agenda tu chequeo hoy');
    expect(one.cta).toBe('agenda tu chequeo hoy');
    const same = analyzeCopy(
      'Comenta CUIDADO si crees que prevenir es fortaleza',
    );
    expect(same.ctaInHook).toBe(true);
    const two = analyzeCopy('Muchos mitos. Comenta CUIDADO si te sirvió.');
    expect(two.cta).toBe('Comenta CUIDADO si te sirvió.');
    expect(two.ctaInHook).toBe(false);
  });

  it('el motivo reputacional no repite el título «no disponible»', () => {
    const i = analyzePostLocal({
      post: { ...ig[0]!, isSynthetic: false },
      peers: all,
      brand: null,
      commentsDisabled: true,
      periodLabel: '30 días',
    });
    expect(i.reputation.status).toBe('disabled_privacy');
    expect(i.reputation.reason).not.toMatch(/no disponible/i);
  });

  it('el resumen de la publicación tiene entre 3 y 5 hallazgos sin duplicados', () => {
    const i = validateIntel(
      analyzePostLocal({
        post: ig[0]!,
        peers: all,
        brand: null,
        commentsDisabled: true,
        periodLabel: '30 días',
      }),
      all.map((p) => p.id),
    );
    const s = summarizePostIntel(i);
    expect(s.findings.length).toBeGreaterThanOrEqual(3);
    expect(s.findings.length).toBeLessThanOrEqual(5);
    expect(new Set(s.findings.map((f) => f.title)).size).toBe(
      s.findings.length,
    );
  });
});

describe('Cobertura de la conversación (Home, reputación)', () => {
  const row = (o: Partial<CoverageRow>): CoverageRow => ({
    id: 'c',
    organizationId: 'org',
    dataSourceId: 'd',
    provider: 'metricool',
    platform: 'instagram',
    dataKind: 'comments',
    status: 'complete',
    reason: null,
    accountHandle: null,
    periodStart: T,
    periodEnd: null,
    itemsIngested: 0,
    ...o,
  });
  it('distingue privacidad, no conectada, no importada, sin conversaciones y disponible', () => {
    expect(
      conversationCoverage(
        [
          row({
            status: 'not_requested',
            reason: 'Política de privacidad del piloto',
          }),
        ],
        0,
      ),
    ).toBe('privacy_disabled');
    expect(conversationCoverage([row({ dataKind: 'posts' })], 0)).toBe(
      'not_connected',
    );
    expect(
      conversationCoverage(
        [row({ status: 'not_requested', reason: 'Pendiente' })],
        0,
      ),
    ).toBe('not_imported');
    expect(conversationCoverage([row({})], 0)).toBe('no_conversations');
    expect(conversationCoverage([], 3)).toBe('available');
  });
});

describe('Revisión humana de aprendizajes (HF-BB-02)', () => {
  it('transiciones permitidas iguales a las de la migración 0008', () => {
    expect(canTransition('proposed', 'validated')).toBe(true);
    expect(canTransition('proposed', 'rejected')).toBe(true);
    expect(canTransition('validated', 'archived')).toBe(true);
    expect(canTransition('rejected', 'validated')).toBe(false);
    expect(canTransition('archived', 'archived')).toBe(false);
  });

  it('demo: rechazar exige motivo; aprobar registra quién y cuándo; no se revierte', async () => {
    const store = await import('@/lib/brain/store');
    const ORG = '00000000-0000-4000-a000-0000000000a1';
    expect(store.reviewAvailability()).toBe('full');
    const [seed] = await store.listMemory(ORG);
    expect(seed!.status).toBe('proposed');
    expect(seed!.isSynthetic).toBe(true);
    await expect(
      store.reviewMemory(ORG, seed!.id, 'rejected', ' ', 'u1'),
    ).rejects.toThrow(/motivo/);
    await store.reviewMemory(ORG, seed!.id, 'validated', 'Coincide', 'u1');
    const [after] = await store.listMemory(ORG);
    expect(after!.status).toBe('validated');
    expect(after!.reviewedBy).toBe('u1');
    expect(after!.reviewedAt).toBeTruthy();
    await expect(
      store.reviewMemory(ORG, seed!.id, 'rejected', 'Tarde', 'u1'),
    ).rejects.toThrow(/no es válida/);
  });

  it('demo: el contexto guardado en una organización sintética queda marcado como sintético', async () => {
    const store = await import('@/lib/brain/store');
    const saved = await store.saveBrandContext(
      'org-x',
      { identity: { name: '[PRUEBA]' } },
      true,
      'u1',
    );
    expect(saved.isSynthetic).toBe(true);
    expect(saved.updatedBy).toBe('u1');
  });
});
