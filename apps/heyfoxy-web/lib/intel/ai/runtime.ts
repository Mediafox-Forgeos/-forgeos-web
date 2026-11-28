import 'server-only';
import { dataMode } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';
import { AnthropicProvider } from './anthropic';
import {
  DEFAULT_MODELS,
  TIER_LABEL,
  modelInfo,
  type ModelTier,
} from './catalog';
import { MemoryBudgetStore, type AiUsageSummary } from './budget';
import { engineReadiness, readAiConfig } from './config';
import { MemoryGenCache, type EngineDeps } from './engine';
import { FixtureProvider } from './fixture';
import { fetchImageSafely } from './media';
import type { GenerativeProvider } from './provider';
import {
  SupabaseBudgetStore,
  SupabaseGenCache,
  aiPersistenceReady,
  aiSafetyReady,
  campaignLimitsDb,
  orgIsDemoDb,
} from './supabase-stores';
import { readSyntheticImage } from './synthetic-media-server';

/**
 * Ensambla el motor generativo desde el entorno del servidor (WO-HF-AI-ENGINE-001 §3, §11).
 * Demo: presupuesto y caché en memoria del proceso (compartidos en globalThis). Supabase:
 * solo con 0009 aplicada (HF_MIGRATION_0009_APPLIED); si no, el motor no se activa.
 */
const g = globalThis as unknown as {
  __hfAiDemo?: { budget: MemoryBudgetStore; cache: MemoryGenCache };
};
g.__hfAiDemo ??= {
  budget: new MemoryBudgetStore(),
  cache: new MemoryGenCache(),
};

function provider(): GenerativeProvider | null {
  const cfg = readAiConfig();
  if (cfg.provider === 'fixture') return new FixtureProvider();
  if (cfg.provider === 'anthropic' && cfg.apiKeyPresent)
    return new AnthropicProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
    });
  return null;
}

export function engineDeps(): EngineDeps {
  const config = readAiConfig();
  const mode = dataMode();
  const persistent = mode === 'supabase' && aiPersistenceReady();
  return {
    config,
    provider: provider(),
    budget: persistent ? new SupabaseBudgetStore() : g.__hfAiDemo!.budget,
    cache: persistent ? new SupabaseGenCache() : g.__hfAiDemo!.cache,
    dataMode: mode,
    migration0009: persistent,
    migration0010: mode === 'demo' || (persistent && aiSafetyReady()),
    // Demo: todas las organizaciones son ficticias (memoria del proceso, sin base).
    orgIsDemo: async (orgId) => (mode === 'demo' ? true : orgIsDemoDb(orgId)),
    orgBudget: async (orgId) => {
      if (mode === 'demo')
        return { monthlyUsd: config.limits.orgMonthlyCapUsd, dailyItems: 200 };
      const db = await supabaseServer();
      const { data } = await db
        .from('usage_budgets')
        .select('ai_monthly_usd, ai_daily_items')
        .eq('organization_id', orgId)
        .maybeSingle();
      return {
        monthlyUsd: Number(
          data?.ai_monthly_usd ?? config.limits.orgMonthlyCapUsd,
        ),
        dailyItems: Number(data?.ai_daily_items ?? 200),
        campaign: aiSafetyReady() ? await campaignLimitsDb(orgId) : null,
      };
    },
    fetchImage: (url, signal) => fetchImageSafely(url, { signal }),
    readSyntheticImage,
  };
}

/** Resumen PÚBLICO del motor (sin valores de claves) para la interfaz y «Uso y presupuestos». */
export interface PublicAiStatus {
  mode: 'local' | 'generative' | 'simulated' | 'unavailable';
  label: string;
  reason: string;
  provider: string;
  apiKeyConfigured: boolean;
  models: Array<{
    tier: ModelTier;
    tierLabel: string;
    id: string;
    label: string;
    verified: boolean;
    isDefault: boolean;
  }>;
  realDataOrgs: number;
  multimodalOrgs: number;
  orgRealDataAuthorized: boolean;
  orgMultimodalAuthorized: boolean;
  limits: {
    orgMonthlyCapUsd: number;
    syntheticCapUsd: number;
    userDailyRequests: number;
    orgConcurrency: number;
  };
  issues: string[];
  persistence: 'memory' | 'supabase' | 'pending_0009';
}

/** Campaña de pruebas en curso para «Uso y presupuestos» (0010). */
export interface CampaignStatus {
  usd: number | null;
  calls: number | null;
  since: string | null;
  spentUsd: number;
  realCalls: number;
}

export function publicAiStatus(orgId?: string): PublicAiStatus {
  const cfg = readAiConfig();
  const mode = dataMode();
  const persistent = mode === 'supabase' && aiPersistenceReady();
  const ready = engineReadiness(cfg, {
    dataMode: mode,
    migration0009: persistent,
    migration0010: mode === 'demo' || (persistent && aiSafetyReady()),
  });
  const m: PublicAiStatus['mode'] =
    cfg.provider === 'local'
      ? 'local'
      : !ready.ready
        ? 'unavailable'
        : cfg.provider === 'fixture'
          ? 'simulated'
          : 'generative';
  return {
    mode: m,
    label:
      m === 'generative'
        ? `IA generativa disponible · ${modelInfo(cfg.modelIds.content)?.label ?? cfg.modelIds.content}`
        : m === 'simulated'
          ? 'Simulación con fixtures · sin IA real'
          : 'Motor local por reglas · sin IA generativa',
    reason: ready.reason,
    provider: cfg.provider,
    apiKeyConfigured: cfg.apiKeyPresent,
    models: (['fast', 'content', 'strategy'] as const).map((tier) => ({
      tier,
      tierLabel: TIER_LABEL[tier],
      id: cfg.modelIds[tier],
      label: cfg.models[tier]?.label ?? 'Sin verificar',
      verified: !!cfg.models[tier],
      isDefault: cfg.modelIds[tier] === DEFAULT_MODELS[tier],
    })),
    realDataOrgs: cfg.realDataOrgs.length,
    multimodalOrgs: cfg.multimodalOrgs.length,
    orgRealDataAuthorized:
      !!orgId && cfg.realDataOrgs.includes(orgId.toLowerCase()),
    orgMultimodalAuthorized:
      !!orgId && cfg.multimodalOrgs.includes(orgId.toLowerCase()),
    limits: cfg.limits,
    issues: cfg.issues,
    persistence:
      mode === 'demo' ? 'memory' : persistent ? 'supabase' : 'pending_0009',
  };
}

export async function aiUsageSummary(
  orgId: string,
): Promise<(AiUsageSummary & { campaign: CampaignStatus | null }) | null> {
  const deps = engineDeps();
  if (deps.dataMode === 'supabase' && !deps.migration0009) return null;
  const b = await deps.orgBudget(orgId);
  const summary = await deps.budget.summary(
    orgId,
    Math.min(b.monthlyUsd, deps.config.limits.orgMonthlyCapUsd),
  );
  const camp = b.campaign ?? null;
  return {
    ...summary,
    campaign: camp
      ? {
          ...camp,
          ...(await deps.budget.campaignUsage(orgId, camp.since)),
        }
      : null,
  };
}

/** Insignia del motor disponible para la organización activa (sin secretos). */
export function engineBadge(orgId?: string): {
  state: 'local' | 'available' | 'simulated';
  label: string;
} {
  const st = publicAiStatus(orgId);
  if (st.mode === 'generative') return { state: 'available', label: st.label };
  if (st.mode === 'simulated') return { state: 'simulated', label: st.label };
  if (st.mode === 'unavailable')
    return {
      state: 'local',
      label: 'Motor local por reglas · IA generativa no disponible',
    };
  return {
    state: 'local',
    label: 'Motor local por reglas · sin IA generativa',
  };
}
