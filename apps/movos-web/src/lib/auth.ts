'use client';

/**
 * Client-side auth token storage. The access token lives ONLY in memory —
 * never in localStorage — so it cannot be exfiltrated by XSS-persisted
 * scripts. It is lost on a full page refresh; the httpOnly refresh cookie is
 * used to silently re-issue it (see api-client refresh flow).
 *
 * The refresh token itself is never visible to JS: it is an httpOnly cookie
 * (`movos_refresh`) managed entirely by the API.
 *
 * The active organization id (DEC-022, WO-ARGOS-015) is backed by
 * `sessionStorage`, not memory alone and not `localStorage`/a cookie. This
 * is the only browser-native storage that is simultaneously per-tab-isolated
 * (Tab A and Tab B never see each other's value — required for multi-tab
 * correctness) and survives a reload of that same tab (required so
 * "selection survives page reload" without falling back to the
 * non-deterministic `organizations[0]` this WO forbids). It holds only an
 * id, never a secret, so its lower storage-sensitivity than the access
 * token is an acceptable trade-off.
 */

const ACTIVE_ORG_STORAGE_KEY = 'movos_active_org_id';

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
  if (typeof window === 'undefined') return;
  if (orgId) {
    window.sessionStorage.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
  } else {
    window.sessionStorage.removeItem(ACTIVE_ORG_STORAGE_KEY);
  }
}

export function getActiveOrganizationId(): string | null {
  if (activeOrganizationId) return activeOrganizationId;
  if (typeof window === 'undefined') return null;
  const stored = window.sessionStorage.getItem(ACTIVE_ORG_STORAGE_KEY);
  activeOrganizationId = stored;
  return stored;
}

export function clearAuth(): void {
  accessToken = null;
  setActiveOrganizationId(null);
}
