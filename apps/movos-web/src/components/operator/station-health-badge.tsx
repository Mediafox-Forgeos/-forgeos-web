import type { StationHealthStatus } from '@mediafox/shared-types';

import { Badge, type BadgeTone } from '@/components/ui/badge';

const healthMap: Record<
  StationHealthStatus,
  { label: string; tone: BadgeTone }
> = {
  healthy: { label: 'Saludable', tone: 'success' },
  degraded: { label: 'Degradado', tone: 'warning' },
  offline: { label: 'Fuera de línea', tone: 'danger' },
  unknown: { label: 'Desconocido', tone: 'muted' },
};

/**
 * CAP-X Operator Control Center, Sprint 1 — the 4 states implemented so
 * far (see docs/domain/CAP-X_STATION_HEALTH.md; `maintenance` is Sprint 2).
 */
export function StationHealthBadge({
  status,
  className,
}: {
  status: StationHealthStatus;
  className?: string;
}) {
  const { label, tone } = healthMap[status];
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

export const stationHealthDotColor: Record<StationHealthStatus, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  offline: '#ef4444',
  unknown: '#6b7280',
};
