'use client';

/**
 * Client-side auth token storage. The access token lives ONLY in memory —
 * never in localStorage — so it cannot be exfiltrated by XSS-persisted
 * scripts. It is lost on a full page refresh; the httpOnly refresh cookie is
 * used to silently re-issue it (see api-client refresh flow).
 *
 * The refresh token itself is never visible to JS: it is an httpOnly cookie
 * (`movos_refresh`) managed entirely by the API.
 */

let accessToken: string | null = null;
let activeOrganizationId: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setActiveOrganizationId(orgId: string | null): void {
  activeOrganizationId = orgId;
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId;
}

export function clearAuth(): void {
  accessToken = null;
  activeOrganizationId = null;
}

/**
 * The client-visible marker `middleware.ts` checks for route protection —
 * moved here (from auth-context.tsx) so api-client.ts can clear it too,
 * without a circular import (auth-context.tsx already imports from
 * api-client.ts). Behavior unchanged from before this move.
 */
const SESSION_COOKIE = 'movos_session';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export function setSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${SESSION_MAX_AGE}; SameSite=Lax; Secure`;
}

export function clearSessionCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`;
}
