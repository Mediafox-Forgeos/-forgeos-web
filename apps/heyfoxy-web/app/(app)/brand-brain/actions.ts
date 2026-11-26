'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/auth/session';
import { saveBrandContext } from '@/lib/brain/store';

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? '')
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const val = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

/**
 * Guarda Foxy Brand Brain. Solo owner/admin (y en Supabase la RLS de 0007 lo impone).
 * El contenido lo escribe una persona: Foxy nunca modifica la estrategia.
 */
export async function saveBrandBrainAction(form: FormData) {
  const { active } = await requireContext();
  if (!['owner', 'admin'].includes(active.role))
    redirect('/brand-brain?error=rol');
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
  try {
    await saveBrandContext(active.organization.id, {
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
    });
  } catch {
    redirect('/brand-brain?error=validacion');
  }
  revalidatePath('/brand-brain');
  redirect('/brand-brain?guardado=1');
}
