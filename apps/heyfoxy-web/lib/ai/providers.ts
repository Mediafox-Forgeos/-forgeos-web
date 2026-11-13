import {
  ClassificationSchema,
  type Classification,
  type ClassifyInput,
} from './schema';

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}
export interface ModelProvider {
  readonly id: string;
  readonly model: string;
  classify(
    input: ClassifyInput,
  ): Promise<{ result: Classification; usage: ModelUsage }>;
}

/**
 * Proveedor heurístico local: sin red y sin costo. Se usa en demo/QA y como
 * respaldo si el proveedor externo falla o se agota el presupuesto.
 */
const LEXICON: Array<{
  re: RegExp;
  topic?: string;
  neg?: number;
  pos?: number;
  flag?: Classification['risk_flags'][number];
  crisis?: boolean;
  intent?: Classification['intent'];
}> = [
  {
    re: /\b(demanda|abogad|supersalud|superintendencia|tutela|denuncia)/i,
    topic: 'legal',
    neg: 2,
    flag: 'legal',
    intent: 'complaint',
  },
  {
    re: /\b(muri[oó]|fallec|negligencia|mala praxis|intoxica|infecci[oó]n)/i,
    topic: 'seguridad del paciente',
    neg: 3,
    flag: 'health_safety',
    crisis: true,
  },
  {
    re: /\b(datos personales|filtraci[oó]n|hacke|fraude|estafa|robo)/i,
    topic: 'seguridad y datos',
    neg: 2,
    flag: 'data_privacy',
    crisis: true,
  },
  {
    re: /\b(periodista|noticia|medios|viral)/i,
    topic: 'exposición mediática',
    neg: 1,
    flag: 'media_attention',
  },
  {
    re: /\b(cita|agenda|turno|espera|demora|cola)/i,
    topic: 'citas y tiempos de espera',
    neg: 1,
    intent: 'complaint',
  },
  {
    re: /\b(cobro|factura|precio|tarifa|cuota|tasa)/i,
    topic: 'cobros y tarifas',
    neg: 1,
  },
  {
    re: /\b(app|aplicaci[oó]n|web|plataforma|clave|contraseña)/i,
    topic: 'canales digitales',
  },
  {
    re: /\b(p[eé]sim|horrible|terrible|nunca m[aá]s|indignad|vergüenza|mal servicio|no sirve)/i,
    neg: 2,
    intent: 'complaint',
  },
  {
    re: /\b(gracias|excelente|felicit|recomiendo|amables?|genial|buen servicio)/i,
    pos: 2,
    intent: 'praise',
  },
  { re: /\?|c[oó]mo (puedo|hago)|d[oó]nde|cu[aá]ndo/i, intent: 'question' },
  {
    re: /\b(quiero (comprar|afiliarme|abrir)|cotizaci[oó]n|precio de)/i,
    intent: 'purchase_intent',
  },
  { re: /\b(gana dinero|haz clic|promo gratis|bit\.ly)/i, intent: 'spam' },
];

export class HeuristicProvider implements ModelProvider {
  readonly id = 'heuristic';
  readonly model = 'heuristic-es-v1';

  async classify(input: ClassifyInput) {
    let neg = 0;
    let pos = 0;
    let crisis = false;
    const topics = new Set<string>();
    const flags = new Set<Classification['risk_flags'][number]>();
    let intent: Classification['intent'] = 'other';
    const hits: string[] = [];
    for (const rule of LEXICON) {
      if (!rule.re.test(input.text)) continue;
      neg += rule.neg ?? 0;
      pos += rule.pos ?? 0;
      if (rule.topic) topics.add(rule.topic);
      if (rule.flag) flags.add(rule.flag);
      if (rule.crisis) crisis = true;
      if (
        rule.intent &&
        (intent === 'other' ||
          rule.intent === 'spam' ||
          rule.intent === 'complaint')
      )
        intent = rule.intent;
      hits.push(rule.topic ?? rule.intent ?? 'tono');
    }
    if (crisis) intent = 'crisis_signal';
    const sentiment: Classification['sentiment'] =
      neg > 0 && pos > 0
        ? 'mixed'
        : neg > 0
          ? 'negative'
          : pos > 0
            ? 'positive'
            : 'neutral';
    const severity: Classification['severity'] = crisis
      ? 'critical'
      : flags.size > 0 || neg >= 3
        ? 'high'
        : neg > 0
          ? 'attention'
          : 'info';
    const confidence = Math.min(0.9, 0.45 + hits.length * 0.12);
    const result = ClassificationSchema.parse({
      sentiment,
      intent,
      topics: [...topics].slice(0, 5),
      severity,
      confidence: Math.round(confidence * 100) / 100,
      explanation:
        hits.length > 0
          ? `Clasificación heurística por señales: ${[...new Set(hits)].join(', ')}.`
          : 'Sin señales relevantes detectadas por la heurística.',
      risk_flags: [...flags],
    });
    return { result, usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }
}

/**
 * OpenAI (opción inicial, reemplazable). Usa Responses API con salida JSON.
 * Solo se instancia si HF_AI_PROVIDER=openai y hay OPENAI_API_KEY en servidor.
 * Precios por millón de tokens se configuran por env para no fijarlos en código.
 */
export class OpenAIProvider implements ModelProvider {
  readonly id = 'openai';
  constructor(
    readonly model: string,
    private readonly apiKey: string,
    private readonly price = {
      inPerM: Number(process.env.HF_AI_PRICE_IN_PER_M ?? '0.15'),
      outPerM: Number(process.env.HF_AI_PRICE_OUT_PER_M ?? '0.60'),
    },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async classify(input: ClassifyInput) {
    const res = await this.fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: 'system',
            content:
              'Eres un analista de reputación en español (Colombia). Clasifica UN comentario de redes sociales. ' +
              'No toda opinión negativa es crisis: reserva "critical" para riesgo de salud/seguridad, legal, datos, amenazas o exposición masiva. ' +
              'Responde SOLO JSON con: sentiment, intent, topics (máx 5), severity, confidence (0-1), explanation (1 frase), risk_flags.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              platform: input.platform,
              brand: input.brand,
              text: input.text.slice(0, 2000),
            }),
          },
        ],
        text: { format: { type: 'json_object' } },
        max_output_tokens: 300,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI respondió ${res.status}`);
    const json = (await res.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const text =
      json.output_text ??
      json.output
        ?.flatMap((o) => o.content ?? [])
        .map((c) => c.text ?? '')
        .join('') ??
      '';
    const result = ClassificationSchema.parse(JSON.parse(text));
    const inputTokens = json.usage?.input_tokens ?? 0;
    const outputTokens = json.usage?.output_tokens ?? 0;
    return {
      result,
      usage: {
        inputTokens,
        outputTokens,
        costUsd:
          (inputTokens * this.price.inPerM +
            outputTokens * this.price.outPerM) /
          1_000_000,
      },
    };
  }
}

export function providerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ModelProvider {
  if (env.HF_AI_PROVIDER === 'openai' && env.OPENAI_API_KEY) {
    return new OpenAIProvider(
      env.HF_AI_MODEL || 'gpt-4.1-mini',
      env.OPENAI_API_KEY,
    );
  }
  return new HeuristicProvider();
}
