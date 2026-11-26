'use server';

import { revalidatePath } from 'next/cache';
import { requireContext } from '@/lib/auth/session';
import { reviewMemory, saveBrandContext } from '@/lib/brain/store';
import type { MemoryDecision } from '@/lib/brain/types';

export type SaveBrainState =
  | { status: 'idle' }
  | { status: 'saved'; version: number; at: string }
  | { status: 'error'; message: string };

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const val = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/**
 * Guarda Foxy Brand Brain. Solo owner/admin (y en Supabase la RLS de 0007 lo impone).
 * El contenido lo escribe una persona: Foxy nunca modifica la estrategia.
 * Devuelve el estado (sin redirección): la página conserva periodo, filtros y posición, y se
 * evita la pantalla en blanco intermitente que producía el redirect tras guardar (HF-UX-19).
 */
export async function saveBrandBrainAction(
  _prev: SaveBrainState,
  form: FormData,
): Promise<SaveBrainState> {
  const { viewer, active } = await requireContext();
  if (!['owner', 'admin'].includes(active.role))
    return {
      status: 'error',
      message: 'Solo owner o admin pueden editar Brand Brain.',
    };
  const pillars = lines(form.get('pillars')).map((l) => {
    const [name = '', description = '', keywords = ''] = l
      .split('|')
      .map((x) => x.trim());
    return {
      name,
      description,
      keywords: keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    };
  });
  const campaigns = lines(form.get('campaigns')).map((l) => {
    const [name = '', status = '', concept = '', goals = '', keyMessages = ''] =
      l.split('|').map((x) => x.trim());
    return {
      name,
      status: /pasad|histor|past/i.test(status) ? 'past' : 'active',
      concept,
      goals,
      keyMessages,
    };
  });
  let saved;
  try {
    saved = await saveBrandContext(
      active.organization.id,
      {
        identity: {
          name: val(form, 'name'),
          description: val(form, 'description'),
          industry: val(form, 'industry'),
          valueProposition: val(form, 'valueProposition'),
          positioning: val(form, 'positioning'),
          personality: val(form, 'personality'),
          tone: val(form, 'tone'),
          visualGuidelines: val(form, 'visualGuidelines'),
          brandManualRef: val(form, 'brandManualRef'),
        },
        strategy: {
          marketing: val(form, 'marketing'),
          communication: val(form, 'communication'),
          organic: val(form, 'organic'),
          businessGoals: lines(form.get('businessGoals')),
          communicationGoals: lines(form.get('communicationGoals')),
          pillars,
          audiences: lines(form.get('audiences')),
          consumerInsights: lines(form.get('consumerInsights')),
          kpis: lines(form.get('kpis')),
          competitors: lines(form.get('competitors')),
        },
        campaigns,
      },
      active.organization.isDemo,
      viewer.userId,
    );
  } catch {
    return {
      status: 'error',
      message:
        'Revisa los campos: hay valores vacíos o fuera de los límites permitidos (p. ej. un pilar sin nombre).',
    };
  }
  revalidatePath('/brand-brain');
  return {
    status: 'saved',
    version: saved.version,
    at: saved.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Validación humana de un aprendizaje propuesto: aprobar, rechazar (con motivo) o archivar.
 * Solo owner/admin; la RLS y la migración 0008 lo imponen también en la base.
 */
export async function reviewMemoryAction(input: {
  id: string;
  decision: MemoryDecision;
  note: string;
}): Promise<{ ok: true } | { error: string }> {
  const { viewer, active } = await requireContext();
  if (!['owner', 'admin'].includes(active.role))
    return { error: 'Solo owner o admin pueden revisar aprendizajes.' };
  if (!['validated', 'rejected', 'archived'].includes(input.decision))
    return { error: 'Decisión no válida.' };
  try {
    await reviewMemory(
      active.organization.id,
      String(input.id ?? ''),
      input.decision,
      String(input.note ?? ''),
      viewer.userId,
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath('/brand-brain');
  return { ok: true };
}
