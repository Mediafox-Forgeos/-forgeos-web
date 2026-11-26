import { createHash } from 'node:crypto';
import {
  PostIntelSchema,
  type AskAnswer,
  type Evidence,
  type PostIntel,
} from './schema';

/**
 * Seguridad del motor de inteligencia (WO §F + addendum §12).
 *  - Proveedor: el local siempre; uno externo solo con GO (HF_AI_CONTENT_PROVIDER + clave) y,
 *    para datos reales, solo si la organización está autorizada expresamente
 *    (HF_AI_REAL_DATA_ORGS). MedPlus no lo está: sus datos nunca salen.
 *  - Contenido externo (copy de publicaciones) = DATO no confiable: se neutraliza antes de
 *    incluirlo en cualquier prompt y la salida se valida (esquema + referencias conocidas).
 */

export type ProviderDecision =
  | { use: 'local'; reason: string }
  | { use: 'external'; provider: string; reason: string }
  | { use: 'disabled'; reason: string };

export function decideProvider(opts: {
  env: Record<string, string | undefined>;
  orgId: string;
  syntheticInput: boolean;
  dbKillSwitch?: boolean;
}): ProviderDecision {
  const { env } = opts;
  if (env.HF_AI_KILL_SWITCH === 'on' || opts.dbKillSwitch)
    return {
      use: 'disabled',
      reason:
        'Interruptor de emergencia de IA activo: Foxy no analiza contenido.',
    };
  const provider = env.HF_AI_CONTENT_PROVIDER ?? 'local';
  if (provider === 'local')
    return {
      use: 'local',
      reason: 'Motor local por reglas (sin IA generativa).',
    };
  const authorizedReal = (env.HF_AI_REAL_DATA_ORGS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(opts.orgId);
  if (!opts.syntheticInput && !authorizedReal)
    return {
      use: 'local',
      reason:
        'Datos reales sin autorización específica para un proveedor de IA externo: se usa el motor local.',
    };
  // El adaptador externo no está habilitado en esta versión (pendiente de GO, doc 21 §6).
  return {
    use: 'local',
    reason: `Proveedor «${provider}» pendiente de GO: se usa el motor local.`,
  };
}

// Controles, ancho cero y marcas de dirección (pueden ocultar instrucciones en el texto).
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u206F]',
  'g',
);

/** Elimina caracteres de control y secuencias que imitan etiquetas de rol o de sistema. */
export function sanitizeUntrusted(text: string, max = 4000): string {
  return text
    .normalize('NFKC')
    .replace(CONTROL_CHARS, '')
    .replace(
      /<\/?\s*(system|assistant|user|untrusted_[a-z_]+|instructions?)\b[^>]*>/gi,
      '[etiqueta retirada]',
    )
    .slice(0, max);
}

/** Envuelve un texto externo como dato delimitado (para un futuro proveedor externo). */
export function wrapUntrusted(kind: string, text: string): string {
  return `<untrusted_${kind}>\n${sanitizeUntrusted(text)}\n</untrusted_${kind}>`;
}

const keepRef = (ids: Set<string>) => (e: Evidence) =>
  e.postId == null || ids.has(e.postId);

/**
 * Valida una salida (de cualquier proveedor) y descarta referencias a publicaciones que no
 * estaban en la entrada: una respuesta no puede «citar» evidencia inventada.
 */
export function validateIntel(
  raw: unknown,
  allowedPostIds: Iterable<string>,
): PostIntel {
  const intel = PostIntelSchema.parse(raw);
  const ids = new Set(allowedPostIds);
  const fix = <T extends { evidence: Evidence[] }>(f: T): T => ({
    ...f,
    evidence: f.evidence.filter(keepRef(ids)),
  });
  return {
    ...intel,
    content: { ...intel.content, findings: intel.content.findings.map(fix) },
    performance: {
      ...intel.performance,
      findings: intel.performance.findings.map(fix),
    },
    strategic: {
      ...intel.strategic,
      findings: intel.strategic.findings.map(fix),
    },
    creative: { ...intel.creative, findings: intel.creative.findings.map(fix) },
  };
}

export function validateAnswer(
  a: AskAnswer,
  allowedPostIds: Iterable<string>,
): AskAnswer {
  const ids = new Set(allowedPostIds);
  return {
    ...a,
    findings: a.findings.map((f) => ({
      ...f,
      evidence: f.evidence.filter(keepRef(ids)),
    })),
  };
}

/** Hash estable de la entrada: si nada cambió (copy, métricas, contexto), no se reanaliza. */
export function intelInputHash(
  parts: unknown,
  promptVersion: string,
  model: string,
): string {
  return createHash('sha256')
    .update(`${promptVersion}|${model}|${JSON.stringify(parts)}`)
    .digest('hex')
    .slice(0, 48);
}
