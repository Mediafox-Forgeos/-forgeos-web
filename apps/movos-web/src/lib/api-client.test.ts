import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * api-client.ts and auth.ts both hold module-level mutable state
 * (refreshPromise, redirectingToLogin, the in-memory access token) that must
 * never leak between tests — vi.resetModules() + a fresh dynamic import per
 * test gives each test its own module instance, matching a real fresh page
 * load rather than accumulating state across tests in this file.
 */
async function freshApiClient() {
  vi.resetModules();
  const apiClientModule = await import('./api-client');
  const authModule = await import('./auth');
  return { apiClient: apiClientModule.apiClient, auth: authModule };
}

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

/** jsdom's Location.prototype.assign is non-configurable — vi.spyOn can't
 * touch it directly. Replacing `window.location` wholesale is the standard
 * workaround. */
function mockLocationAssign(pathname = '/dashboard') {
  const assign = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname, assign },
    writable: true,
    configurable: true,
  });
  return assign;
}

beforeEach(() => {
  document.cookie = 'movos_session=1; path=/; max-age=999999';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = 'movos_session=; path=/; max-age=0';
});

describe('api-client — single-flight refresh', () => {
  it('5 concurrent 401s trigger exactly one POST /auth/refresh, and all 5 original requests succeed after it', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');

    let refreshCalls = 0;
    global.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        return fakeResponse(200, { accessToken: 'new-token' });
      }
      const headers = init?.headers as Headers;
      if (headers.get('Authorization') === 'Bearer new-token') {
        return fakeResponse(200, { ok: true });
      }
      return fakeResponse(401, { message: 'unauthorized' });
    }) as typeof fetch;

    const results = await Promise.all([
      apiClient.get('/foo1'),
      apiClient.get('/foo2'),
      apiClient.get('/foo3'),
      apiClient.get('/foo4'),
      apiClient.get('/foo5'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(results).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
  });

  it('refresh promise is cleared after success — a later, genuinely new refresh can still happen', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');

    let latestValidToken = 'irrelevant';
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        latestValidToken = `token-${refreshCalls}`;
        return fakeResponse(200, { accessToken: latestValidToken });
      }
      const headers = init?.headers as Headers;
      if (headers.get('Authorization') === `Bearer ${latestValidToken}`) {
        return fakeResponse(200, { ok: true });
      }
      return fakeResponse(401, {});
    }) as typeof fetch;

    await apiClient.get('/foo');
    expect(refreshCalls).toBe(1);

    // A second, independent expiry later (e.g. the access token's own TTL
    // elapsed again) — the in-memory token is now stale from the server's
    // point of view, exactly as it would be after another 15 minutes.
    auth.setAccessToken('now-stale-again');
    await apiClient.get('/bar');
    expect(refreshCalls).toBe(2);
  });

  it('refresh promise is cleared after failure — no deadlock for a subsequent attempt', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');
    mockLocationAssign();

    let refreshCalls = 0;
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        return fakeResponse(401, {});
      }
      return fakeResponse(401, {});
    }) as typeof fetch;

    await expect(apiClient.get('/foo')).rejects.toThrow();
    expect(refreshCalls).toBe(1);

    // Module state must allow a fresh refresh attempt on the next request,
    // not hang forever on the first (already-settled) promise.
    await expect(apiClient.get('/bar')).rejects.toThrow();
    expect(refreshCalls).toBe(2);
  });
});

describe('api-client — unrecoverable refresh failure', () => {
  it('3 concurrent requests failing refresh together produce exactly one navigation to /login, not a loop', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');
    const assign = mockLocationAssign();

    let refreshCalls = 0;
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        return fakeResponse(401, {});
      }
      return fakeResponse(401, {});
    }) as typeof fetch;

    const results = await Promise.allSettled([
      apiClient.get('/foo1'),
      apiClient.get('/foo2'),
      apiClient.get('/foo3'),
    ]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(refreshCalls).toBe(1);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith('/login');
  });

  it('clears the movos_session cookie so middleware cannot bounce /login back to /dashboard', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');
    mockLocationAssign();

    global.fetch = vi.fn(async () => fakeResponse(401, {})) as typeof fetch;

    expect(document.cookie).toContain('movos_session=1');
    await expect(apiClient.get('/foo')).rejects.toThrow();
    expect(document.cookie).not.toContain('movos_session=1');
  });

  it('does not navigate again if already on /login', async () => {
    const { apiClient, auth } = await freshApiClient();
    auth.setAccessToken('old-token');
    const assign = mockLocationAssign('/login');

    global.fetch = vi.fn(async () => fakeResponse(401, {})) as typeof fetch;

    await expect(apiClient.get('/foo')).rejects.toThrow();
    expect(assign).not.toHaveBeenCalled();
  });
});
