'use client';

import type { ApiOccupancySummary } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolledResource } from './use-polled-resource';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022) — instantaneous
 * occupancy only (a point-in-time snapshot), not a trend. See
 * docs/product/OPERATOR_KPIS.md KPI 9 and
 * docs/implementation/CAPX_SPRINT_PLAN.md's Sprint 3 scope note: the
 * trend/utilization variant needs OccupancySnapshot history, which is
 * explicitly out of this MVP.
 */
export function OccupancyWidget() {
  const { data, loading, error } = usePolledResource<ApiOccupancySummary>(
    '/operator/occupancy',
  );

  const percent =
    data?.occupancyRate !== null && data?.occupancyRate !== undefined
      ? Math.round(data.occupancyRate * 100)
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ocupación instantánea</CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar la ocupación.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && (
          <div>
            <p className="text-2xl font-semibold tracking-[-0.02em]">
              {percent === null ? '—' : `${percent}%`}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {percent === null
                ? 'Sin conectores elegibles en este momento'
                : `${data.occupiedCount} de ${data.eligibleCount} conectores elegibles en uso`}
            </p>
            <div className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
              <div
                className="bg-movos-blue h-full rounded-full"
                style={{ width: `${percent ?? 0}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
