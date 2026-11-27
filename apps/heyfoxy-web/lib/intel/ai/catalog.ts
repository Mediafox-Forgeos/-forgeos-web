/**
 * Catálogo de modelos generativos VERIFICADOS (WO-HF-AI-ENGINE-001 §4).
 *
 * Solo se pueden configurar modelos de esta lista: un identificador desconocido en las
 * variables de entorno deja la IA generativa desactivada con un motivo explícito (nunca se
 * «adivina» un modelo). Fuentes oficiales consultadas el 2026-11-27:
 *   https://platform.claude.com/docs/en/about-claude/models/overview
 *   https://platform.claude.com/docs/en/about-claude/pricing
 * Precios en US$ por millón de tokens (MTok), API de Anthropic, enrutamiento global.
 */
export type ModelTier = 'fast' | 'content' | 'strategy';

export interface PriceCard {
  input: number;
  /** Escritura en caché de 5 minutos. */
  cacheWrite5m: number;
  /** Lectura de caché (aciertos y refrescos). */
  cacheRead: number;
  output: number;
}

export interface ModelInfo {
  id: string;
  label: string;
  /** Precios; `long` aplica a prompts de más de `longThreshold` tokens (Haiku 5.5). */
  price: PriceCard;
  long?: { threshold: number; price: PriceCard };
  vision: boolean;
  /** Esfuerzo por defecto del modelo en la API (se fija explícitamente por tarea). */
  defaultEffort: 'low' | 'medium' | 'high';
  /** El modelo no acepta desactivar el razonamiento (thinking siempre adaptativo). */
  thinkingAlwaysOn: boolean;
  retirementNotBefore: string;
  verifiedAt: string;
}

export const ANTHROPIC_API_VERSION = '2026-10-21';
export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

export const MODEL_CATALOG: Readonly<Record<string, ModelInfo>> = {
  'claude-haiku-5-5': {
    id: 'claude-haiku-5-5',
    label: 'Claude Haiku 5.5',
    price: { input: 0.1, cacheWrite5m: 0.125, cacheRead: 0.01, output: 0.5 },
    long: {
      threshold: 100_000,
      price: { input: 0.5, cacheWrite5m: 0.625, cacheRead: 0.05, output: 2.5 },
    },
    vision: true,
    defaultEffort: 'medium',
    thinkingAlwaysOn: false,
    retirementNotBefore: '2027-10-07',
    verifiedAt: '2026-11-27',
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5',
    label: 'Claude Sonnet 5.5',
    price: { input: 2, cacheWrite5m: 2.5, cacheRead: 0.1, output: 10 },
    vision: true,
    defaultEffort: 'high',
    thinkingAlwaysOn: false,
    retirementNotBefore: '2027-09-28',
    verifiedAt: '2026-11-27',
  },
  'claude-opus-5-5': {
    id: 'claude-opus-5-5',
    label: 'Claude Opus 5.5',
    price: { input: 4, cacheWrite5m: 5, cacheRead: 0.2, output: 20 },
    vision: true,
    defaultEffort: 'medium',
    thinkingAlwaysOn: true,
    retirementNotBefore: '2027-09-22',
    verifiedAt: '2026-11-27',
  },
};

/** Modelos recomendados por tarea (doc 25 §1); configurables por variable de entorno. */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: 'claude-haiku-5-5',
  content: 'claude-sonnet-5-5',
  strategy: 'claude-opus-5-5',
};

export const TIER_LABEL: Record<ModelTier, string> = {
  fast: 'Rápido (etiquetado)',
  content: 'Contenido y conversación',
  strategy: 'Estrategia',
};

export function modelInfo(id: string): ModelInfo | null {
  return Object.prototype.hasOwnProperty.call(MODEL_CATALOG, id)
    ? MODEL_CATALOG[id]!
    : null;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Costo en US$ de una respuesta según su `usage` (cálculo determinístico, no del modelo).
 * El razonamiento adaptativo se factura como salida y ya viene incluido en `outputTokens`.
 */
export function costOf(modelId: string, u: TokenUsage): number {
  const m = modelInfo(modelId);
  if (!m) throw new Error(`Modelo sin precio verificado: ${modelId}`);
  const prompt = u.inputTokens + u.cacheReadTokens + u.cacheWriteTokens;
  const p = m.long && prompt > m.long.threshold ? m.long.price : m.price;
  return round6(
    (u.inputTokens * p.input +
      u.cacheWriteTokens * p.cacheWrite5m +
      u.cacheReadTokens * p.cacheRead +
      u.outputTokens * p.output) /
      1_000_000,
  );
}

/**
 * Costo máximo previsible de una solicitud (para reservar presupuesto ANTES de llamar):
 * entrada estimada sin caché + todo `maxTokens` como salida.
 */
export function maxCostOf(
  modelId: string,
  estInputTokens: number,
  maxTokens: number,
): number {
  return costOf(modelId, {
    inputTokens: estInputTokens,
    outputTokens: maxTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  });
}

/**
 * Estimación conservadora de tokens de un texto (sin tokenizador local): ~3 caracteres por
 * token en español con el tokenizador de los modelos 4.7+ (≈30 % más tokens que antes).
 */
export const estimateTokens = (chars: number) => Math.ceil(chars / 3);

/** Tokens visuales de una imagen: ⌈ancho/28⌉ × ⌈alto/28⌉, tope de alta resolución 4 784. */
export function imageTokens(width: number | null, height: number | null) {
  if (!width || !height) return 4_784;
  return Math.min(4_784, Math.ceil(width / 28) * Math.ceil(height / 28));
}
