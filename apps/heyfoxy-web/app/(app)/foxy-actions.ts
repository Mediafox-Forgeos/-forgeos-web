'use server';

import { requireContext } from '@/lib/auth/session';
import {
  getBrandContext,
  proposeMemory,
  brainAvailability,
} from '@/lib/brain/store';
import { MemoryKindSchema } from '@/lib/brain/types';
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
