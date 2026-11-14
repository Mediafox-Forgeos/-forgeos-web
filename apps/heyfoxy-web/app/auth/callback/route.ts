import { NextResponse, type NextRequest } from 'next/server';
import { dataMode } from '@/lib/env';
import { supabaseServer } from '@/lib/supabase/server';

/** Destinos permitidos tras canjear el código (evita redirecciones abiertas). */
const ALLOWED_NEXT = new Set(['/login/nueva-clave', '/']);

/** Canjea el código PKCE del enlace de recuperación por una sesión. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const nextParam = req.nextUrl.searchParams.get('next') ?? '/';
  const next = ALLOWED_NEXT.has(nextParam) ? nextParam : '/';
  const to = req.nextUrl.clone();
  to.search = '';
  if (dataMode() !== 'supabase' || !code) {
    to.pathname = '/login';
    to.searchParams.set('error', 'enlace-invalido');
    return NextResponse.redirect(to);
  }
  const db = await supabaseServer();
  const { error } = await db.auth.exchangeCodeForSession(code);
  to.pathname = error ? '/login' : next;
  if (error) to.searchParams.set('error', 'enlace-invalido');
  return NextResponse.redirect(to);
}
