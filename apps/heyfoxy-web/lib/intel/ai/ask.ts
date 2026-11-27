import type { MemoryEntry, StoredBrandContext } from '@/lib/brain/types';
import type { Post } from '@/lib/types';
import { getPostIntel } from '../engine';
import { validateAnswer } from '../guard';
import { answerLocal } from '../local';
import { PROMPT_VERSION, type AskAnswer } from '../schema';
import {
  ZERO_USAGE,
  costOf,
  estimateTokens,
  maxCostOf,
  modelInfo,
} from './catalog';
import {
  draftFromText,
  finalizeAnswer,
  type GenAnswer,
  type GenAnswerDraft,
} from './answer';
import { buildFoxyContext, IsolationError, type FoxyContext } from './context';
import {
  FALLBACK_NOTED,
  decideGenerative,
  limitsFor,
  localMeta,
  newRequestId,
  type EngineDeps,
  type FallbackCode,
  type GenMeta,
} from './engine';
import { ASK_SYSTEM, GEN_ASK_PROMPT_VERSION, askUserText } from './prompts';
import { ProviderError, type GenMessage } from './provider';
import { prepareUntrustedText } from './redact';
import { crossNetworkClaim, sentimentClaim } from './rules';

/**
 * Ask Foxy generativo (WO-HF-AI-ENGINE-001 §7): general, lateral y contextual por publicación.
 * Emite eventos para la interfaz:
 *   meta     → motor que responde (generativo, simulado o local) y su motivo
 *   draft    → secciones parciales mientras llega el flujo (streaming)
 *   final    → respuesta validada (referencias, reglas, completitud) + costo
 *   local    → respuesta del motor local (no hay IA generativa o se usó de respaldo)
 *   error    → error del proveedor; se acompaña de la respuesta local de respaldo
 * Cancelar (AbortSignal) corta la conexión con el proveedor y se registra como cancelada.
 */
export type AskEvent =
  | { type: 'meta'; meta: GenMeta }
  | { type: 'draft'; draft: GenAnswerDraft }
  | { type: 'final'; answer: GenAnswer; meta: GenMeta }
  | { type: 'local'; answer: AskAnswer; meta: GenMeta }
  | { type: 'error'; message: string; code: FallbackCode | 'cancelled' };

export interface AskTurn {
  q: string;
  /** Resumen de la respuesta anterior (texto plano, ya mostrado al usuario). */
  a: string;
}

export interface AskArgs {
  orgId: string;
  userId: string;
  question: string;
  scopeLabel: string;
  post: Post | null;
  peers: Post[];
  brand: StoredBrandContext | null;
  brandOrgId: string | null;
  learnings: MemoryEntry[];
  learningsOrgId: string | null;
  periodLabel: string;
  platformFilter: string | null;
  filters: string[];
  history: AskTurn[];
  requestId?: string;
  signal?: AbortSignal;
}

function localAnswer(args: AskArgs): AskAnswer {
  const intel = args.post
    ? getPostIntel({
        orgId: args.orgId,
        post: args.post,
        peers: args.peers,
        brand: args.brand?.context ?? null,
        periodLabel: args.periodLabel,
      }).intel
    : null;
  return validateAnswer(
    answerLocal(args.question, {
      intel,
      post: args.post,
      peers: args.peers,
      brand: args.brand?.context ?? null,
      periodLabel: args.periodLabel,
    }),
    [...(args.post ? [args.post.id] : []), ...args.peers.map((p) => p.id)],
  );
}

/** Conversación previa: solo las últimas 4 vueltas, neutralizadas y truncadas. */
function historyMessages(history: AskTurn[]): GenMessage[] {
  return history.slice(-4).flatMap((t) => [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: prepareUntrustedText(t.q, 500).text || '(vacía)',
        },
      ],
    },
    {
      role: 'assistant' as const,
      content: [
        {
          type: 'text' as const,
          text: prepareUntrustedText(t.a, 1_200).text || '(sin respuesta)',
        },
      ],
    },
  ]);
}

/** Reglas sobre la respuesta conversacional (mismas que en el análisis de contenido). */
function applyAnswerRules(
  a: GenAnswer,
  ctx: FoxyContext,
): { answer: GenAnswer; adjustments: string[] } {
  const adjustments: string[] = [];
  const recs = a.recommendations.filter((r) => {
    if (crossNetworkClaim(r.text) || sentimentClaim(r.text)) {
      adjustments.push(
        `Recomendación descartada por las reglas de comparación o sentimiento: «${r.text.slice(0, 80)}».`,
      );
      return false;
    }
    return true;
  });
  const limitations = [...a.limitations];
  let interpretation = a.interpretation;
  if (crossNetworkClaim(a.answer) || crossNetworkClaim(interpretation)) {
    limitations.unshift(
      'Instagram y Facebook calculan el engagement distinto: la comparación entre redes no es válida.',
    );
    adjustments.push(
      'Se advirtió una comparación entre redes en la respuesta.',
    );
  }
  if (sentimentClaim(interpretation)) {
    interpretation = '';
    adjustments.push(
      'Interpretación retirada: atribuía sentimiento sin comentarios importados.',
    );
  }
  let recommendations = recs;
  if (ctx.sample && !ctx.sample.enough && recs.length) {
    recommendations = recs.map((r) => ({
      ...r,
      text: /^validar/i.test(r.text) ? r.text : `Para validar: ${r.text}`,
    }));
    limitations.unshift(
      `Muestra insuficiente (${ctx.sample.size} de un mínimo de ${ctx.sample.minimum} publicaciones comparables): las recomendaciones son propuestas para validar, no conclusiones.`,
    );
    adjustments.push(
      'Recomendaciones marcadas como propuestas para validar (muestra insuficiente).',
    );
  }
  if (!a.evidence.length && !recommendations.some((r) => r.evidence.length))
    limitations.push(
      'La respuesta no citó evidencia verificable del contexto: tómala como orientación.',
    );
  return {
    answer: {
      ...a,
      interpretation,
      recommendations,
      limitations: [...new Set(limitations)].slice(0, 6),
    },
    adjustments,
  };
}

export async function* askGenerative(
  deps: EngineDeps,
  args: AskArgs,
): AsyncGenerator<AskEvent> {
  const q = args.question.trim().slice(0, 500);
  let ctx: FoxyContext;
  try {
    ctx = buildFoxyContext({
      orgId: args.orgId,
      post: args.post,
      peers: args.peers,
      brand: args.brand,
      brandOrgId: args.brandOrgId,
      learnings: args.learnings,
      learningsOrgId: args.learningsOrgId,
      periodLabel: args.periodLabel,
      platformFilter: args.platformFilter,
      filters: args.filters,
    });
  } catch (e) {
    if (e instanceof IsolationError) {
      yield { type: 'error', message: e.message, code: 'isolation' };
      return;
    }
    throw e;
  }
  const lm = (code: FallbackCode, reason: string) =>
    localMeta({
      promptVersion: PROMPT_VERSION,
      syntheticInput: ctx.syntheticInput,
      brandVersion: ctx.brandVersion,
      brandStatus: ctx.brandStatus,
      fallback: { code, reason },
    });
  const toLocal = async (
    code: FallbackCode,
    reason: string,
  ): Promise<AskEvent> => {
    if (FALLBACK_NOTED.includes(code))
      await deps.budget
        .note({
          orgId: args.orgId,
          userId: args.userId,
          task: 'ask',
          provider: 'local',
          model: 'reglas-foxy-v1',
          status: 'fallback',
          cacheHit: false,
          synthetic: ctx.syntheticInput,
          brandVersion: ctx.brandVersion,
        })
        .catch(() => undefined);
    return {
      type: 'local',
      answer: localAnswer({ ...args, question: q }),
      meta: lm(code, reason),
    };
  };

  const decision = await decideGenerative(deps, {
    orgId: args.orgId,
    syntheticInput: ctx.syntheticInput,
    tier: 'content',
  });
  if (decision.use === 'local') {
    yield await toLocal(decision.code, decision.reason);
    return;
  }
  if (!ctx.syntheticInput && ctx.sensitivity.personalHealth) {
    yield await toLocal(
      'sensitive',
      'La publicación parece contener información personal de salud: no se envía a un proveedor externo.',
    );
    return;
  }

  const info = modelInfo(decision.model)!;
  const userText = askUserText(
    ctx.prompt,
    args.scopeLabel,
    prepareUntrustedText(q, 500).text,
  );
  const messages: GenMessage[] = [
    ...historyMessages(args.history),
    { role: 'user', content: [{ type: 'text', text: userText }] },
  ];
  const maxTokens = 1_500;
  const estIn = estimateTokens(
    ASK_SYSTEM.length +
      ctx.brandPrompt.length +
      messages.reduce(
        (s, m) =>
          s +
          m.content.reduce(
            (t, c) => t + (c.type === 'text' ? c.text.length : 0),
            0,
          ),
        0,
      ),
  );
  const limits = await limitsFor(deps, args.orgId);
  const requestId = args.requestId ?? newRequestId(deps);
  const res = await deps.budget.reserve({
    orgId: args.orgId,
    userId: args.userId,
    task: 'ask',
    model: decision.model,
    estUsd: maxCostOf(decision.model, estIn, maxTokens),
    requestId,
    synthetic: ctx.syntheticInput,
    limits,
  });
  if (!res.ok) {
    if (res.code === 'duplicate' || res.code === 'concurrency') {
      yield { type: 'error', message: res.message, code: 'budget' };
      return;
    }
    yield await toLocal(
      res.code === 'kill_switch' ? 'kill_switch' : 'budget',
      res.message,
    );
    return;
  }

  const provider = deps.provider!;
  const baseMeta: GenMeta = {
    state: provider.simulated ? 'simulated' : 'generative',
    provider: provider.id,
    model: decision.model,
    modelLabel: provider.simulated
      ? `Simulación con fixtures (${info.label}) · sin IA real`
      : `${info.label} · IA generativa`,
    local: false,
    simulated: provider.simulated,
    cached: false,
    generatedAt: new Date().toISOString(),
    syntheticInput: ctx.syntheticInput,
    promptVersion: GEN_ASK_PROMPT_VERSION,
    brandVersion: ctx.brandVersion,
    brandStatus: ctx.brandStatus,
    mediaCoverage: null,
    mediaStatement: null,
    costUsd: 0,
    fallback: null,
    droppedEvidence: 0,
    adjustments: [],
    inputHash: null,
    contextHash: null,
  };
  yield { type: 'meta', meta: baseMeta };

  let text = '';
  let lastDraft = 0;
  try {
    for await (const ev of provider.stream(
      {
        tier: 'content',
        model: decision.model,
        system: ASK_SYSTEM,
        cachedContext: ctx.brandPrompt,
        messages,
        maxTokens,
        effort: 'medium',
        requestId,
      },
      args.signal,
    )) {
      if (ev.type === 'delta') {
        text += ev.text;
        if (text.length - lastDraft >= 24) {
          lastDraft = text.length;
          yield { type: 'draft', draft: draftFromText(text) };
        }
        continue;
      }
      const truncated = ev.stopReason === 'max_tokens';
      const cost = provider.simulated ? 0 : costOf(decision.model, ev.usage);
      await deps.budget.settle({
        reservation: res.reservation,
        provider: provider.id,
        usage: ev.usage,
        costUsd: cost,
        status: truncated ? 'incomplete' : 'ok',
        brandVersion: ctx.brandVersion,
        promptVersion: GEN_ASK_PROMPT_VERSION,
      });
      const fin = finalizeAnswer(text, ctx, { truncated });
      const ruled = applyAnswerRules(fin, ctx);
      yield {
        type: 'final',
        answer: ruled.answer,
        meta: {
          ...baseMeta,
          model: ev.model,
          costUsd: cost,
          droppedEvidence: fin.droppedRefs,
          adjustments: ruled.adjustments,
          generatedAt: new Date().toISOString(),
        },
      };
      return;
    }
    throw new ProviderError('incomplete');
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError('server');
    const usage = pe.partialUsage ?? {
      ...ZERO_USAGE,
      // Cancelación sin uso informado: se registra la salida recibida como estimación.
      outputTokens: estimateTokens(text.length),
      inputTokens: text.length ? estIn : 0,
    };
    await deps.budget.settle({
      reservation: res.reservation,
      provider: provider.id,
      usage,
      costUsd: provider.simulated ? 0 : costOf(decision.model, usage),
      status:
        pe.kind === 'cancelled'
          ? 'cancelled'
          : pe.kind === 'refusal'
            ? 'refusal'
            : pe.kind === 'incomplete'
              ? 'incomplete'
              : 'error',
      brandVersion: ctx.brandVersion,
      promptVersion: GEN_ASK_PROMPT_VERSION,
    });
    if (pe.kind === 'cancelled') {
      yield {
        type: 'error',
        message: 'Generación cancelada.',
        code: 'cancelled',
      };
      return;
    }
    yield { type: 'error', message: pe.message, code: 'provider_error' };
    yield await toLocal(
      'provider_error',
      `${pe.message} Se muestra la respuesta del motor local por reglas.`,
    );
  }
}
