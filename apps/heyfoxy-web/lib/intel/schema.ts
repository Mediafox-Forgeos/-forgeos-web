import { z } from 'zod';

/**
 * Salida del motor de inteligencia de Foxy (WO-HF-V2-INTELLIGENCE-001 + addendum §7).
 * Validada con zod antes de mostrarse o guardarse en caché, venga del proveedor que venga.
 * Cada afirmación declara su naturaleza y su evidencia: nunca una hipótesis como hecho.
 */
export const PROMPT_VERSION = 'content_intel@2026-11-26.1';

export const FindingKind = z.enum([
  'fact',
  'interpretation',
  'hypothesis',
  'recommendation',
]);
export type FindingKind = z.infer<typeof FindingKind>;

export const FINDING_KIND_LABEL: Record<FindingKind, string> = {
  fact: 'Hecho',
  interpretation: 'Interpretación',
  hypothesis: 'Hipótesis',
  recommendation: 'Recomendación',
};

export const EvidenceSchema = z.object({
  type: z.enum(['post', 'metric', 'brand', 'document', 'comparison']),
  label: z.string().min(1).max(160),
  /** Publicación referida (id interno de Hey Foxy), si aplica. */
  postId: z.string().max(80).nullable().default(null),
  value: z.string().max(80).nullable().default(null),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const FindingSchema = z.object({
  kind: FindingKind,
  title: z.string().min(1).max(160),
  detail: z.string().max(700).default(''),
  evidence: z.array(EvidenceSchema).max(8).default([]),
  confidence: z.enum(['alta', 'media', 'baja']).nullable().default(null),
  limitation: z.string().max(300).nullable().default(null),
});
export type Finding = z.infer<typeof FindingSchema>;

export const ABTestSchema = z.object({
  hypothesis: z.string().min(1).max(300),
  variantA: z.string().min(1).max(200),
  variantB: z.string().min(1).max(200),
  metric: z.string().min(1).max(80),
});

export const PostIntelSchema = z.object({
  content: z.object({
    theme: z.string().max(120).nullable(),
    territory: z.string().max(120).nullable(),
    format: z.string().max(80),
    objective: z.string().max(160).nullable(),
    intent: z.string().max(160).nullable(),
    hook: z.string().max(300).nullable(),
    cta: z.string().max(200).nullable(),
    /** El CTA forma parte de la misma frase que el hook (copy de una sola frase). */
    ctaInHook: z.boolean().default(false),
    visual: z.string().max(400).nullable(),
    findings: z.array(FindingSchema).max(10),
  }),
  performance: z.object({
    findings: z.array(FindingSchema).max(10),
    peers: z.number().int().min(0),
  }),
  strategic: z.object({
    status: z.enum(['ok', 'partial', 'no_context']),
    pillar: z.string().max(80).nullable(),
    campaign: z.string().max(120).nullable(),
    findings: z.array(FindingSchema).max(8),
  }),
  creative: z.object({
    findings: z.array(FindingSchema).max(10),
    hooks: z.array(z.string().max(200)).max(5),
    ctas: z.array(z.string().max(120)).max(5),
    abTests: z.array(ABTestSchema).max(3),
  }),
  reputation: z.object({
    status: z.enum(['available', 'disabled_privacy', 'no_data']),
    reason: z.string().max(300),
  }),
  limitations: z.array(z.string().max(300)).max(8),
});
export type PostIntel = z.infer<typeof PostIntelSchema>;

export const AskAnswerSchema = z.object({
  question: z.string().max(500),
  /**
   * Respuesta principal: el título del hallazgo más relevante, compuesto por reglas (no es
   * texto generado). null si no hay respuesta.
   */
  headline: z.string().max(240).nullable().default(null),
  findings: z.array(FindingSchema).max(10),
  /** Si el motor no puede responder con la evidencia disponible, lo dice. */
  unanswerable: z.string().max(400).nullable(),
  suggestions: z.array(z.string().max(160)).max(5),
});
export type AskAnswer = z.infer<typeof AskAnswerSchema>;

export interface IntelMeta {
  provider: string;
  model: string;
  /** true: motor local por reglas, sin IA generativa. */
  local: boolean;
  cached: boolean;
  generatedAt: string;
  /** La entrada incluía solo datos sintéticos de prueba. */
  syntheticInput: boolean;
  promptVersion: string;
}
