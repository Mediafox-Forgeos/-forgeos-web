import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { usePolledResource } from './use-polled-resource';
import { setAccessToken } from '@/lib/auth';

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('usePolledResource — idle-tab resume does not create a refresh storm', () => {
  it('several widgets whose suspended intervals fire together after resume share a single refresh', async () => {
    setAccessToken('old-token');
    let refreshCalls = 0;
    global.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes('/auth/refresh')) {
        refreshCalls += 1;
        return fakeResponse(200, { accessToken: 'new-token' });
      }
      const headers = init?.headers as Headers;
      if (headers.get('Authorization') === 'Bearer new-token') {
        return fakeResponse(200, { value: 1 });
      }
      return fakeResponse(401, {});
    }) as typeof fetch;

    vi.useFakeTimers();

    // Three "widgets" polling at the same 30s cadence, exactly like
    // NetworkHealthWidget/UnifiedAttentionWidget/DashboardLive today.
    await act(async () => {
      renderHook(() => usePolledResource('/widget-a', 30_000));
      renderHook(() => usePolledResource('/widget-b', 30_000));
      renderHook(() => usePolledResource('/widget-c', 30_000));
    });

    // Simulate a background tab: the browser coalesces the suspended
    // intervals and they all fire together on resume instead of one at a
    // time — advancing past several intervals at once.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });

    expect(refreshCalls).toBe(1);
  });
});
