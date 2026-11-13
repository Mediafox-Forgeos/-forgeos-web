import type { Classification } from './schema';
import type { Layer, ReviewStatus, Severity } from '@/lib/types';

/**
 * Prioridad reputacional 0–100. No toda opinión negativa es crisis:
 * combina gravedad, confianza, alcance, señales de riesgo y anomalía de volumen.
 */
const SEVERITY_BASE: Record<Severity, number> = {
  info: 5,
  attention: 30,
  high: 60,
  critical: 80,
};

export interface PriorityContext {
  reach?: number; // seguidores/alcance estimado del autor o publicación
  volumeRatio?: number; // volumen del tema vs línea base (1 = normal)
  recurrence?: number; // menciones del mismo tema en 24 h
}

export function priorityScore(
  c: Classification,
  ctx: PriorityContext = {},
): number {
  let score = SEVERITY_BASE[c.severity];
  if (c.sentiment === 'negative') score += 6;
  if (c.intent === 'crisis_signal') score += 10;
  if (c.intent === 'complaint') score += 3;
  score += Math.min(12, c.risk_flags.length * 6);
  if (ctx.reach && ctx.reach > 0)
    score += Math.min(8, Math.log10(ctx.reach) * 2);
  if (ctx.volumeRatio && ctx.volumeRatio > 1.5)
    score += Math.min(10, (ctx.volumeRatio - 1) * 4);
  if (ctx.recurrence && ctx.recurrence > 3)
    score += Math.min(5, ctx.recurrence / 3);
  if (c.intent === 'spam') score = Math.min(score, 10);
  // La confianza modula, pero nunca anula señales críticas.
  const weighted = score * (0.6 + 0.4 * c.confidence);
  return Math.round(Math.max(0, Math.min(100, weighted)) * 100) / 100;
}

export function severityFromScore(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'attention';
  return 'info';
}

/** Revisión humana obligatoria: crítico o baja confianza en algo relevante. */
export function reviewRequirement(
  c: Classification,
  score: number,
): ReviewStatus {
  if (c.severity === 'critical' || score >= 80) return 'pending';
  if (c.confidence < 0.6 && score >= 30) return 'pending';
  return 'not_required';
}

/**
 * Capa (requisito A): operativa = requiere atención/respuesta individual;
 * reputacional = señal con impacto en la marca (crítica, riesgo, anomalía).
 */
export function layerFor(
  c: Classification,
  score: number,
  ctx: PriorityContext = {},
): Layer {
  if (
    score >= 60 ||
    c.risk_flags.length > 0 ||
    (ctx.volumeRatio ?? 1) > 1.5 ||
    c.intent === 'crisis_signal'
  ) {
    return 'reputational';
  }
  return 'operational';
}
