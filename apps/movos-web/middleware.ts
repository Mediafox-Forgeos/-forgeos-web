import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Route protection based on the presence of the `movos_session` cookie set by
 * the API alongside the httpOnly refresh cookie. We intentionally do NOT decode
 * any JWT here — the middleware only checks cookie presence and delegates real
 * validation to the API.
 */
const SESSION_COOKIE = 'movos_session';
const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = hasSession ? '/dashboard' : '/login';
    return NextResponse.redirect(url);
  }

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (hasSession && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
