import type { ModelTier, TokenUsage } from './catalog';

/**
 * Contrato de un proveedor generativo intercambiable (WO-HF-AI-ENGINE-001 §3). El motor no
 * conoce detalles de Anthropic: cualquier proveedor que cumpla esta interfaz (y pase la
 * misma validación de salida) puede sustituirlo.
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    };

export interface GenMessage {
  role: 'user' | 'assistant';
  content: ContentBlock[];
}

export interface GenRequest {
  tier: ModelTier;
  model: string;
  /** Instrucciones del sistema (versionadas). Se marcan para caché de prompts. */
  system: string;
  /** Contexto estable y extenso (Brand Brain) que conviene cachear aparte. */
  cachedContext?: string;
  messages: GenMessage[];
  maxTokens: number;
  effort: 'low' | 'medium' | 'high';
  /** Salida estructurada: esquema JSON genérico (sin datos de la marca). */
  jsonSchema?: Record<string, unknown>;
  /** Identificador de correlación (sin contenido) para registros. */
  requestId: string;
}

export interface GenResult {
  text: string;
  model: string;
  usage: TokenUsage;
  stopReason: string | null;
  providerRequestId: string | null;
}

export type GenStreamEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'done';
      usage: TokenUsage;
      stopReason: string | null;
      model: string;
      providerRequestId: string | null;
    };

export type ProviderErrorKind =
  | 'auth'
  | 'bad_request'
  | 'not_found'
  | 'too_large'
  | 'rate_limit'
  | 'overloaded'
  | 'server'
  | 'timeout'
  | 'network'
  | 'cancelled'
  | 'refusal'
  | 'incomplete'
  | 'invalid_output';

export const PROVIDER_ERROR_LABEL: Record<ProviderErrorKind, string> = {
  auth: 'El proveedor rechazó la credencial (revisar ANTHROPIC_API_KEY).',
  bad_request: 'El proveedor rechazó la solicitud.',
  not_found: 'Modelo o recurso no disponible en el proveedor.',
  too_large: 'La solicitud supera el tamaño permitido.',
  rate_limit:
    'Límite de uso del proveedor alcanzado; inténtalo en unos minutos.',
  overloaded: 'El proveedor está saturado; inténtalo en unos minutos.',
  server: 'Error temporal del proveedor.',
  timeout: 'El proveedor tardó demasiado en responder.',
  network: 'No se pudo conectar con el proveedor.',
  cancelled: 'Generación cancelada.',
  refusal: 'El proveedor declinó responder esta solicitud.',
  incomplete: 'La respuesta quedó incompleta.',
  invalid_output: 'La respuesta no cumplió el formato validado y se descartó.',
};

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    readonly status: number | null = null,
    readonly retryAfterMs: number | null = null,
    /** Uso facturado aunque haya fallado (p. ej. cancelación a mitad de flujo). */
    readonly partialUsage: TokenUsage | null = null,
  ) {
    super(PROVIDER_ERROR_LABEL[kind]);
    this.name = 'ProviderError';
  }
}

export interface GenerativeProvider {
  readonly id: 'anthropic' | 'fixture';
  /** true: respuestas simuladas (fixtures); nunca se presentan como IA real. */
  readonly simulated: boolean;
  complete(req: GenRequest, signal?: AbortSignal): Promise<GenResult>;
  stream(req: GenRequest, signal?: AbortSignal): AsyncIterable<GenStreamEvent>;
}
