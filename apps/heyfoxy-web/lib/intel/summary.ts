import type { Finding, PostIntel } from './schema';

/**
 * Resumen ejecutivo de una publicación (pestaña «Resumen» de Foxy Intelligence): entre 3 y 5
 * hallazgos prioritarios tomados TAL CUAL del análisis (no se reescriben), más las
 * recomendaciones. Prioridad: rendimiento frente a equivalentes → estrategia → contenido →
 * guardados; luego recomendaciones creativas.
 */
export function summarizePostIntel(intel: PostIntel): {
  findings: Finding[];
  recommendations: Finding[];
} {
  const perf = intel.performance.findings;
  const pick: Array<Finding | undefined> = [
    perf.find(
      (f) => f.kind === 'interpretation' && /equivalentes/.test(f.title),
    ) ?? perf.find((f) => /Sin base suficiente/.test(f.title)),
    perf.find((f) => f.kind === 'fact' && /^Engagement/.test(f.title)),
    intel.strategic.findings[0],
    intel.content.findings.find((f) => f.kind === 'interpretation'),
    perf.find((f) => /^Guardados/.test(f.title)),
    intel.content.findings.find((f) => f.kind === 'hypothesis'),
  ];
  const findings = pick
    .filter((f): f is Finding => !!f)
    .filter((f, i, xs) => xs.findIndex((x) => x.title === f.title) === i)
    .slice(0, 5);
  const recommendations = intel.creative.findings
    .filter((f) => f.kind === 'recommendation')
    .slice(0, 3);
  return { findings, recommendations };
}
