import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardLive } from './_dashboard-live';
import { apiClient } from '@/lib/api-client';
import * as authContext from '@/context/auth-context';

vi.mock('@/context/auth-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/context/auth-context')>();
  return { ...actual, useAuth: vi.fn() };
});

const originalFetch = global.fetch;

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = originalFetch;
});

// WO-ARGOS-057 — DashboardLive was the one Operations Console widget that
// never refreshed without a full page reload. This confirms it now polls
// like every other widget (via usePolledResource for the site count, and a
// matching setInterval discipline for the health check).
describe('DashboardLive — polling (WO-ARGOS-057)', () => {
  beforeEach(() => {
    vi.mocked(authContext.useAuth).mockReturnValue({
      currentOrg: { id: 'org-1', name: 'Kylum Energy' },
    } as ReturnType<typeof authContext.useAuth>);
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ok', timestamp: '', version: '' }),
    }) as unknown as typeof fetch;
  });

  it('refreshes the site count on an interval, not just once on mount', async () => {
    vi.useFakeTimers();
    const getSpy = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce([{ id: 's1' }])
      .mockResolvedValueOnce([{ id: 's1' }, { id: 's2' }]);

    render(<DashboardLive />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByText('1')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(getSpy).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
