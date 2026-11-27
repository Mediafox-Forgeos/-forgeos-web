import { ZERO_USAGE, estimateTokens } from './catalog';
import {
  ProviderError,
  type GenRequest,
  type GenResult,
  type GenStreamEvent,
  type GenerativeProvider,
} from './provider';

/**
 * Proveedor de FIXTURES (WO-HF-AI-ENGINE-001 §13): respuestas simuladas, deterministas y
 * marcadas como «[SIMULACIÓN]» para desarrollar y probar la interfaz sin llamadas reales ni
 * costo. Solo se activa con HF_AI_CONTENT_PROVIDER=fixture fuera de Vercel y de producción
 * (config.fixtureAllowed). Nunca se presenta como IA real: la interfaz muestra «Simulación
 * con fixtures · sin IA real».
 *
 * Cita las primeras referencias presentes en el contexto (para ejercitar la validación de
 * evidencia) y una referencia inexistente (E999) que la validación debe descartar.
 * Escenarios de prueba en la pregunta: «[fixture:error]», «[fixture:lento]».
 */
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new ProviderError('cancelled'));
      },
      { once: true },
    );
  });

function refsIn(req: GenRequest): string[] {
  // Primero las referencias del contexto verificado (publicación y métricas), luego la marca.
  const all = [
    ...req.messages.flatMap((m) =>
      m.content.map((c) => (c.type === 'text' ? c.text : '')),
    ),
    req.cachedContext ?? '',
  ].join('\n');
  return [...new Set([...all.matchAll(/\[(E\d+)\]/g)].map((m) => m[1]!))];
}

const lastText = (req: GenRequest) =>
  req.messages.at(-1)?.content.find((c) => c.type === 'text')?.text ?? '';

const hasImage = (req: GenRequest) =>
  req.messages.some((m) => m.content.some((c) => c.type === 'image'));

function usageFor(req: GenRequest, out: string) {
  const chars =
    req.system.length + (req.cachedContext?.length ?? 0) + lastText(req).length;
  return {
    ...ZERO_USAGE,
    inputTokens: estimateTokens(chars),
    outputTokens: estimateTokens(out.length),
  };
}

export function fixtureContentJson(req: GenRequest): string {
  const r = refsIn(req);
  const a = r[0] ?? 'E1';
  const b = r[1] ?? a;
  const c = r[2] ?? b;
  const insufficient = /INSUFICIENTE/.test(lastText(req));
  return JSON.stringify({
    content: {
      theme: '[SIMULACIÓN] Educación preventiva',
      territory: '[SIMULACIÓN] Bienestar cotidiano',
      objective: '[SIMULACIÓN] Generar recordación del mensaje preventivo',
      intent: '[SIMULACIÓN] Educar e invitar a una acción concreta',
      hook: '[SIMULACIÓN] Pregunta directa en la primera línea',
      cta: '[SIMULACIÓN] Invitación a agendar',
      visual: hasImage(req)
        ? '[SIMULACIÓN] Composición centrada con titular legible y alto contraste.'
        : null,
    },
    findings: [
      {
        area: 'performance',
        kind: 'fact',
        title: '[SIMULACIÓN] Las métricas de la publicación están verificadas',
        detail: 'Hecho de prueba que cita evidencia existente del contexto.',
        refs: [a, b],
        confidence: 'alta',
        limitation: null,
      },
      {
        area: 'performance',
        kind: 'recommendation',
        title: '[SIMULACIÓN] Repetir el formato en la próxima parrilla',
        detail:
          'Recomendación de prueba formulada como concluyente para ejercitar la regla de muestra insuficiente.',
        refs: [b],
        confidence: 'media',
        limitation: insufficient ? null : 'Validar con más publicaciones.',
      },
      {
        area: 'creative',
        kind: 'interpretation',
        title:
          '[SIMULACIÓN] El hook plantea el beneficio antes que el producto',
        detail: 'Interpretación de prueba del copy.',
        refs: [c, 'E999'],
        confidence: 'media',
        limitation: null,
      },
      {
        area: 'strategic',
        kind: 'hypothesis',
        title: '[SIMULACIÓN] Podría reforzar el pilar de prevención',
        detail: 'Hipótesis de prueba sobre alineación estratégica.',
        refs: [],
        confidence: 'baja',
        limitation: 'Requiere Brand Brain completo.',
      },
    ],
    hooks: ['[SIMULACIÓN] ¿Cuándo fue tu último chequeo?'],
    ctas: ['[SIMULACIÓN] Agenda tu cita hoy'],
    abTests: [
      {
        hypothesis:
          '[SIMULACIÓN] Un hook en forma de pregunta aumenta los guardados',
        variantA: 'Hook afirmativo',
        variantB: 'Hook en pregunta',
        metric: 'Guardados',
      },
    ],
    strategic: { pillar: null, campaign: null },
    limitations: [
      '[SIMULACIÓN] Respuesta de fixtures: no es un análisis real.',
    ],
  });
}

export function fixtureAskText(req: GenRequest): string {
  const r = refsIn(req);
  const a = r[0] ?? 'E1';
  const b = r[1] ?? a;
  return `<respuesta>[SIMULACIÓN] Con los datos del periodo, la pieza con mejor desempeño dentro de su red combina una pregunta inicial con un beneficio concreto. Es una respuesta de fixtures para probar la experiencia, no un análisis real.</respuesta>
<interpretacion>[SIMULACIÓN] El hecho verificable es el rendimiento citado; la razón detrás es una hipótesis que conviene validar con una prueba controlada.</interpretacion>
<evidencias>${a}, ${b}, E999</evidencias>
<recomendaciones>
- [SIMULACIÓN] Probar dos versiones del hook en la misma red y formato [${a}]
- [SIMULACIÓN] Registrar el resultado como aprendizaje para revisión humana
</recomendaciones>
<limitaciones>
- [SIMULACIÓN] Muestra pequeña: la comparación es orientativa
- Comentarios no importados: no se evalúa la conversación
</limitaciones>
<seguimiento>
- ¿Qué formato conviene priorizar en Instagram?
- ¿Qué prueba A/B propones para la próxima semana?
</seguimiento>`;
}

export class FixtureProvider implements GenerativeProvider {
  readonly id = 'fixture' as const;
  readonly simulated = true;
  constructor(private readonly delayMs = 35) {}

  async complete(req: GenRequest, signal?: AbortSignal): Promise<GenResult> {
    if (/\[fixture:error\]/.test(lastText(req)))
      throw new ProviderError('overloaded', 529);
    await sleep(this.delayMs * 4, signal);
    const text = fixtureContentJson(req);
    return {
      text,
      model: req.model,
      usage: usageFor(req, text),
      stopReason: 'end_turn',
      providerRequestId: null,
    };
  }

  async *stream(
    req: GenRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<GenStreamEvent> {
    const q = lastText(req);
    if (/\[fixture:error\]/.test(q)) throw new ProviderError('overloaded', 529);
    const slow = /\[fixture:lento\]/.test(q);
    const text = fixtureAskText(req);
    const parts = text.match(/[\s\S]{1,18}/g) ?? [];
    for (const p of parts) {
      await sleep(slow ? this.delayMs * 6 : this.delayMs, signal);
      yield { type: 'delta', text: p };
    }
    yield {
      type: 'done',
      usage: usageFor(req, text),
      stopReason: 'end_turn',
      model: req.model,
      providerRequestId: null,
    };
  }
}
