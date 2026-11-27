import type { Finding } from '../schema';

/**
 * Reglas de negocio aplicadas por CÓDIGO a la salida de cualquier modelo (WO §3, §5; backlog
 * HF-AI-12, HF-AI-15). El modelo recibe las mismas reglas en sus instrucciones, pero no se
 * confía en que las cumpla: se verifican aquí.
 */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

/** Compara redes distintas (p. ej. engagement de Instagram frente a Facebook). */
export function crossNetworkClaim(text: string): boolean {
  const t = fold(text);
  const nets = [
    'instagram',
    'facebook',
    'tiktok',
    'linkedin',
    'youtube',
  ].filter((n) => t.includes(n));
  if (nets.length < 2) return false;
  return /\b(mas|mejor|peor|supera\w*|frente a|vs\.?|que en|mayor|menor|por encima|por debajo|rinde)\b/.test(
    t,
  );
}

/** Atribuye sentimiento o conversación sin comentarios importados. */
export function sentimentClaim(text: string): boolean {
  const t = fold(text);
  return /\b(sentimiento|comentarios (positivos|negativos)|la audiencia (ama|odia|critica|elogia)|reacciones? (positivas|negativas) en (los )?comentarios|conversacion (positiva|negativa)|percepcion (positiva|negativa) de (los )?usuarios)\b/.test(
    t,
  );
}

/** Afirmación causal (no verificable con métricas observacionales). */
export function causalClaim(text: string): boolean {
  const t = fold(text);
  return /\b(porque|gracias a|debido a|causo|provoco|se debe a|genero que|hizo que|fue la razon)\b/.test(
    t,
  );
}

const COMPARATIVE =
  /\b(mas|mejor|peor|mediana|promedio|rendimiento|supera|por encima|por debajo|repetir|priorizar|escalar|aumentar la frecuencia)\b/;

export interface RuleContext {
  sample: { size: number; enough: boolean; minimum: number } | null;
  commentsImported: boolean;
}

export function applyFindingRules<T extends Finding & { area?: string }>(
  findings: T[],
  ctx: RuleContext,
): { findings: T[]; adjustments: string[] } {
  const adjustments: string[] = [];
  const out: T[] = [];
  for (const f of findings) {
    const text = `${f.title} ${f.detail}`;
    if (crossNetworkClaim(text)) {
      adjustments.push(
        `Descartado por comparar redes distintas: «${f.title.slice(0, 80)}».`,
      );
      continue;
    }
    if (!ctx.commentsImported && sentimentClaim(text)) {
      adjustments.push(
        `Descartado por atribuir sentimiento sin comentarios importados: «${f.title.slice(0, 80)}».`,
      );
      continue;
    }
    if (f.kind === 'fact' && f.evidence.length === 0) {
      adjustments.push(
        `Hecho sin evidencia verificable descartado: «${f.title.slice(0, 80)}».`,
      );
      continue;
    }
    let next: T = f;
    if (
      (f.kind === 'fact' || f.kind === 'interpretation') &&
      causalClaim(text)
    ) {
      next = {
        ...next,
        kind: 'hypothesis',
        confidence: next.confidence ?? 'baja',
      };
      adjustments.push(
        `Afirmación causal tratada como hipótesis: «${f.title.slice(0, 80)}».`,
      );
    }
    if (
      ctx.sample &&
      !ctx.sample.enough &&
      next.kind === 'recommendation' &&
      (next.area === 'performance' || COMPARATIVE.test(fold(text)))
    ) {
      next = {
        ...next,
        kind: 'hypothesis',
        confidence: 'baja',
        limitation: `Muestra insuficiente (${ctx.sample.size} de un mínimo de ${ctx.sample.minimum} publicaciones comparables): validar con una prueba o más datos antes de decidir.`,
      };
      adjustments.push(
        `Recomendación con muestra insuficiente tratada como hipótesis: «${f.title.slice(0, 80)}».`,
      );
    }
    out.push(next);
  }
  return { findings: out, adjustments };
}
