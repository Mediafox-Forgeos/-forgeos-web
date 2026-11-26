import 'server-only';
import type { BrandContext } from '@/lib/brain/types';
import { PILOT_LIMITS } from '@/lib/sync/pilot';
import type { Post } from '@/lib/types';
import {
  decideProvider,
  intelInputHash,
  validateAnswer,
  validateIntel,
} from './guard';
import { LOCAL_PROVIDER, analyzePostLocal, answerLocal } from './local';
import {
  PROMPT_VERSION,
  type AskAnswer,
  type IntelMeta,
  type PostIntel,
} from './schema';

/**
 * Orquestador de Foxy Intelligence (servidor). Decide proveedor (guard.ts), evita reanalizar
 * contenido que no cambió (caché por hash de entrada), valida la salida y devuelve metadatos
 * honestos: proveedor, modelo, si es motor local, si la entrada era sintética.
 * Costo del motor local: 0 (no se registra en ai_usage; el registro aplica a proveedores
 * externos cuando tengan GO).
 */
const CACHE_MAX = 500;
const cache = new Map<string, PostIntel>();

/** Comentarios reales desactivados por la política del piloto (no aplica a sintéticos). */
export function commentsDisabledFor(post: Pick<Post, 'isSynthetic'>): boolean {
  return !post.isSynthetic && PILOT_LIMITS.importComments === false;
}

function fingerprint(post: Post, peers: Post[], brand: BrandContext | null) {
  return {
    post: {
      id: post.id,
      body: post.body,
      ct: post.contentType,
      m: post.metrics,
      media: post.media?.length ?? 0,
    },
    peers: peers.map((p) => [
      p.id,
      p.platform,
      p.contentType,
      p.metrics[0] ?? null,
    ]),
    brand,
  };
}

export interface IntelResult {
  status: 'ok' | 'disabled';
  intel: PostIntel | null;
  meta: IntelMeta;
  reason: string;
}

export function getPostIntel(args: {
  orgId: string;
  post: Post;
  peers: Post[];
  brand: BrandContext | null;
  periodLabel: string;
}): IntelResult {
  const syntheticInput =
    args.post.isSynthetic && args.peers.every((p) => p.isSynthetic);
  const decision = decideProvider({
    env: process.env,
    orgId: args.orgId,
    syntheticInput,
  });
  const baseMeta = {
    provider: LOCAL_PROVIDER.id,
    model: LOCAL_PROVIDER.model,
    local: true,
    generatedAt: new Date().toISOString(),
    syntheticInput,
    promptVersion: PROMPT_VERSION,
  };
  if (decision.use === 'disabled')
    return {
      status: 'disabled',
      intel: null,
      meta: { ...baseMeta, cached: false },
      reason: decision.reason,
    };
  const key = `${args.orgId}:${intelInputHash(fingerprint(args.post, args.peers, args.brand), PROMPT_VERSION, LOCAL_PROVIDER.model)}`;
  const hit = cache.get(key);
  if (hit)
    return {
      status: 'ok',
      intel: hit,
      meta: { ...baseMeta, cached: true },
      reason: decision.reason,
    };
  const raw = analyzePostLocal({
    post: args.post,
    peers: args.peers,
    brand: args.brand,
    commentsDisabled: commentsDisabledFor(args.post),
    periodLabel: args.periodLabel,
  });
  const intel = validateIntel(raw, [
    args.post.id,
    ...args.peers.map((p) => p.id),
  ]);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, intel);
  return {
    status: 'ok',
    intel,
    meta: { ...baseMeta, cached: false },
    reason: decision.reason,
  };
}

export function askFoxy(args: {
  orgId: string;
  question: string;
  post: Post | null;
  peers: Post[];
  brand: BrandContext | null;
  periodLabel: string;
}): {
  answer: AskAnswer;
  meta: IntelMeta;
  reason: string;
  status: 'ok' | 'disabled';
} {
  const q = args.question.trim().slice(0, 500);
  const syntheticInput =
    (args.post?.isSynthetic ?? true) && args.peers.every((p) => p.isSynthetic);
  const decision = decideProvider({
    env: process.env,
    orgId: args.orgId,
    syntheticInput,
  });
  const meta: IntelMeta = {
    provider: LOCAL_PROVIDER.id,
    model: LOCAL_PROVIDER.model,
    local: true,
    cached: false,
    generatedAt: new Date().toISOString(),
    syntheticInput,
    promptVersion: PROMPT_VERSION,
  };
  if (decision.use === 'disabled')
    return {
      status: 'disabled',
      meta,
      reason: decision.reason,
      answer: {
        question: q,
        findings: [],
        unanswerable: decision.reason,
        suggestions: [],
      },
    };
  const intel = args.post
    ? getPostIntel({
        orgId: args.orgId,
        post: args.post,
        peers: args.peers,
        brand: args.brand,
        periodLabel: args.periodLabel,
      }).intel
    : null;
  const answer = validateAnswer(
    answerLocal(q, {
      intel,
      post: args.post,
      peers: args.peers,
      brand: args.brand,
      periodLabel: args.periodLabel,
    }),
    [...(args.post ? [args.post.id] : []), ...args.peers.map((p) => p.id)],
  );
  return { status: 'ok', answer, meta, reason: decision.reason };
}
