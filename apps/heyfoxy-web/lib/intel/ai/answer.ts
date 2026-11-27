import type { Evidence } from '../schema';
import { resolveRefs, type FoxyContext } from './context';

/**
 * Respuesta conversacional de Ask Foxy generativo (WO-HF-AI-ENGINE-001 §7):
 * 1 respuesta principal · 2 interpretación · 3 evidencias · 4 recomendaciones ·
 * 5 limitaciones · 6 preguntas de seguimiento.
 *
 * El modelo escribe secciones etiquetadas que se pueden mostrar MIENTRAS llegan (streaming);
 * al terminar se validan: longitudes, referencias (solo las del contexto; las demás se
 * descartan y se cuentan) y completitud (falta de secciones o corte por límite = incompleta).
 */
export interface GenRecommendation {
  text: string;
  evidence: Evidence[];
}

export interface GenAnswer {
  answer: string;
  interpretation: string;
  evidence: Evidence[];
  recommendations: GenRecommendation[];
  limitations: string[];
  followUps: string[];
  /** false si faltan secciones o el proveedor cortó la respuesta. */
  complete: boolean;
  /** Referencias citadas que no existían en el contexto (descartadas). */
  droppedRefs: number;
}

export type GenAnswerDraft = Pick<
  GenAnswer,
  'answer' | 'interpretation' | 'recommendations' | 'limitations' | 'followUps'
> & { evidenceRefs: string[] };

const TAGS = [
  'respuesta',
  'interpretacion',
  'evidencias',
  'recomendaciones',
  'limitaciones',
  'seguimiento',
] as const;
type Tag = (typeof TAGS)[number];

/** Contenido de una etiqueta; si aún no cerró (flujo en curso), lo recibido hasta ahora. */
function section(
  text: string,
  tag: Tag,
): { body: string; closed: boolean } | null {
  const open = text.indexOf(`<${tag}>`);
  if (open === -1) return null;
  const start = open + tag.length + 2;
  const close = text.indexOf(`</${tag}>`, start);
  let body = close === -1 ? text.slice(start) : text.slice(start, close);
  if (close === -1) body = body.replace(/<\/?[a-z]*$/i, '');
  return { body, closed: close !== -1 };
}

const clean = (s: string, max: number) =>
  s
    .replace(/<\/?[a-z_]+>/gi, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, max);

const bullets = (s: string, max: number, each: number) =>
  s
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max)
    .map((l) => clean(l, each));

const refsOf = (s: string) => [...s.matchAll(/\bE\d{1,3}\b/g)].map((m) => m[0]);

const stripRefs = (s: string) =>
  s.replace(/\s*\[(?:E\d{1,3}(?:\s*,\s*)?)+\]/g, '').trim();

/** Lectura parcial para mostrar durante el flujo (sin validar referencias todavía). */
export function draftFromText(text: string): GenAnswerDraft {
  const get = (t: Tag) => section(text, t)?.body ?? '';
  return {
    answer: clean(get('respuesta'), 1_200),
    interpretation: clean(get('interpretacion'), 1_000),
    evidenceRefs: refsOf(get('evidencias')),
    recommendations: bullets(get('recomendaciones'), 5, 300).map((t) => ({
      text: stripRefs(t),
      evidence: [],
    })),
    limitations: bullets(get('limitaciones'), 5, 300),
    followUps: bullets(get('seguimiento'), 4, 160).map((q) =>
      q.endsWith('?') || q.endsWith('?') ? q : q,
    ),
  };
}

/** Validación final de la respuesta completa. */
export function finalizeAnswer(
  text: string,
  ctx: Pick<FoxyContext, 'evidence'>,
  opts: { truncated: boolean },
): GenAnswer {
  const d = draftFromText(text);
  let dropped = 0;
  const main = resolveRefs(d.evidenceRefs, ctx);
  dropped += main.dropped;
  const recSrc = bullets(section(text, 'recomendaciones')?.body ?? '', 5, 300);
  const recommendations = recSrc.map((raw) => {
    const r = resolveRefs(refsOf(raw), ctx);
    dropped += r.dropped;
    return { text: stripRefs(raw), evidence: r.evidence };
  });
  const allClosed = TAGS.every((t) => section(text, t)?.closed);
  return {
    answer: stripRefs(d.answer),
    interpretation: stripRefs(d.interpretation),
    evidence: main.evidence,
    recommendations: recommendations.filter((r) => r.text.length > 0),
    limitations: d.limitations,
    followUps: d.followUps,
    complete: allClosed && !opts.truncated && d.answer.length > 0,
    droppedRefs: dropped,
  };
}
