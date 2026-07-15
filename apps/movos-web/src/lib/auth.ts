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
