'use client';

import * as React from 'react';

import type { ApiChargingStation, ApiSite } from '@mediafox/shared-types';

import { apiClient } from '@/lib/api-client';

export type StationWithSite = ApiChargingStation & { siteName: string };

/**
 * Composes a cross-site station list client-side from the real, existing
 * per-site endpoint (GET /sites/:siteId/charging-stations) — no org-wide
 * station-list endpoint exists, per the standing WO-ARGOS-005 ruling.
 * Extracted from /network's own original inline implementation (WO-ARGOS-031)
 * so /work-orders (WO-ARGOS-035) doesn't duplicate the same composition.
 */
export function useAllStations(pollMs = 30_000): {
  stations: StationWithSite[] | null;
  error: boolean;
  refetch: () => void;
} {
  const [stations, setStations] = React.useState<StationWithSite[] | null>(
    null,
  );
  const [error, setError] = React.useState(false);
  const [refetchToken, setRefetchToken] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const sites = await apiClient.get<ApiSite[]>('/sites');
      const perSite = await Promise.all(
        sites.map((site) =>
          apiClient
            .get<ApiChargingStation[]>(`/sites/${site.id}/charging-stations`)
            .then((list) =>
              list.map((station) => ({ ...station, siteName: site.name })),
            ),
        ),
      );
      setStations(perSite.flat());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), pollMs);
    return () => clearInterval(timer);
  }, [load, pollMs, refetchToken]);

  const refetch = React.useCallback(() => setRefetchToken((n) => n + 1), []);

  return { stations, error, refetch };
}
