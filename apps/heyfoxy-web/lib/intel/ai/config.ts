import {
  DEFAULT_MODELS,
  modelInfo,
  type ModelInfo,
  type ModelTier,
} from './catalog';

/**
 * Configuración del Foxy Intelligence Engine generativo (WO-HF-AI-ENGINE-001 §11).
 *
 * Todo se lee de variables de entorno del SERVIDOR; nada de esto llega al navegador salvo el
 * resumen público de `publicAiStatus` (sin valores de claves). Por defecto: motor local.
 *
 *  HF_AI_CONTENT_PROVIDER   local (defecto) | anthropic | fixture (solo desarrollo local)
 *  ANTHROPIC_API_KEY        clave del workspace heyfoxy-preview (Sensitive, solo Preview)
 *  HF_AI_MODEL_FAST         defecto claude-haiku-5-5
 *  HF_AI_MODEL_CONTENT      defecto claude-sonnet-5-5
 *  HF_AI_MODEL_STRATEGY     defecto claude-opus-5-5
 *  HF_AI_REAL_DATA_ORGS     UUID separados por coma; VACÍA por defecto (ningún dato real sale)
 *  HF_AI_MULTIMODAL_ORGS    UUID separados por coma; VACÍA por defecto (sin imágenes reales)
 *  HF_AI_KILL_SWITCH        on = IA generativa apagada (también ai_kill_switch en la base)
 *  HF_AI_ORG_MONTHLY_CAP_USD  tope duro por organización (defecto 15; la base puede fijar menos)
 *  HF_AI_SYNTHETIC_CAP_USD    tope total de pruebas sintéticas (defecto 5)
 *  HF_AI_USER_DAILY_REQUESTS  solicitudes generativas por usuario y día (defecto 40)
 *  HF_AI_ORG_CONCURRENCY      llamadas simultáneas por organización (defecto 2)
 *
 * NUNCA se leen HF_AI_PROVIDER ni OPENAI_API_KEY aquí: pertenecen al clasificador V1.
 */
export type ProviderId = 'local' | 'anthropic' | 'fixture';

export interface AiConfig {
  provider: ProviderId;
  /** Hay una clave con el formato esperado (nunca se expone su valor). */
  apiKeyPresent: boolean;
  models: Record<ModelTier, ModelInfo | null>;
  modelIds: Record<ModelTier, string>;
  realDataOrgs: string[];
  multimodalOrgs: string[];
  killSwitch: boolean;
  limits: {
    orgMonthlyCapUsd: number;
    syntheticCapUsd: number;
    userDailyRequests: number;
    orgConcurrency: number;
  };
  /** Problemas que impiden activar la IA generativa (motivos legibles). */
  issues: string[];
}

type Env = Record<string, string | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function orgList(raw: string | undefined, name: string, issues: string[]) {
  const ids = (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const bad = ids.filter((s) => !UUID.test(s));
  if (bad.length)
    issues.push(
      `${name} contiene ${bad.length} valor(es) que no son UUID de organización: se ignoran.`,
    );
  return ids.filter((s) => UUID.test(s)).map((s) => s.toLowerCase());
}

function positive(
  raw: string | undefined,
  def: number,
  max: number,
  name: string,
  issues: string[],
) {
  if (raw == null || raw === '') return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    issues.push(`${name} no es válido; se usa ${def}.`);
    return def;
  }
  return n;
}

/** ¿Se permite el proveedor de fixtures? Solo en desarrollo local, nunca en Vercel. */
export function fixtureAllowed(env: Env): boolean {
  return env.NODE_ENV !== 'production' && !env.VERCEL && !env.VERCEL_ENV;
}

export function readAiConfig(env: Env = process.env): AiConfig {
  const issues: string[] = [];
  const raw = (env.HF_AI_CONTENT_PROVIDER ?? 'local').trim().toLowerCase();
  let provider: ProviderId = 'local';
  if (raw === 'anthropic') provider = 'anthropic';
  else if (raw === 'fixture') {
    if (fixtureAllowed(env)) provider = 'fixture';
    else
      issues.push(
        'El proveedor de fixtures solo funciona en desarrollo local: se usa el motor local.',
      );
  } else if (raw !== 'local')
    issues.push(
      `Proveedor «${raw}» desconocido: se usa el motor local (valores: local, anthropic).`,
    );

  const key = env.ANTHROPIC_API_KEY ?? '';
  const apiKeyPresent = /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim());
  if (provider === 'anthropic' && !key)
    issues.push('Falta ANTHROPIC_API_KEY (solo entorno Preview, Sensitive).');
  else if (provider === 'anthropic' && !apiKeyPresent)
    issues.push('ANTHROPIC_API_KEY no tiene el formato esperado (sk-ant-…).');

  const envName: Record<ModelTier, string> = {
    fast: 'HF_AI_MODEL_FAST',
    content: 'HF_AI_MODEL_CONTENT',
    strategy: 'HF_AI_MODEL_STRATEGY',
  };
  const modelIds = {} as Record<ModelTier, string>;
  const models = {} as Record<ModelTier, ModelInfo | null>;
  for (const tier of ['fast', 'content', 'strategy'] as const) {
    const id = (env[envName[tier]] ?? '').trim() || DEFAULT_MODELS[tier];
    modelIds[tier] = id;
    models[tier] = modelInfo(id);
    if (!models[tier])
      issues.push(
        `${envName[tier]}=«${id}» no está en el catálogo verificado: requiere verificar el modelo y su tarifa antes de usarlo.`,
      );
  }

  return {
    provider,
    apiKeyPresent,
    models,
    modelIds,
    realDataOrgs: orgList(
      env.HF_AI_REAL_DATA_ORGS,
      'HF_AI_REAL_DATA_ORGS',
      issues,
    ),
    multimodalOrgs: orgList(
      env.HF_AI_MULTIMODAL_ORGS,
      'HF_AI_MULTIMODAL_ORGS',
      issues,
    ),
    killSwitch: (env.HF_AI_KILL_SWITCH ?? '').trim().toLowerCase() === 'on',
    limits: {
      orgMonthlyCapUsd: positive(
        env.HF_AI_ORG_MONTHLY_CAP_USD,
        15,
        500,
        'HF_AI_ORG_MONTHLY_CAP_USD',
        issues,
      ),
      syntheticCapUsd: positive(
        env.HF_AI_SYNTHETIC_CAP_USD,
        5,
        100,
        'HF_AI_SYNTHETIC_CAP_USD',
        issues,
      ),
      userDailyRequests: Math.floor(
        positive(
          env.HF_AI_USER_DAILY_REQUESTS,
          40,
          1000,
          'HF_AI_USER_DAILY_REQUESTS',
          issues,
        ),
      ),
      orgConcurrency: Math.max(
        1,
        Math.floor(
          positive(
            env.HF_AI_ORG_CONCURRENCY,
            2,
            10,
            'HF_AI_ORG_CONCURRENCY',
            issues,
          ),
        ),
      ),
    },
    issues,
  };
}

/**
 * ¿Está el motor generativo listo a nivel de plataforma? (antes de mirar la organización, el
 * presupuesto y los datos). `reason` siempre explica por qué no.
 */
export function engineReadiness(
  cfg: AiConfig,
  opts: { dataMode: 'demo' | 'supabase'; migration0009: boolean },
): { ready: boolean; reason: string } {
  if (cfg.killSwitch)
    return {
      ready: false,
      reason: 'Interruptor de emergencia de IA activo (HF_AI_KILL_SWITCH).',
    };
  if (cfg.provider === 'local')
    return {
      ready: false,
      reason: 'IA generativa no activada: motor local por reglas.',
    };
  const blocking = cfg.issues.filter(
    (i) =>
      i.startsWith('Falta') ||
      i.startsWith('ANTHROPIC_API_KEY') ||
      i.includes('catálogo verificado'),
  );
  if (blocking.length) return { ready: false, reason: blocking[0]! };
  if (opts.dataMode === 'supabase' && !opts.migration0009)
    return {
      ready: false,
      reason:
        'La IA generativa requiere la migración 0009 (presupuesto y registro de consumo) aplicada: pendiente de GO.',
    };
  return { ready: true, reason: 'IA generativa disponible.' };
}

/** Clasificación de los datos de entrada para decidir si pueden salir al proveedor. */
export function dataClearance(
  cfg: AiConfig,
  orgId: string,
  syntheticInput: boolean,
): { allowed: boolean; reason: string } {
  if (syntheticInput)
    return { allowed: true, reason: 'Entrada sintética de prueba.' };
  if (cfg.realDataOrgs.includes(orgId.toLowerCase()))
    return {
      allowed: true,
      reason:
        'Organización autorizada para datos reales (HF_AI_REAL_DATA_ORGS).',
    };
  return {
    allowed: false,
    reason:
      'Datos reales sin autorización específica para un proveedor externo: se usa el motor local.',
  };
}

export function multimodalClearance(
  cfg: AiConfig,
  orgId: string,
  syntheticInput: boolean,
) {
  return syntheticInput || cfg.multimodalOrgs.includes(orgId.toLowerCase());
}
