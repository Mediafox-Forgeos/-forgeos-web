'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { DEMO_COOKIE, ORG_COOKIE, requireContext } from '@/lib/auth/session';
import { dataMode } from '@/lib/env';
import { DEMO_USERS } from '@/lib/demo/seed';
import { supabaseServer } from '@/lib/supabase/server';
import { canManageIncidents, canReviewAlerts } from '@/lib/incidents/fsm';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function loginDemo(formData: FormData) {
  if (dataMode() !== 'demo') throw new Error('Modo demo deshabilitado');
  const id = String(formData.get('user') ?? '');
  if (!DEMO_USERS.some((u) => u.id === id))
    throw new Error('Usuario demo inválido');
  (await cookies()).set(DEMO_COOKIE, id, {
    ...cookieOpts,
    maxAge: 60 * 60 * 8,
  });
  redirect('/');
}

export async function loginPassword(
  _: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const parsed = z
    .object({ email: z.string().email(), password: z.string().min(8) })
    .safeParse({
      email: formData.get('email'),
      password: formData.get('password'),
    });
  if (!parsed.success) return { error: 'Correo o contraseña inválidos' };
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'No fue posible iniciar sesión' };
  redirect('/');
}

/** Origen público de la petición (Preview o local), para el enlace de recuperación. */
async function requestOrigin(): Promise<string | null> {
  const h = await headers();
  const origin = h.get('origin');
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return null;
  const proto = h.get('x-forwarded-proto') ?? 'https';
  return `${proto}://${host}`;
}

/**
 * Recuperación de contraseña (flujo PKCE). Responde SIEMPRE lo mismo, exista o
 * no la cuenta, para no permitir enumerar usuarios.
 */
export async function requestPasswordReset(
  _: unknown,
  formData: FormData,
): Promise<{ done?: boolean; error?: string }> {
  if (dataMode() !== 'supabase')
    return { error: 'No disponible en modo demostración' };
  const email = z.string().email().safeParse(formData.get('email'));
  if (!email.success) return { error: 'Correo inválido' };
  const origin = await requestOrigin();
  if (!origin) return { error: 'No fue posible procesar la solicitud' };
  const db = await supabaseServer();
  await db.auth.resetPasswordForEmail(email.data, {
    // URL exacta, sin query: coincide literalmente con la Redirect URL permitida en Supabase.
    redirectTo: `${origin}/auth/callback`,
  });
  return { done: true };
}

export async function updatePassword(
  _: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  if (dataMode() !== 'supabase')
    return { error: 'No disponible en modo demostración' };
  const parsed = z
    .object({
      password: z.string().min(12).max(128),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ['confirm'] })
    .safeParse({
      password: formData.get('password'),
      confirm: formData.get('confirm'),
    });
  if (!parsed.success)
    return {
      error: 'La contraseña debe tener al menos 12 caracteres y coincidir',
    };
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: 'El enlace expiró. Solicita uno nuevo.' };
  const { error } = await db.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: 'No fue posible actualizar la contraseña' };
  redirect('/');
}

export async function logout() {
  const c = await cookies();
  c.delete(DEMO_COOKIE);
  c.delete(ORG_COOKIE);
  if (dataMode() === 'supabase') await (await supabaseServer()).auth.signOut();
  redirect('/login');
}

export async function switchOrg(formData: FormData) {
  const ctx = await requireContext();
  const id = String(formData.get('org') ?? '');
  if (!ctx.memberships.some((m) => m.organization.id === id))
    throw new Error('Organización no permitida');
  (await cookies()).set(ORG_COOKIE, id, cookieOpts);
  revalidatePath('/', 'layout');
}

export async function reviewAlertAction(formData: FormData) {
  const ctx = await requireContext();
  if (!canReviewAlerts(ctx.active.role))
    throw new Error('Rol sin permiso para revisar');
  const decision = z
    .enum(['confirmed', 'dismissed'])
    .parse(formData.get('decision'));
  await ctx.repo.reviewAlert(
    ctx.active.organization.id,
    String(formData.get('alertId')),
    decision,
    ctx.viewer,
  );
  revalidatePath('/alertas');
  revalidatePath('/revision');
}

export async function openIncidentAction(formData: FormData) {
  const ctx = await requireContext();
  if (!canManageIncidents(ctx.active.role)) throw new Error('Rol sin permiso');
  const id = await ctx.repo.openIncidentFromAlert(
    ctx.active.organization.id,
    String(formData.get('alertId')),
    ctx.viewer,
  );
  redirect(`/incidentes/${encodeURIComponent(id)}`);
}

const statusEnum = z.enum([
  'open',
  'acknowledged',
  'investigating',
  'responding',
  'monitoring',
  'resolved',
  'closed',
  'false_positive',
]);

export async function transitionIncidentAction(
  _: unknown,
  formData: FormData,
): Promise<{ error?: string }> {
  const ctx = await requireContext();
  if (!canManageIncidents(ctx.active.role)) return { error: 'Rol sin permiso' };
  const id = String(formData.get('incidentId'));
  try {
    await ctx.repo.transitionIncident(
      ctx.active.organization.id,
      id,
      statusEnum.parse(formData.get('to')),
      ctx.viewer,
      String(formData.get('resolution') ?? '').trim() || undefined,
    );
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath(`/incidentes/${id}`);
  return {};
}

export async function assignIncidentAction(formData: FormData) {
  const ctx = await requireContext();
  if (!canManageIncidents(ctx.active.role)) throw new Error('Rol sin permiso');
  const id = String(formData.get('incidentId'));
  await ctx.repo.assignIncident(
    ctx.active.organization.id,
    id,
    String(formData.get('owner')),
    ctx.viewer,
  );
  revalidatePath(`/incidentes/${id}`);
}

export async function noteIncidentAction(formData: FormData) {
  const ctx = await requireContext();
  if (!canManageIncidents(ctx.active.role)) throw new Error('Rol sin permiso');
  const id = String(formData.get('incidentId'));
  const body = z.string().trim().min(1).max(2000).parse(formData.get('body'));
  await ctx.repo.addIncidentNote(
    ctx.active.organization.id,
    id,
    body,
    ctx.viewer,
  );
  revalidatePath(`/incidentes/${id}`);
}
