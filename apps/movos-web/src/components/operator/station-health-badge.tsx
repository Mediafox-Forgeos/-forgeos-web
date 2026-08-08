import type { StationHealthStatus } from '@mediafox/shared-types';

import { Badge, type BadgeTone } from '@/components/ui/badge';
import { CONNECTIVITY_STATUS_LABELS } from '@/components/movos/api-charging-status-badges';

// `offline`/`unknown` reuse CONNECTIVITY_STATUS_LABELS deliberately, not
// by coincidence: in Sprint 1, StationHealth's offline/unknown states are
// entirely connectivity-driven (see docs/domain/CAP-X_STATION_HEALTH.md's
// precedence rules), so the same underlying fact should read as the same
// word wherever it's shown — the exact inconsistency WO-ARGOS-023
// (Operational Consistency Hardening) closed, see
// docs/product/OPERATIONAL_VOCABULARY.md. `healthy`/`degraded` have no
// connectivity equivalent and keep their own words.
const healthMap: Record<
  StationHealthStatus,
  { label: string; tone: BadgeTone }
> = {
  healthy: { label: 'Saludable', tone: 'success' },
  degraded: { label: 'Degradado', tone: 'warning' },
  offline: { label: CONNECTIVITY_STATUS_LABELS.OFFLINE, tone: 'danger' },
  unknown: { label: CONNECTIVITY_STATUS_LABELS.UNKNOWN, tone: 'muted' },
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
