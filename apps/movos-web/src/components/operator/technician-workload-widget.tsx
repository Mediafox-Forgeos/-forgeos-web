'use client';

import type { ApiTechnicianWorkload } from '@mediafox/shared-types';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePolledResource } from './use-polled-resource';

/**
 * WO-ARGOS-051 — Operations Console. Roster is real ACTIVE
 * MemberRole.TECHNICIAN memberships; counts are real, unresolved WorkOrder
 * rows — see WorkOrderService.getTechnicianWorkload. Deliberately no
 * ranking, scoring, or utilization percentage — just counts.
 */
export function TechnicianWorkloadWidget() {
  const { data, loading, error } = usePolledResource<ApiTechnicianWorkload[]>(
    '/work-orders/workload',
    30_000,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carga por técnico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {error && (
          <p className="text-muted-foreground text-sm">
            No se pudo cargar la carga de trabajo.
          </p>
        )}
        {!error && loading && !data && (
          <p className="text-muted-foreground text-sm">Cargando…</p>
        )}
        {data && data.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No hay técnicos activos en esta organización.
          </p>
        )}
        {data?.map((technician) => (
          <div
            key={technician.userId}
            className="border-border flex flex-col gap-1.5 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="font-medium">{technician.displayName}</p>
            <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <span>{technician.unresolvedCount} sin resolver</span>
              <span>{technician.inProgressCount} en progreso</span>
              <span>{technician.scheduledTodayCount} hoy</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
