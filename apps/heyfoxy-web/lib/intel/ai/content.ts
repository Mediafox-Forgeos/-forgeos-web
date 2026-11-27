import { z } from 'zod';
import type { MemoryEntry, StoredBrandContext } from '@/lib/brain/types';
import type { Post } from '@/lib/types';
import { commentsDisabledFor } from '../engine';
import { intelInputHash, validateIntel } from '../guard';
import { analyzePostLocal } from '../local';
import type { Finding, PostIntel } from '../schema';
import {
  costOf,
  estimateTokens,
  imageTokens,
  maxCostOf,
  modelInfo,
} from './catalog';
import { multimodalClearance } from './config';
import {
  buildFoxyContext,
  IsolationError,
  resolveRefs,
  type FoxyContext,
} from './context';
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
import { planMedia, type MediaPlan } from './media';
import {
  CONTENT_JSON_SCHEMA,
  CONTENT_SYSTEM,
  GEN_CONTENT_PROMPT_VERSION,
  contentUserText,
} from './prompts';
import { ProviderError, type ContentBlock } from './provider';
import { applyFindingRules } from './rules';

/**
 * Foxy Content Intelligence generativo (WO-HF-AI-ENGINE-001 §5, §6, §8).
 *
 * Reparto de responsabilidades:
 *  · CÓDIGO (motor local, determinístico): formato, métricas, comparaciones, rendimiento
 *    verificado, estado estratégico, reputación, límites.
 *  · MODELO: interpretación del copy y del concepto, hook, CTA, intención, objetivo probable,
 *    análisis visual, alineación estratégica, oportunidades creativas, recomendaciones y A/B.
 * La salida del modelo se valida (esquema + referencias + reglas) y se combina con la base
 * determinística. Se guarda en caché por hash de entrada (incluye versión de Brand Brain,
 * versión de instrucciones, modelo y cobertura visual): no se reanaliza lo que no cambió.
 */
const GenFinding = z.object({
  area: z.enum(['content', 'performance', 'strategic', 'creative']),
  kind: z.enum(['fact', 'interpretation', 'hypothesis', 'recommendation']),
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().max(700).default(''),
  refs: z.array(z.string()).max(12).default([]),
  confidence: z.enum(['alta', 'media', 'baja']).nullable().default(null),
  limitation: z.string().trim().max(300).nullable().default(null),
});
const nstr = (max: number) =>
  z.string().trim().max(max).nullable().default(null);
export const GenContentSchema = z.object({
  content: z.object({
    theme: nstr(120),
    territory: nstr(120),
    objective: nstr(160),
    intent: nstr(160),
    hook: nstr(300),
    cta: nstr(200),
    visual: nstr(400),
  }),
  findings: z.array(GenFinding).max(12),
  hooks: z.array(z.string().trim().min(1).max(200)).max(5).default([]),
  ctas: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
  abTests: z
    .array(
      z.object({
        hypothesis: z.string().trim().min(1).max(300),
        variantA: z.string().trim().min(1).max(200),
        variantB: z.string().trim().min(1).max(200),
        metric: z.string().trim().min(1).max(80),
      }),
    )
    .max(3)
    .default([]),
  strategic: z.object({ pillar: nstr(80), campaign: nstr(120) }),
  limitations: z.array(z.string().trim().max(300)).max(8).default([]),
});

export interface ContentResult {
  intel: PostIntel;
  meta: GenMeta;
  /** Hay un análisis generativo anterior para esta publicación con otra entrada. */
  stale: null | {
    reason: 'brand_changed' | 'input_changed';
    previousBrandVersion: number | null;
  };
}

export interface ContentArgs {
  orgId: string;
  userId: string;
  post: Post;
  peers: Post[];
  brand: StoredBrandContext | null;
  brandOrgId: string | null;
  learnings: MemoryEntry[];
  learningsOrgId: string | null;
  periodLabel: string;
  signal?: AbortSignal;
  requestId?: string;
}

export function contextHash(ctx: FoxyContext) {
  return intelInputHash(
    {
      prompt: ctx.prompt,
      brand: ctx.brandPrompt,
      brandVersion: ctx.brandVersion,
    },
    GEN_CONTENT_PROMPT_VERSION,
    'contexto',
  );
}

function contentHash(ctx: FoxyContext, plan: MediaPlan, model: string) {
  return intelInputHash(
    {
      prompt: ctx.prompt,
      brand: ctx.brandPrompt,
      brandVersion: ctx.brandVersion,
      media: {
        coverage: plan.coverage,
        url: plan.url ? plan.url.split('?')[0] : null,
      },
    },
    GEN_CONTENT_PROMPT_VERSION,
    model,
  );
}

/** Solo se aceptan pilar y campaña que EXISTEN en el Brand Brain (no se inventan). */
function knownName(value: string | null, names: string[]): string | null {
  if (!value) return null;
  const f = (s: string) =>
    s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  return names.find((n) => f(n) === f(value)) ?? null;
}

function toFinding(
  g: z.infer<typeof GenFinding>,
  ctx: FoxyContext,
): { finding: Finding & { area: string }; dropped: number } {
  const r = resolveRefs(g.refs, ctx);
  return {
    finding: {
      area: g.area,
      kind: g.kind,
      title: g.title,
      detail: g.detail,
      evidence: r.evidence,
      confidence: g.kind === 'fact' ? null : g.confidence,
      limitation: g.limitation,
    },
    dropped: r.dropped,
  };
}

/** Quita el área interna del hallazgo antes de mostrarlo. */
function stripArea(f: Finding & { area?: string }): Finding {
  const { area, ...rest } = f;
  void area;
  return rest;
}

export function mergeContent(
  local: PostIntel,
  gen: z.infer<typeof GenContentSchema>,
  ctx: FoxyContext,
  brand: StoredBrandContext | null,
  plan: MediaPlan,
  allowedPostIds: string[],
): { intel: PostIntel; dropped: number; adjustments: string[] } {
  let dropped = 0;
  const mapped = gen.findings.map((g) => {
    const x = toFinding(g, ctx);
    dropped += x.dropped;
    return x.finding;
  });
  const ruled = applyFindingRules(mapped, {
    sample: ctx.sample,
    commentsImported: false,
  });
  const adjustments = ruled.adjustments;
  // Sin Brand Brain no hay base para evaluar la estrategia: los hallazgos estratégicos del
  // modelo se descartan (el motor local ya declara que falta el contexto).
  const findings =
    ctx.brandStatus === 'missing'
      ? ruled.findings.filter((f) => {
          if (f.area !== 'strategic') return true;
          adjustments.push(
            `Hallazgo estratégico descartado por falta de Brand Brain: «${f.title.slice(0, 80)}».`,
          );
          return false;
        })
      : ruled.findings;
  const by = (area: string) =>
    findings.filter((f) => f.area === area).map(stripArea);
  const pillars = brand?.context.strategy.pillars.map((p) => p.name) ?? [];
  const campaigns = brand?.context.campaigns.map((c) => c.name) ?? [];
  const pillar = knownName(gen.strategic.pillar, pillars);
  const campaign = knownName(gen.strategic.campaign, campaigns);
  if (gen.strategic.pillar && !pillar)
    adjustments.push(
      'Pilar sugerido que no existe en Brand Brain: descartado.',
    );
  if (gen.strategic.campaign && !campaign)
    adjustments.push(
      'Campaña sugerida que no existe en Brand Brain: descartada.',
    );
  // Las limitaciones propias del motor local (p. ej. «sin IA generativa») no aplican aquí.
  const localLimits = local.limitations.filter(
    (l) => !/motor local|sin ia generativa|proveedor de ia autorizado/i.test(l),
  );
  const limitations = [...localLimits, plan.statement, ...gen.limitations]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .slice(0, 8);
  const intel: PostIntel = {
    content: {
      ...local.content,
      theme: gen.content.theme ?? local.content.theme,
      territory: gen.content.territory ?? local.content.territory,
      objective: gen.content.objective,
      intent: gen.content.intent ?? local.content.intent,
      hook: gen.content.hook ?? local.content.hook,
      cta: gen.content.cta ?? local.content.cta,
      visual:
        plan.coverage === 'image_full' ||
        plan.coverage === 'carousel_cover' ||
        plan.coverage === 'video_thumbnail'
          ? gen.content.visual
          : null,
      // Si el modelo no aporta hallazgos de un área, se conservan los verificados del motor local.
      findings: (by('content').length
        ? by('content')
        : local.content.findings
      ).slice(0, 10),
    },
    performance: {
      // Base verificada por código + interpretación del modelo.
      findings: [...local.performance.findings, ...by('performance')].slice(
        0,
        10,
      ),
      peers: local.performance.peers,
    },
    strategic: {
      status: local.strategic.status,
      pillar: pillar ?? local.strategic.pillar,
      campaign: campaign ?? local.strategic.campaign,
      findings: (by('strategic').length
        ? by('strategic')
        : local.strategic.findings
      ).slice(0, 8),
    },
    creative: {
      findings: (by('creative').length
        ? by('creative')
        : local.creative.findings
      ).slice(0, 10),
      hooks: gen.hooks.slice(0, 5),
      ctas: gen.ctas.slice(0, 5),
      abTests: gen.abTests.slice(0, 3),
    },
    reputation: local.reputation,
    limitations,
  };
  return { intel: validateIntel(intel, allowedPostIds), dropped, adjustments };
}

export async function analyzePostGenerative(
  deps: EngineDeps,
  args: ContentArgs,
): Promise<ContentResult> {
  const local = analyzePostLocal({
    post: args.post,
    peers: args.peers,
    brand: args.brand?.context ?? null,
    commentsDisabled: commentsDisabledFor(args.post),
    periodLabel: args.periodLabel,
  });
  const allowed = [args.post.id, ...args.peers.map((p) => p.id)];
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
    });
  } catch (e) {
    if (e instanceof IsolationError)
      return fallback(local, allowed, null, 'isolation', e.message, args, null);
    throw e;
  }
  const fb = async (
    code: FallbackCode,
    reason: string,
    stale: ContentResult['stale'] = null,
  ) => {
    // Se registra cada vez que la IA generativa estaba habilitada pero se usó el respaldo.
    if (FALLBACK_NOTED.includes(code))
      await deps.budget
        .note({
          orgId: args.orgId,
          userId: args.userId,
          task: 'content_analysis',
          provider: 'local',
          model: 'reglas-foxy-v1',
          status: 'fallback',
          cacheHit: false,
          synthetic: ctx.syntheticInput,
          brandVersion: ctx.brandVersion,
        })
        .catch(() => undefined);
    return fallback(local, allowed, ctx, code, reason, args, stale);
  };

  const decision = await decideGenerative(deps, {
    orgId: args.orgId,
    syntheticInput: ctx.syntheticInput,
    tier: 'content',
  });
  if (decision.use === 'local') return fb(decision.code, decision.reason);
  if (!ctx.syntheticInput && ctx.sensitivity.personalHealth)
    return fb(
      'sensitive',
      `El copy parece contener información personal de salud (${ctx.sensitivity.reasons.join(' ')}): no se envía a un proveedor externo.`,
    );

  const model = modelInfo(decision.model)!;
  let plan = planMedia(args.post);
  const multimodal =
    model.vision &&
    multimodalClearance(deps.config, args.orgId, ctx.syntheticInput) &&
    !!plan.url &&
    !!deps.fetchImage;
  if (!multimodal && plan.url)
    plan = {
      ...plan,
      coverage: 'unavailable',
      url: null,
      statement:
        'Análisis visual no autorizado para esta organización todavía: solo texto y métricas.',
    };
  const hash = contentHash(ctx, plan, decision.model);
  const subject = `post:${args.post.id}`;
  const hit = await deps.cache.get<PostIntel>(args.orgId, subject, hash);
  if (hit) {
    await deps.budget.note({
      orgId: args.orgId,
      userId: args.userId,
      task: 'content_analysis',
      provider: hit.meta.provider,
      model: hit.meta.model,
      status: 'ok',
      cacheHit: true,
      synthetic: ctx.syntheticInput,
      brandVersion: ctx.brandVersion,
    });
    return {
      intel: hit.value,
      meta: { ...hit.meta, cached: true },
      stale: null,
    };
  }

  // Imagen: en memoria, nunca a Storage. Si falla, se declara y se sigue solo con texto.
  const blocks: ContentBlock[] = [];
  let imgTokens = 0;
  if (multimodal && plan.url) {
    try {
      const img = await deps.fetchImage!(plan.url, args.signal);
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
      });
      imgTokens = imageTokens(plan.width, plan.height);
    } catch (e) {
      const code = (e as { code?: string }).code ?? 'error';
      plan = {
        ...plan,
        coverage: code === 'caducada' ? 'expired' : 'unavailable',
        url: null,
        statement:
          code === 'caducada'
            ? 'La vista previa caducó: análisis solo de texto y métricas.'
            : `La imagen no se pudo obtener de forma segura (${code}): análisis solo de texto y métricas.`,
      };
    }
  }
  const userText = contentUserText(
    ctx.prompt,
    blocks.length ? plan.statement : null,
  );
  blocks.push({ type: 'text', text: userText });
  const maxTokens = 2_500;
  const estIn =
    estimateTokens(
      CONTENT_SYSTEM.length + ctx.brandPrompt.length + userText.length,
    ) + imgTokens;
  const limits = await limitsFor(deps, args.orgId);
  const requestId = args.requestId ?? newRequestId(deps);
  const res = await deps.budget.reserve({
    orgId: args.orgId,
    userId: args.userId,
    task: 'content_analysis',
    model: decision.model,
    estUsd: maxCostOf(decision.model, estIn, maxTokens),
    requestId,
    synthetic: ctx.syntheticInput,
    limits,
  });
  if (!res.ok)
    return fb(
      res.code === 'kill_switch' ? 'kill_switch' : 'budget',
      res.message,
    );

  try {
    const out = await deps.provider!.complete(
      {
        tier: 'content',
        model: decision.model,
        system: CONTENT_SYSTEM,
        cachedContext: ctx.brandPrompt,
        messages: [{ role: 'user', content: blocks }],
        maxTokens,
        effort: 'medium',
        jsonSchema: CONTENT_JSON_SCHEMA as unknown as Record<string, unknown>,
        requestId,
      },
      args.signal,
    );
    const cost = deps.provider!.simulated
      ? 0
      : costOf(decision.model, out.usage);
    let parsed: z.infer<typeof GenContentSchema>;
    try {
      parsed = GenContentSchema.parse(JSON.parse(out.text));
    } catch {
      await deps.budget.settle({
        reservation: res.reservation,
        provider: deps.provider!.id,
        usage: out.usage,
        costUsd: cost,
        status: 'error',
        brandVersion: ctx.brandVersion,
        promptVersion: GEN_CONTENT_PROMPT_VERSION,
      });
      return fb(
        'invalid_output',
        'La respuesta del proveedor no cumplió el esquema validado y se descartó.',
      );
    }
    const merged = mergeContent(local, parsed, ctx, args.brand, plan, allowed);
    await deps.budget.settle({
      reservation: res.reservation,
      provider: deps.provider!.id,
      usage: out.usage,
      costUsd: cost,
      status: 'ok',
      brandVersion: ctx.brandVersion,
      promptVersion: GEN_CONTENT_PROMPT_VERSION,
    });
    const meta: GenMeta = {
      state: deps.provider!.simulated ? 'simulated' : 'generative',
      provider: deps.provider!.id,
      model: out.model,
      modelLabel: deps.provider!.simulated
        ? `Simulación con fixtures (${model.label}) · sin IA real`
        : `${model.label} · IA generativa`,
      local: false,
      simulated: deps.provider!.simulated,
      cached: false,
      generatedAt: new Date().toISOString(),
      syntheticInput: ctx.syntheticInput,
      promptVersion: GEN_CONTENT_PROMPT_VERSION,
      brandVersion: ctx.brandVersion,
      brandStatus: ctx.brandStatus,
      mediaCoverage: plan.coverage,
      mediaStatement: plan.statement,
      costUsd: cost,
      fallback: null,
      droppedEvidence: merged.dropped,
      adjustments: merged.adjustments,
      inputHash: hash,
      contextHash: contextHash(ctx),
    };
    await deps.cache.put(
      args.orgId,
      subject,
      { inputHash: hash, value: merged.intel, meta },
      ctx.syntheticInput,
    );
    return { intel: merged.intel, meta, stale: null };
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError('server');
    const usage = pe.partialUsage;
    await deps.budget.settle({
      reservation: res.reservation,
      provider: deps.provider!.id,
      usage: usage ?? {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
      costUsd:
        usage && !deps.provider!.simulated ? costOf(decision.model, usage) : 0,
      status:
        pe.kind === 'cancelled'
          ? 'cancelled'
          : pe.kind === 'refusal'
            ? 'refusal'
            : pe.kind === 'incomplete'
              ? 'incomplete'
              : 'error',
      brandVersion: ctx.brandVersion,
      promptVersion: GEN_CONTENT_PROMPT_VERSION,
    });
    return fb('provider_error', pe.message);
  }
}

/** Análisis generativo guardado (sin llamar al proveedor) y si quedó desactualizado. */
export async function cachedContentAnalysis(
  deps: EngineDeps,
  args: Omit<ContentArgs, 'userId' | 'signal' | 'requestId'>,
): Promise<ContentResult | null> {
  const last = await deps.cache.latest<PostIntel>(
    args.orgId,
    `post:${args.post.id}`,
  );
  if (!last) return null;
  let ctx: FoxyContext;
  try {
    ctx = buildFoxyContext({ ...args, post: args.post });
  } catch {
    return null;
  }
  const stale =
    contextHash(ctx) === last.meta.contextHash
      ? null
      : {
          reason:
            last.meta.brandVersion !== ctx.brandVersion
              ? ('brand_changed' as const)
              : ('input_changed' as const),
          previousBrandVersion: last.meta.brandVersion,
        };
  return { intel: last.value, meta: { ...last.meta, cached: true }, stale };
}

function fallback(
  local: PostIntel,
  allowed: string[],
  ctx: FoxyContext | null,
  code: FallbackCode,
  reason: string,
  args: ContentArgs,
  stale: ContentResult['stale'],
): ContentResult {
  return {
    intel: validateIntel(local, allowed),
    meta: localMeta({
      promptVersion: GEN_CONTENT_PROMPT_VERSION,
      syntheticInput: ctx?.syntheticInput ?? args.post.isSynthetic,
      brandVersion: ctx?.brandVersion ?? args.brand?.version ?? null,
      brandStatus: ctx?.brandStatus ?? 'missing',
      fallback: { code, reason },
    }),
    stale,
  };
}
