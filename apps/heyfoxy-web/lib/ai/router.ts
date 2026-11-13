import { createHash } from 'node:crypto';
import { HeuristicProvider, type ModelProvider } from './providers';
import { PROMPT_VERSION, type ClassifyInput } from './schema';
import {
  layerFor,
  priorityScore,
  reviewRequirement,
  type PriorityContext,
} from './priority';
import type { Analysis } from '@/lib/types';

/** Presupuesto por organización (requisito I). */
export interface BudgetState {
  monthlyUsdLimit: number;
  monthlyUsdSpent: number;
  dailyItemsLimit: number;
  dailyItemsUsed: number;
  hardStop: boolean;
}

export interface UsageSink {
  record(entry: {
    organizationId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    cacheHit: boolean;
  }): Promise<void>;
}

export interface AnalysisCache {
  get(key: string): Promise<Analysis | null>;
  set(key: string, value: Analysis): Promise<void>;
}

export function inputHash(text: string, model: string): string {
  return createHash('sha256')
    .update(`${PROMPT_VERSION}|${model}|${text.trim()}`)
    .digest('hex')
    .slice(0, 40);
}

export type BudgetDecision = 'allow' | 'fallback' | 'block';

export function budgetDecision(
  b: BudgetState,
  estimatedCostUsd: number,
): BudgetDecision {
  const overItems = b.dailyItemsUsed >= b.dailyItemsLimit;
  const overUsd = b.monthlyUsdSpent + estimatedCostUsd > b.monthlyUsdLimit;
  if (!overItems && !overUsd) return 'allow';
  // Sin presupuesto: si hard_stop, se usa heurística local (costo 0) y nunca se
  // supera el gasto; si se agotaron los items diarios, se bloquea.
  if (overItems) return 'block';
  return b.hardStop ? 'fallback' : 'allow';
}

/**
 * Orquesta la clasificación: caché por hash (dedupe de costo), presupuesto,
 * respaldo heurístico y registro de uso.
 */
export async function analyzeItem(
  input: ClassifyInput,
  deps: {
    provider: ModelProvider;
    budget: BudgetState;
    cache: AnalysisCache;
    usage: UsageSink;
    ctx?: PriorityContext;
    estimatedCostUsd?: number;
  },
): Promise<{ analysis: Analysis | null; decision: BudgetDecision | 'cache' }> {
  const key = inputHash(input.text, deps.provider.model);
  const cached = await deps.cache.get(key);
  if (cached) {
    await deps.usage.record({
      organizationId: input.organizationId,
      provider: cached.provider,
      model: cached.model,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      cacheHit: true,
    });
    return { analysis: cached, decision: 'cache' };
  }
  const decision = budgetDecision(deps.budget, deps.estimatedCostUsd ?? 0.0005);
  if (decision === 'block') return { analysis: null, decision };
  let provider =
    decision === 'fallback' ? new HeuristicProvider() : deps.provider;
  let out;
  try {
    out = await provider.classify(input);
  } catch {
    provider = new HeuristicProvider();
    out = await provider.classify(input);
  }
  const score = priorityScore(out.result, deps.ctx);
  const analysis: Analysis = {
    sentiment: out.result.sentiment,
    intent: out.result.intent,
    topics: out.result.topics,
    severity: out.result.severity,
    confidence: out.result.confidence,
    explanation: out.result.explanation,
    priorityScore: score,
    layer: layerFor(out.result, score, deps.ctx),
    reviewStatus: reviewRequirement(out.result, score),
    provider: provider.id,
    model: provider.model,
  };
  await deps.cache.set(key, analysis);
  await deps.usage.record({
    organizationId: input.organizationId,
    provider: provider.id,
    model: provider.model,
    ...out.usage,
    cacheHit: false,
  });
  return { analysis, decision };
}
