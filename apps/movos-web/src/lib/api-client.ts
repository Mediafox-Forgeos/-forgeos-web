'use client';

import {
  clearAuth,
  getAccessToken,
  getActiveOrganizationId,
  setAccessToken,
  setActiveOrganizationId,
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

/**
 * Attempts to silently refresh the access token using the httpOnly cookie.
 * Returns the new token, or null if the session cannot be refreshed.
 *
 * DEC-022 (WO-ARGOS-015): sends this tab's own active organization id
 * (from sessionStorage, so it is genuinely per-tab) so the reissued token
 * preserves organization affinity across refresh. The backend re-validates
 * membership fresh and may omit `orgId` if it's no longer valid (e.g. the
 * membership was revoked) rather than failing the refresh outright — when
 * that happens we sync local state to match what the token actually
 * carries, so the UI can prompt reselection instead of silently continuing
 * to act as if the old organization were still active.
 */
async function attemptRefresh(): Promise<string | null> {
  try {
    const organizationId = getActiveOrganizationId();
    const response = await fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ organizationId: organizationId ?? undefined }),
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      accessToken?: string;
      organizationId?: string | null;
    };
    if (data.accessToken) {
      setAccessToken(data.accessToken);
      if (organizationId && data.organizationId !== organizationId) {
        setActiveOrganizationId(data.organizationId ?? null);
      }
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
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

function redirectToLogin(): void {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
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
