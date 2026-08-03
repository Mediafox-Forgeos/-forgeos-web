import { afterEach, describe, expect, it } from 'vitest';

import {
  clearAuth,
  getAccessToken,
  getActiveOrganizationId,
  setAccessToken,
  setActiveOrganizationId,
} from './auth';

afterEach(() => {
  clearAuth();
  window.sessionStorage.clear();
});

describe('client-side auth storage', () => {
  it('stores and clears the access token', () => {
    setAccessToken('abc.def.ghi');
    expect(getAccessToken()).toBe('abc.def.ghi');
    clearAuth();
    expect(getAccessToken()).toBeNull();
  });

  // DEC-022 (WO-ARGOS-015): the active organization id must be backed by
  // sessionStorage, not just an in-memory variable, so it survives a
  // reload of the same tab without falling back to `organizations[0]`.
  it('persists the active organization id to sessionStorage', () => {
    setActiveOrganizationId('org-1');
    expect(getActiveOrganizationId()).toBe('org-1');
    expect(window.sessionStorage.getItem('movos_active_org_id')).toBe('org-1');
  });

  it('recovers the active organization id from sessionStorage after the in-memory cache is cleared, simulating a reload', () => {
    setActiveOrganizationId('org-2');
    // Simulate a fresh module load (e.g. after a page reload) — the
    // in-memory cache is gone, but sessionStorage is untouched by a
    // same-tab reload.
    window.sessionStorage.setItem('movos_active_org_id', 'org-2');

    expect(getActiveOrganizationId()).toBe('org-2');
  });

  it('clears the stored organization id when set to null', () => {
    setActiveOrganizationId('org-3');
    setActiveOrganizationId(null);
    expect(getActiveOrganizationId()).toBeNull();
    expect(window.sessionStorage.getItem('movos_active_org_id')).toBeNull();
  });

  it('clearAuth clears both the access token and the active organization', () => {
    setAccessToken('abc.def.ghi');
    setActiveOrganizationId('org-1');
    clearAuth();
    expect(getAccessToken()).toBeNull();
    expect(getActiveOrganizationId()).toBeNull();
  });
});
