import { randomUUID } from 'node:crypto';
import { modelInfo, type ModelTier } from './catalog';
import type { BudgetLimits, BudgetStore, CampaignLimits } from './budget';
import { dataClearance, engineReadiness, type AiConfig } from './config';
import type { MediaCoverage } from './media';
import type { GenerativeProvider } from './provider';

/**
 * Dependencias y decisión del motor generativo. Todo se inyecta (proveedor, presupuesto,
 * caché, descarga de imágenes, reloj): las pruebas ejercitan el flujo completo con fixtures
 * y `fetch` simulado, sin red ni costo.
 */
export type FallbackCode =
  | 'not_enabled'
  | 'misconfigured'
  | 'kill_switch'
  | 'not_authorized_data'
  | 'sensitive'
  | 'budget'
  | 'provider_error'
  | 'invalid_output'
  | 'isolation';

/** Respaldos que se registran en el consumo (la IA generativa estaba habilitada). */
export const FALLBACK_NOTED: FallbackCode[] = [
  'kill_switch',
  'sensitive',
  'budget',
  'provider_error',
  'invalid_output',
];

/** Estado visible del motor en una respuesta (DS · EngineStatus). */
export type EngineState = 'local' | 'generative' | 'simulated' | 'fallback';

export interface GenMeta {
  state: EngineState;
  provider: string;
  model: string;
  modelLabel: string;
  local: boolean;
  /** Respuesta de fixtures (simulada): nunca se presenta como IA real. */
  simulated: boolean;
  cached: boolean;
  generatedAt: string;
  syntheticInput: boolean;
  promptVersion: string;
  brandVersion: number | null;
  brandStatus: 'ok' | 'partial' | 'missing';
  mediaCoverage: MediaCoverage | null;
  mediaStatement: string | null;
  costUsd: number;
  fallback: { code: FallbackCode; reason: string } | null;
  /** Evidencias citadas por el modelo que no existían (descartadas). */
  droppedEvidence: number;
  /** Ajustes aplicados por reglas de negocio (p. ej. recomendación → hipótesis). */
  adjustments: string[];
  inputHash: string | null;
  /** Hash del contexto (datos + Brand Brain, sin imagen): detecta análisis desactualizados. */
  contextHash: string | null;
}

export interface GenCacheEntry<T> {
  inputHash: string;
  value: T;
  meta: GenMeta;
}

export interface GenCacheStore {
  get<T>(
    orgId: string,
    subject: string,
    inputHash: string,
  ): Promise<GenCacheEntry<T> | null>;
  latest<T>(orgId: string, subject: string): Promise<GenCacheEntry<T> | null>;
  put<T>(
    orgId: string,
    subject: string,
    entry: GenCacheEntry<T>,
    synthetic: boolean,
  ): Promise<void>;
}

export class MemoryGenCache implements GenCacheStore {
  private rows = new Map<string, GenCacheEntry<unknown>[]>();
  async get<T>(orgId: string, subject: string, hash: string) {
    const hit = (this.rows.get(`${orgId}|${subject}`) ?? []).find(
      (r) => r.inputHash === hash,
    );
    return (hit as GenCacheEntry<T>) ?? null;
  }
  async latest<T>(orgId: string, subject: string) {
    return (
      ((this.rows.get(`${orgId}|${subject}`) ?? []).at(
        -1,
      ) as GenCacheEntry<T>) ?? null
    );
  }
  async put<T>(orgId: string, subject: string, entry: GenCacheEntry<T>) {
    const k = `${orgId}|${subject}`;
    const list = (this.rows.get(k) ?? []).filter(
      (r) => r.inputHash !== entry.inputHash,
    );
    list.push(entry as GenCacheEntry<unknown>);
    this.rows.set(k, list.slice(-10));
  }
}

export interface EngineDeps {
  config: AiConfig;
  provider: GenerativeProvider | null;
  budget: BudgetStore;
  cache: GenCacheStore;
  dataMode: 'demo' | 'supabase';
  migration0009: boolean;
  /** 0010: clasificación sintética impuesta por la base y topes de campaña (HF-BB-05). */
  migration0010: boolean;
  /**
   * ¿La organización es de demostración? Lo decide el SERVIDOR (organizations.is_demo, que
   * ningún usuario puede cambiar). La marca sintética de los datos solo vale si es true.
   */
  orgIsDemo: (orgId: string) => Promise<boolean>;
  /** Presupuesto configurado en la base para la organización (usage_budgets). */
  orgBudget: (orgId: string) => Promise<{
    monthlyUsd: number;
    dailyItems: number;
    /** Tope acumulado de la campaña de pruebas (0010); null = sin tope de campaña. */
    campaign?: CampaignLimits | null;
  }>;
  fetchImage?: (
    url: string,
    signal?: AbortSignal,
  ) => Promise<{ mediaType: string; base64: string; bytes: number }>;
  /** Imágenes sintéticas propias empaquetadas (solo organizaciones demo; sin red). */
  readSyntheticImage?: (
    path: string,
  ) => Promise<{ mediaType: string; base64: string; bytes: number }>;
  newId?: () => string;
}

export type GenDecision =
  | { use: 'generative'; tier: ModelTier; model: string }
  | { use: 'local'; code: FallbackCode; reason: string };

function readinessDecision(deps: EngineDeps): GenDecision | null {
  const ready = engineReadiness(deps.config, {
    dataMode: deps.dataMode,
    migration0009: deps.migration0009,
    migration0010: deps.migration0010,
  });
  if (!ready.ready || !deps.provider)
    return {
      use: 'local',
      code: deps.config.killSwitch
        ? 'kill_switch'
        : deps.config.provider === 'local'
          ? 'not_enabled'
          : 'misconfigured',
      reason: ready.reason,
    };
  return null;
}

export type OrgGate =
  | { use: 'continue'; isDemo: boolean }
  | { use: 'local'; code: FallbackCode; reason: string; isDemo: boolean };

/**
 * Primera barrera, ANTES de cargar o construir cualquier contexto o solicitud: una
 * organización real que no figura en HF_AI_REAL_DATA_ORGS nunca llega al proveedor, por
 * ninguna ruta (análisis de contenido, Ask Foxy general, lateral o contextual). Si el motor
 * no está habilitado también se corta aquí. No consulta presupuesto ni proveedor.
 */
export async function orgGate(
  deps: EngineDeps,
  orgId: string,
): Promise<OrgGate> {
  const notReady = readinessDecision(deps);
  if (notReady && notReady.use === 'local')
    return { ...notReady, isDemo: false };
  let isDemo = false;
  try {
    isDemo = await deps.orgIsDemo(orgId);
  } catch {
    return {
      use: 'local',
      code: 'not_authorized_data',
      reason:
        'No se pudo verificar la clasificación de la organización: no se envía nada al proveedor.',
      isDemo: false,
    };
  }
  if (!isDemo && !deps.config.realDataOrgs.includes(orgId.toLowerCase()))
    return {
      use: 'local',
      code: 'not_authorized_data',
      reason:
        'Datos reales no autorizados para IA generativa en esta organización (HF_AI_REAL_DATA_ORGS): se usa el motor local por reglas.',
      isDemo,
    };
  return { use: 'continue', isDemo };
}

export async function decideGenerative(
  deps: EngineDeps,
  args: {
    orgId: string;
    syntheticInput: boolean;
    orgIsDemo: boolean;
    tier: ModelTier;
  },
): Promise<GenDecision> {
  const notReady = readinessDecision(deps);
  if (notReady) return notReady;
  if (await deps.budget.killSwitch())
    return {
      use: 'local',
      code: 'kill_switch',
      reason: 'Interruptor de emergencia de IA activo (ai_kill_switch).',
    };
  const clearance = dataClearance(
    deps.config,
    args.orgId,
    args.syntheticInput,
    args.orgIsDemo,
  );
  if (!clearance.allowed)
    return {
      use: 'local',
      code: 'not_authorized_data',
      reason: clearance.reason,
    };
  const model = deps.config.modelIds[args.tier];
  if (!modelInfo(model))
    return {
      use: 'local',
      code: 'misconfigured',
      reason: `Modelo «${model}» sin verificar.`,
    };
  return { use: 'generative', tier: args.tier, model };
}

export async function limitsFor(
  deps: EngineDeps,
  orgId: string,
): Promise<BudgetLimits> {
  const b = await deps.orgBudget(orgId);
  return {
    orgMonthlyUsd: Math.min(b.monthlyUsd, deps.config.limits.orgMonthlyCapUsd),
    campaign: b.campaign ?? null,
    orgDailyItems: b.dailyItems,
    syntheticCapUsd: deps.config.limits.syntheticCapUsd,
    userDailyRequests: deps.config.limits.userDailyRequests,
    orgConcurrency: deps.config.limits.orgConcurrency,
  };
}

export const newRequestId = (deps: EngineDeps) => (deps.newId ?? randomUUID)();

export function localMeta(args: {
  promptVersion: string;
  syntheticInput: boolean;
  brandVersion: number | null;
  brandStatus: GenMeta['brandStatus'];
  fallback: GenMeta['fallback'];
}): GenMeta {
  return {
    state:
      args.fallback && args.fallback.code !== 'not_enabled'
        ? 'fallback'
        : 'local',
    provider: 'local',
    model: 'reglas-foxy-v1',
    modelLabel: 'Motor local por reglas',
    local: true,
    simulated: false,
    cached: false,
    generatedAt: new Date().toISOString(),
    syntheticInput: args.syntheticInput,
    promptVersion: args.promptVersion,
    brandVersion: args.brandVersion,
    brandStatus: args.brandStatus,
    mediaCoverage: null,
    mediaStatement: null,
    costUsd: 0,
    fallback: args.fallback,
    droppedEvidence: 0,
    adjustments: [],
    inputHash: null,
    contextHash: null,
  };
}
