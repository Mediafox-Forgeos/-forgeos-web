import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/** Refresca la sesión Supabase (si está configurada) y protege rutas privadas. */
export async function middleware(req: NextRequest) {
  const res = NextResponse.next({ request: req });
  const isPublic =
    req.nextUrl.pathname.startsWith('/login') ||
    req.nextUrl.pathname.startsWith('/api/health');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let authenticated = false;
  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          for (const c of list) res.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    const { data } = await supabase.auth.getUser();
    authenticated = Boolean(data.user);
  } else {
    authenticated = Boolean(req.cookies.get('hf_demo_user')?.value);
  }

  if (!authenticated && !isPublic) {
    const to = req.nextUrl.clone();
    to.pathname = '/login';
    to.search = '';
    return NextResponse.redirect(to);
  }
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico)$).*)',
  ],
};
