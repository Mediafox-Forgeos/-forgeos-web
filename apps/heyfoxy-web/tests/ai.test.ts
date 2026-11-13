import { describe, expect, it } from 'vitest';
import {
  HeuristicProvider,
  OpenAIProvider,
  providerFromEnv,
} from '@/lib/ai/providers';
import {
  analyzeItem,
  budgetDecision,
  type AnalysisCache,
} from '@/lib/ai/router';
import { layerFor, priorityScore, reviewRequirement } from '@/lib/ai/priority';
import type { Classification } from '@/lib/ai/schema';
import type { Analysis } from '@/lib/types';

const base: Classification = {
  sentiment: 'negative',
  intent: 'complaint',
  topics: [],
  severity: 'attention',
  confidence: 0.8,
  explanation: 'x',
  risk_flags: [],
};
const memCache = (): AnalysisCache & { m: Map<string, Analysis> } => {
  const m = new Map<string, Analysis>();
  return {
    m,
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => void m.set(k, v),
  };
};
const budget = {
  monthlyUsdLimit: 30,
  monthlyUsdSpent: 0,
  dailyItemsLimit: 100,
  dailyItemsUsed: 0,
  hardStop: true,
};

describe('prioridad reputacional', () => {
  it('una queja simple no es crisis', () => {
    const s = priorityScore(base);
    expect(s).toBeLessThan(60);
    expect(layerFor(base, s)).toBe('operational');
    expect(reviewRequirement(base, s)).toBe('not_required');
  });
  it('señal crítica con riesgo de salud => reputacional y revisión obligatoria', () => {
    const c: Classification = {
      ...base,
      severity: 'critical',
      intent: 'crisis_signal',
      risk_flags: ['health_safety'],
    };
    const s = priorityScore(c, { reach: 50000 });
    expect(s).toBeGreaterThanOrEqual(80);
    expect(layerFor(c, s)).toBe('reputational');
    expect(reviewRequirement(c, s)).toBe('pending');
  });
  it('baja confianza en algo relevante exige revisión', () => {
    const c: Classification = { ...base, severity: 'high', confidence: 0.4 };
    expect(reviewRequirement(c, priorityScore(c))).toBe('pending');
  });
  it('anomalía de volumen eleva prioridad y capa', () => {
    expect(priorityScore(base, { volumeRatio: 3 })).toBeGreaterThan(
      priorityScore(base),
    );
    expect(layerFor(base, priorityScore(base), { volumeRatio: 3 })).toBe(
      'reputational',
    );
  });
  it('spam queda acotado', () => {
    expect(
      priorityScore({ ...base, intent: 'spam', severity: 'high' }),
    ).toBeLessThanOrEqual(10);
  });
  it('score siempre en [0,100]', () => {
    const c: Classification = {
      ...base,
      severity: 'critical',
      intent: 'crisis_signal',
      risk_flags: ['health_safety', 'legal', 'threat', 'fraud'],
      confidence: 1,
    };
    expect(
      priorityScore(c, { reach: 1e9, volumeRatio: 100, recurrence: 100 }),
    ).toBeLessThanOrEqual(100);
  });
});

describe('clasificador heurístico', () => {
  const h = new HeuristicProvider();
  it('detecta riesgo legal', async () => {
    const { result } = await h.classify({
      organizationId: 'o',
      text: 'Voy a poner una tutela ante Supersalud',
      platform: 'x',
      brand: null,
    });
    expect(result.risk_flags).toContain('legal');
    expect(result.sentiment).toBe('negative');
  });
  it('detecta elogio', async () => {
    const { result } = await h.classify({
      organizationId: 'o',
      text: 'Excelente atención, muy amables, gracias',
      platform: 'x',
      brand: null,
    });
    expect(result.sentiment).toBe('positive');
    expect(result.intent).toBe('praise');
  });
  it('señal de crisis de salud => crítica', async () => {
    const { result } = await h.classify({
      organizationId: 'o',
      text: 'posible infección tras el procedimiento',
      platform: 'x',
      brand: null,
    });
    expect(result.severity).toBe('critical');
    expect(result.intent).toBe('crisis_signal');
  });
  it('costo cero', async () => {
    const { usage } = await h.classify({
      organizationId: 'o',
      text: 'hola',
      platform: 'x',
      brand: null,
    });
    expect(usage.costUsd).toBe(0);
  });
});

describe('router IA: caché, presupuesto, respaldo', () => {
  it('caché evita doble análisis del mismo texto', async () => {
    const cache = memCache();
    const usage: unknown[] = [];
    const deps = {
      provider: new HeuristicProvider(),
      budget,
      cache,
      usage: { record: async (e: unknown) => void usage.push(e) },
    };
    const input = {
      organizationId: 'o',
      text: 'La app no sirve',
      platform: 'x',
      brand: null,
    };
    expect((await analyzeItem(input, deps)).decision).toBe('allow');
    expect((await analyzeItem(input, deps)).decision).toBe('cache');
    expect(cache.m.size).toBe(1);
  });
  it('límite diario de items bloquea', () => {
    expect(budgetDecision({ ...budget, dailyItemsUsed: 100 }, 0.001)).toBe(
      'block',
    );
  });
  it('presupuesto USD agotado con hard stop => respaldo heurístico', () => {
    expect(budgetDecision({ ...budget, monthlyUsdSpent: 30 }, 0.001)).toBe(
      'fallback',
    );
  });
  it('si el proveedor externo falla se usa heurística', async () => {
    const failing = new OpenAIProvider(
      'm',
      'k',
      { inPerM: 0, outPerM: 0 },
      (async () => new Response('x', { status: 500 })) as typeof fetch,
    );
    const r = await analyzeItem(
      {
        organizationId: 'o',
        text: 'pésimo servicio',
        platform: 'x',
        brand: null,
      },
      {
        provider: failing,
        budget,
        cache: memCache(),
        usage: { record: async () => {} },
      },
    );
    expect(r.analysis?.provider).toBe('heuristic');
  });
  it('OpenAI: valida JSON y calcula costo', async () => {
    const fake = (async () =>
      Response.json({
        output_text: JSON.stringify({ ...base, risk_flags: [] }),
        usage: { input_tokens: 1000, output_tokens: 100 },
      })) as typeof fetch;
    const p = new OpenAIProvider(
      'm',
      'k',
      { inPerM: 0.15, outPerM: 0.6 },
      fake,
    );
    const { result, usage } = await p.classify({
      organizationId: 'o',
      text: 't',
      platform: 'x',
      brand: null,
    });
    expect(result.sentiment).toBe('negative');
    expect(usage.costUsd).toBeCloseTo(0.00021, 6);
  });
  it('OpenAI: salida inválida es rechazada', async () => {
    const fake = (async () =>
      Response.json({
        output_text: '{"sentiment":"furious"}',
      })) as typeof fetch;
    await expect(
      new OpenAIProvider('m', 'k', undefined, fake).classify({
        organizationId: 'o',
        text: 't',
        platform: 'x',
        brand: null,
      }),
    ).rejects.toThrow();
  });
  it('sin API key el proveedor por defecto es heurístico', () => {
    expect(
      providerFromEnv({
        HF_AI_PROVIDER: 'openai',
      } as unknown as NodeJS.ProcessEnv).id,
    ).toBe('heuristic');
  });
});
