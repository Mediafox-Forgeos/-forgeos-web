import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_MESSAGES_URL,
  ZERO_USAGE,
  type TokenUsage,
} from './catalog';
import {
  ProviderError,
  type GenRequest,
  type GenResult,
  type GenStreamEvent,
  type GenerativeProvider,
  type ProviderErrorKind,
} from './provider';
import { readSse } from './sse';

/**
 * Adaptador de Anthropic por API REST (`fetch` a /v1/messages), SIN SDK: no añade
 * dependencias ni toca el lockfile compartido (doc 25 §2).
 *
 *  - Cabecera `anthropic-version: 2026-10-21`: no se envían temperature/top_p/top_k ni prefill.
 *  - Razonamiento adaptativo por defecto; la profundidad se fija con `output_config.effort`.
 *    Solo se leen los bloques `text` (los de razonamiento se ignoran).
 *  - Reintentos solo ante 429/500/529/red, con espera exponencial y `retry-after`, máximo 2.
 *    Nunca ante 4xx de validación ni tras haber empezado a recibir un flujo.
 *  - Tiempo máximo por solicitud y cancelación por AbortSignal (se propaga a la conexión).
 *  - Registros SIN contenido: solo modelo, estado, tokens e id de solicitud del proveedor.
 */
export interface AnthropicOptions {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  /** Espera entre reintentos (inyectable en pruebas). */
  sleep?: (ms: number) => Promise<void>;
  log?: (entry: Record<string, unknown>) => void;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

export const defaultAiLog = (entry: Record<string, unknown>) =>
  console.info(JSON.stringify({ scope: 'foxy-ai', ...entry }));

/** Señal combinada (usuario + tiempo máximo) sin depender de AbortSignal.any. */
function linkedSignal(timeoutMs: number, user?: AbortSignal) {
  const ctrl = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onUser = () => ctrl.abort();
  if (user) {
    if (user.aborted) ctrl.abort();
    else user.addEventListener('abort', onUser, { once: true });
  }
  return {
    signal: ctrl.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(t);
      user?.removeEventListener('abort', onUser);
    },
  };
}

function kindFromStatus(status: number, type?: string): ProviderErrorKind {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not_found';
  if (status === 413) return 'too_large';
  if (status === 429) return 'rate_limit';
  if (status === 529 || type === 'overloaded_error') return 'overloaded';
  if (status >= 500) return 'server';
  return 'bad_request';
}

const RETRYABLE: ProviderErrorKind[] = [
  'rate_limit',
  'overloaded',
  'server',
  'network',
];

function readUsage(u: Record<string, unknown> | undefined): TokenUsage {
  const n = (k: string) => {
    const v = u?.[k];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0;
  };
  return {
    inputTokens: n('input_tokens'),
    outputTokens: n('output_tokens'),
    cacheReadTokens: n('cache_read_input_tokens'),
    cacheWriteTokens: n('cache_creation_input_tokens'),
  };
}

export function buildAnthropicBody(req: GenRequest, stream: boolean) {
  const system: Array<Record<string, unknown>> = [
    { type: 'text', text: req.system },
  ];
  if (req.cachedContext)
    system.push({
      type: 'text',
      text: req.cachedContext,
      cache_control: { type: 'ephemeral' },
    });
  else system[0]!.cache_control = { type: 'ephemeral' };
  const output_config: Record<string, unknown> = { effort: req.effort };
  if (req.jsonSchema)
    output_config.format = { type: 'json_schema', schema: req.jsonSchema };
  return {
    model: req.model,
    max_tokens: req.maxTokens,
    system,
    messages: req.messages,
    output_config,
    ...(stream ? { stream: true } : {}),
  };
}

export class AnthropicProvider implements GenerativeProvider {
  readonly id = 'anthropic' as const;
  readonly simulated = false;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly log: (e: Record<string, unknown>) => void;

  constructor(private readonly opts: AnthropicOptions) {
    if (!opts.apiKey) throw new Error('AnthropicProvider sin clave');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 45_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.sleep = opts.sleep ?? defaultSleep;
    this.log = opts.log ?? defaultAiLog;
  }

  private headers() {
    return {
      'content-type': 'application/json',
      'x-api-key': this.opts.apiKey,
      'anthropic-version': ANTHROPIC_API_VERSION,
    };
  }

  /** Abre la conexión con reintentos (solo antes de recibir datos). */
  private async open(
    req: GenRequest,
    stream: boolean,
    signal: AbortSignal,
    timedOut: () => boolean,
  ): Promise<Response> {
    const body = JSON.stringify(buildAnthropicBody(req, stream));
    let attempt = 0;
    while (true) {
      let res: Response;
      try {
        res = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
          method: 'POST',
          headers: this.headers(),
          body,
          signal,
        });
      } catch {
        if (timedOut()) throw new ProviderError('timeout');
        if (signal.aborted) throw new ProviderError('cancelled');
        if (attempt < this.maxRetries) {
          await this.sleep(500 * 2 ** attempt++);
          continue;
        }
        throw new ProviderError('network');
      }
      if (res.ok) return res;
      let type: string | undefined;
      try {
        const j = (await res.json()) as { error?: { type?: string } };
        type = j?.error?.type;
      } catch {
        /* cuerpo no JSON: se clasifica por estado */
      }
      const kind = kindFromStatus(res.status, type);
      const ra = Number(res.headers.get('retry-after'));
      const retryAfterMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : null;
      this.log({
        event: 'http_error',
        requestId: req.requestId,
        model: req.model,
        status: res.status,
        kind,
        attempt,
        providerRequestId: res.headers.get('request-id'),
      });
      if (RETRYABLE.includes(kind) && attempt < this.maxRetries) {
        await this.sleep(Math.min(retryAfterMs ?? 500 * 2 ** attempt, 8_000));
        attempt++;
        continue;
      }
      throw new ProviderError(kind, res.status, retryAfterMs);
    }
  }

  async complete(req: GenRequest, signal?: AbortSignal): Promise<GenResult> {
    const link = linkedSignal(this.timeoutMs, signal);
    try {
      const res = await this.open(req, false, link.signal, link.timedOut);
      let json: {
        content?: Array<{ type?: string; text?: string }>;
        stop_reason?: string | null;
        model?: string;
        usage?: Record<string, unknown>;
      };
      try {
        json = await res.json();
      } catch {
        if (link.timedOut()) throw new ProviderError('timeout');
        if (link.signal.aborted) throw new ProviderError('cancelled');
        throw new ProviderError('invalid_output');
      }
      const usage = readUsage(json.usage);
      const text = (json.content ?? [])
        .filter((b) => b?.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text!)
        .join('');
      const stopReason = json.stop_reason ?? null;
      this.log({
        event: 'complete',
        requestId: req.requestId,
        model: json.model ?? req.model,
        stopReason,
        ...usage,
        providerRequestId: res.headers.get('request-id'),
      });
      if (stopReason === 'refusal')
        throw new ProviderError('refusal', null, null, usage);
      if (stopReason === 'max_tokens')
        throw new ProviderError('incomplete', null, null, usage);
      return {
        text,
        model: json.model ?? req.model,
        usage,
        stopReason,
        providerRequestId: res.headers.get('request-id'),
      };
    } finally {
      link.dispose();
    }
  }

  async *stream(
    req: GenRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<GenStreamEvent> {
    const link = linkedSignal(this.timeoutMs, signal);
    const usage: TokenUsage = { ...ZERO_USAGE };
    let stopReason: string | null = null;
    let model = req.model;
    let providerRequestId: string | null = null;
    let finished = false;
    try {
      const res = await this.open(req, true, link.signal, link.timedOut);
      providerRequestId = res.headers.get('request-id');
      if (!res.body) throw new ProviderError('invalid_output');
      const blockTypes = new Map<number, string>();
      try {
        for await (const ev of readSse(res.body, link.signal)) {
          if (!ev.data) continue;
          let d: Record<string, unknown>;
          try {
            d = JSON.parse(ev.data);
          } catch {
            continue;
          }
          switch (d.type) {
            case 'message_start': {
              const m = d.message as {
                model?: string;
                usage?: Record<string, unknown>;
              };
              model = m?.model ?? model;
              Object.assign(usage, readUsage(m?.usage));
              break;
            }
            case 'content_block_start': {
              const b = d.content_block as { type?: string };
              blockTypes.set(Number(d.index), b?.type ?? '');
              break;
            }
            case 'content_block_delta': {
              const delta = d.delta as { type?: string; text?: string };
              if (
                blockTypes.get(Number(d.index)) === 'text' &&
                delta?.type === 'text_delta' &&
                typeof delta.text === 'string'
              )
                yield { type: 'delta', text: delta.text };
              break;
            }
            case 'message_delta': {
              const dd = d.delta as { stop_reason?: string | null };
              stopReason = dd?.stop_reason ?? stopReason;
              const u = readUsage(d.usage as Record<string, unknown>);
              usage.outputTokens = u.outputTokens || usage.outputTokens;
              break;
            }
            case 'message_stop':
              finished = true;
              break;
            case 'error': {
              const e = d.error as { type?: string };
              throw new ProviderError(
                e?.type === 'overloaded_error' ? 'overloaded' : 'server',
                null,
                null,
                { ...usage },
              );
            }
          }
        }
      } catch (e) {
        if (e instanceof ProviderError) throw e;
        if (link.timedOut())
          throw new ProviderError('timeout', null, null, { ...usage });
        if (link.signal.aborted)
          throw new ProviderError('cancelled', null, null, { ...usage });
        throw new ProviderError('network', null, null, { ...usage });
      }
      if (link.timedOut())
        throw new ProviderError('timeout', null, null, { ...usage });
      if (link.signal.aborted)
        throw new ProviderError('cancelled', null, null, { ...usage });
      if (!finished)
        throw new ProviderError('incomplete', null, null, { ...usage });
      this.log({
        event: 'stream_done',
        requestId: req.requestId,
        model,
        stopReason,
        ...usage,
        providerRequestId,
      });
      if (stopReason === 'refusal')
        throw new ProviderError('refusal', null, null, { ...usage });
      yield { type: 'done', usage, stopReason, model, providerRequestId };
    } finally {
      link.dispose();
    }
  }
}
