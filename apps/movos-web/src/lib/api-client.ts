'use client';

import {
  clearAuth,
  clearSessionCookie,
  getAccessToken,
  getActiveOrganizationId,
  setAccessToken,
} from './auth';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_MOVOS_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Skip the automatic 401 -> refresh -> retry loop (used by refresh itself). */
  skipRefresh?: boolean;
  /** Skip attaching the X-Organization-Id header. */
  skipOrgHeader?: boolean;
}

function buildUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalized}`;
}

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!options.skipOrgHeader) {
    const orgId = getActiveOrganizationId();
    if (orgId) {
      headers.set('X-Organization-Id', orgId);
    }
  }
  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(data.message)) {
      return data.message.join(', ');
    }
    return data.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

async function performRefresh(): Promise<string | null> {
  try {
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { accessToken?: string };
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

/** Single in-flight refresh at a time, shared by every caller. The backend
 * rotates the refresh token cookie on every /auth/refresh call — without
 * this, N concurrent 401s (e.g. several polling widgets after an idle tab)
 * would each present the same not-yet-rotated cookie, only the first would
 * succeed, and every other one would fail even though the session itself
 * was perfectly valid. Cleared in `finally` so a later, genuinely new
 * refresh (e.g. the next natural token expiry) isn't stuck reusing a
 * resolved promise. */
let refreshPromise: Promise<string | null> | null = null;

/**
 * Attempts to silently refresh the access token using the httpOnly cookie.
 * Returns the new token, or null if the session cannot be refreshed.
 */
function attemptRefresh(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function execute<T>(path: string, options: RequestOptions): Promise<T> {
  const response = await fetch(buildUrl(path), {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: buildHeaders(options),
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (
    response.status === 401 &&
    !options.skipRefresh &&
    typeof window !== 'undefined'
  ) {
    const newToken = await attemptRefresh();
    if (newToken) {
      const retry = await fetch(buildUrl(path), {
        method: options.method ?? 'GET',
        credentials: 'include',
        headers: buildHeaders({ ...options, skipRefresh: true }),
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
      if (!retry.ok) {
        if (retry.status === 401) {
          clearAuth();
          redirectToLogin();
        }
        throw new ApiError(retry.status, await parseError(retry));
      }
      return (await parseJson<T>(retry)) as T;
    }
    clearAuth();
    redirectToLogin();
    throw new ApiError(401, 'Sesión expirada');
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  return (await parseJson<T>(response)) as T;
}

async function parseJson<T>(response: Response): Promise<T | undefined> {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  return JSON.parse(text) as T;
}

/** Single-flight refresh means every request that was concurrently 401'd
 * shares one failure outcome, but each still independently reaches this
 * function — without this guard, N failed requests would call
 * window.location.assign N times. Never reset: once a page instance has
 * decided to navigate away, it never should again (a real navigation tears
 * down this JS realm; the guard just makes that true under test/timing
 * conditions too, not only by luck). */
let redirectingToLogin = false;

/** Reached only when refresh could not recover the session. Clears the
 * client-visible `movos_session` marker (not just the in-memory token) so
 * middleware.ts stops believing the session is still valid — otherwise it
 * bounces /login back to /dashboard, which re-mounts every widget and
 * re-triggers this exact failure, looping. Never touches the httpOnly
 * `movos_refresh` cookie itself (not readable/writable from JS, and the API
 * already manages its lifecycle). */
function redirectToLogin(): void {
  if (
    redirectingToLogin ||
    typeof window === 'undefined' ||
    window.location.pathname === '/login'
  ) {
    return;
  }
  redirectingToLogin = true;
  clearSessionCookie();
  window.location.assign('/login');
}

export const apiClient = {
  get: <T>(path: string, options: RequestOptions = {}): Promise<T> =>
    execute<T>(path, { ...options, method: 'GET' }),
  post: <T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> => execute<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> => execute<T>(path, { ...options, method: 'PATCH', body }),
  attemptRefresh,
};
