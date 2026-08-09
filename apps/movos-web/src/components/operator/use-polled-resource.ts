'use client';

import * as React from 'react';

import { apiClient } from '@/lib/api-client';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — polling, not a
 * push transport, per docs/implementation/CAPX_RISK_MATRIX.md's explicit
 * recommendation ("start with polling... revisit push-based delivery only
 * if polling proves visibly too slow"). No other part of this codebase
 * uses a push transport for live data, so this keeps the same pattern
 * apps/movos-web already uses (see `_dashboard-live.tsx`), just shared
 * across five widgets instead of duplicated in each.
 */
export function usePolledResource<T>(
  path: string,
  intervalMs = 15_000,
): { data: T | null; loading: boolean; error: boolean; refetch: () => void } {
  const [data, setData] = React.useState<T | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  // WO-ARGOS-026 — bumped after a write (an Action transition) to trigger
  // an immediate reload instead of waiting for the next poll tick, without
  // needing a second data-fetching mechanism alongside polling.
  const [refetchToken, setRefetchToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const result = await apiClient.get<T>(path);
        if (!cancelled) {
          setData(result);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [path, intervalMs, refetchToken]);

  const refetch = React.useCallback(() => setRefetchToken((n) => n + 1), []);

  return { data, loading, error, refetch };
}
