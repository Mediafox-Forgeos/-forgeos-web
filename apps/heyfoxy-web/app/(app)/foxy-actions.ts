'use server';

import { requireContext } from '@/lib/auth/session';
import {
  getBrandContext,
  proposeMemory,
  brainAvailability,
} from '@/lib/brain/store';
import { MemoryKindSchema } from '@/lib/brain/types';
import { analyzePostGenerative } from '@/lib/intel/ai/content';
import { engineDeps } from '@/lib/intel/ai/runtime';
import { loadFoxyScope } from '@/lib/intel/ai/scope';
import { askFoxy } from '@/lib/intel/engine';
import type { AskAnswer, IntelMeta } from '@/lib/intel/schema';
import { parsePeriod, periodDays, periodLabel } from '@/lib/period';
import type { Platform } from '@/lib/types';

/**
 * Ask Foxy contextual (servidor). El contexto (organización, publicación, periodo, red,
 * métricas, histórico, Brand Brain) se reconstruye SIEMPRE en el servidor desde la sesión:
 * el navegador solo envía la pregunta y el alcance. Ningún dato sale a un proveedor externo.
 */
export async function askFoxyAction(input: {
  question: string;
  postId: string | null;
  period: string;
  platform?: string | null;
}): Promise<
  { answer: AskAnswer; meta: IntelMeta; reason: string } | { error: string }
> {
  const question = String(input.question ?? '').trim();
  if (question.length < 3)
    return { error: 'Escribe una pregunta un poco más larga.' };
  if (question.length > 500)
    return { error: 'La pregunta es demasiado larga (máximo 500 caracteres).' };
  const { active, repo } = await requireContext();
  const orgId = active.organization.id;
  const period = parsePeriod(input.period);
  const from = Date.now() - periodDays(period) * 86_400_000;
  const platform = (input.platform || null) as Platform | null;
  const all = await repo.posts(orgId, { limit: 200 });
  const peers = all.filter(
    (p) =>
      (!p.publishedAt || Date.parse(p.publishedAt) >= from) &&
      (!platform || p.platform === platform),
  );
  const post = input.postId ? await repo.post(orgId, input.postId) : null;
  if (input.postId && !post)
    return { error: 'Publicación no encontrada en esta organización.' };
  const brand = (await getBrandContext(orgId))?.context ?? null;
  const r = askFoxy({
    orgId,
    question,
    post,
    peers,
    brand,
    periodLabel: periodLabel(period),
  });
  return { answer: r.answer, meta: r.meta, reason: r.reason };
}

/** «Guardar como aprendizaje»: queda como PROPUESTA hasta que un owner/admin la valide. */
export async function saveLearningAction(input: {
  title: string;
  body: string;
  postId: string | null;
  kind?: string;
}): Promise<{ ok: true } | { error: string }> {
  const { viewer, active, repo } = await requireContext();
  if (!['owner', 'admin', 'analyst'].includes(active.role))
    return { error: 'Tu rol no puede proponer aprendizajes.' };
  if (brainAvailability() !== 'ready')
    return {
      error:
        'La memoria estratégica requiere la migración 0007 (pendiente de GO).',
    };
  const orgId = active.organization.id;
  const post = input.postId ? await repo.post(orgId, input.postId) : null;
  if (input.postId && !post) return { error: 'Publicación no encontrada.' };
  try {
    await proposeMemory(orgId, {
      kind: MemoryKindSchema.catch('learning').parse(input.kind ?? 'learning'),
      title: String(input.title ?? ''),
      body: String(input.body ?? ''),
      evidence: post
        ? [
            {
              label: 'Publicación analizada',
              href: `/publicaciones/${post.id}`,
            },
          ]
        : [],
      sourcePostId: post?.id ?? null,
      isSynthetic: (post?.isSynthetic ?? false) || active.organization.isDemo,
      createdBy: viewer.userId,
    });
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/**
 * Análisis generativo de una publicación BAJO DEMANDA (WO-HF-AI-ENGINE-001 §5): tiene costo,
 * así que lo pide una persona (owner, admin o analyst) y nunca se dispara al abrir la página.
 * El contexto se reconstruye en el servidor para la organización activa. Si la IA generativa
 * no está disponible (sin GO, sin presupuesto, datos no autorizados, error del proveedor), se
 * devuelve el motivo y la página sigue mostrando el motor local.
 */
export async function analyzePostGenerativeAction(input: {
  postId: string;
  period: string;
}): Promise<
  | {
      ok: true;
      engine: 'generative' | 'simulated' | 'local';
      fallback: { code: string; reason: string } | null;
      costUsd: number;
      cached: boolean;
    }
  | { error: string }
> {
  const { viewer, active, repo } = await requireContext();
  if (!['owner', 'admin', 'analyst'].includes(active.role))
    return { error: 'Tu rol no puede solicitar análisis con IA generativa.' };
  const orgId = active.organization.id;
  const scope = await loadFoxyScope(repo, orgId, {
    postId: String(input.postId ?? '').slice(0, 80),
    period: String(input.period ?? '30d'),
  });
  if ('error' in scope) return { error: scope.error };
  const r = await analyzePostGenerative(engineDeps(), {
    orgId,
    userId: viewer.userId,
    post: scope.post!,
    peers: scope.peers,
    brand: scope.brand,
    brandOrgId: scope.brandOrgId,
    learnings: scope.learnings,
    learningsOrgId: scope.learningsOrgId,
    periodLabel: scope.periodLabel,
  });
  return {
    ok: true,
    engine:
      r.meta.state === 'generative'
        ? 'generative'
        : r.meta.state === 'simulated'
          ? 'simulated'
          : 'local',
    fallback: r.meta.fallback,
    costUsd: r.meta.costUsd,
    cached: r.meta.cached,
  };
}
