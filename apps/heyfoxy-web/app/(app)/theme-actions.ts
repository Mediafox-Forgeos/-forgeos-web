'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { UI_COOKIE, parseUiTheme } from '@/lib/ui-theme';

/** Guarda la preferencia de tema. Solo presentación: no toca sesión, datos ni permisos. */
export async function setUiTheme(formData: FormData) {
  const theme = parseUiTheme(String(formData.get('theme') ?? ''));
  (await cookies()).set(UI_COOKIE, theme, {
    path: '/',
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}
