import { TriangleAlert } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/badge';

/**
 * Status badges for the real CAP-002 API entities (ChargingStation/Evse/
 * Connector). Distinct from the legacy demo StationStatusBadge/
 * ChargerStatusBadge/ConnectorStatusBadge in status-badge.tsx, which map the
 * mock literal-union enums used by the still-unconnected /stations,
 * /chargers, /connectors demo pages. Same "Api-prefixed sibling" pattern as
 * api-site-status-badge.tsx.
 */

const chargingStationStatusMap: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  DRAFT: { label: 'Borrador', tone: 'neutral' },
  ACTIVE: { label: 'Activo', tone: 'success' },
  INACTIVE: { label: 'Inactivo', tone: 'warning' },
  ARCHIVED: { label: 'Archivado', tone: 'muted' },
};

export function ApiChargingStationStatusBadge({ status }: { status: string }) {
  const descriptor = chargingStationStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

// Shared by Evse and Connector — same value set, reused per the backend's
// EvseStatus/ConnectorStatus enums (kept as two distinct Prisma enums, but
// the display mapping is identical).
const operationalStatusMap: Record<string, { label: string; tone: BadgeTone }> =
  {
    AVAILABLE: { label: 'Disponible', tone: 'success' },
    CHARGING: { label: 'Cargando', tone: 'info' },
    OCCUPIED: { label: 'Ocupado', tone: 'info' },
    RESERVED: { label: 'Reservado', tone: 'warning' },
    UNAVAILABLE: { label: 'No disponible', tone: 'neutral' },
    FAULTED: { label: 'Con falla', tone: 'danger' },
    OFFLINE: { label: 'Fuera de línea', tone: 'muted' },
  };

export function ApiEvseStatusBadge({ status }: { status: string }) {
  const descriptor = operationalStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

export function ApiConnectorStatusBadge({ status }: { status: string }) {
  const descriptor = operationalStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

// CAP-005 — device connectivity (last-known WebSocket connection evidence),
// deliberately distinct from ChargingStationStatus above (administrative)
// and from Evse/Connector operational status (charging-session state). See
// docs/domain/CAP-005_CONNECTIVITY_ENGINE.md.
//
// Exported (not module-private) as of WO-ARGOS-023 (Operational Consistency
// Hardening, see docs/product/OPERATIONAL_VOCABULARY.md) — this is the one
// canonical wording for ConnectivityStatus in the whole app. Before that
// hardening pass, the CAP-X operator dashboard's ConnectivityWidget
// independently hardcoded "Fuera de línea" for the same OFFLINE value this
// map already called "Desconectado," so the same station could read two
// different things on two different screens. Reuse this constant rather
// than restating the words.
export const CONNECTIVITY_STATUS_LABELS: Record<string, string> = {
  ONLINE: 'En línea',
  OFFLINE: 'Desconectado',
  UNKNOWN: 'Desconocido',
};

const connectivityStatusMap: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  ONLINE: { label: CONNECTIVITY_STATUS_LABELS.ONLINE, tone: 'success' },
  OFFLINE: { label: CONNECTIVITY_STATUS_LABELS.OFFLINE, tone: 'danger' },
  UNKNOWN: { label: CONNECTIVITY_STATUS_LABELS.UNKNOWN, tone: 'neutral' },
};

export function ApiConnectivityStatusBadge({ status }: { status: string }) {
  const descriptor = connectivityStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

// CAP-004 — real ChargingSession lifecycle (10 values), distinct from the
// legacy mock SessionStatusBadge in status-badge.tsx, which maps a
// 5-value fictional enum (STARTING/ACTIVE/COMPLETED/FAILED/STOPPED) that
// doesn't even match the real ChargingSessionStatus enum. Added by
// WO-ARGOS-023 once the real /sessions list and detail pages needed a
// status badge that could render every value the real API returns.
const chargingSessionStatusMap: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  PENDING: { label: 'Pendiente', tone: 'neutral' },
  AUTHORIZED: { label: 'Autorizada', tone: 'neutral' },
  STARTING: { label: 'Iniciando', tone: 'info' },
  ACTIVE: { label: 'Activa', tone: 'info' },
  SUSPENDED: { label: 'Suspendida', tone: 'warning' },
  // CAP-005 — a verified-stale connection during a session, not a normal
  // termination. Danger, not warning: this is the stuck-session state the
  // whole Operator Control Center discovery treated as the single
  // sharpest operator anxiety (docs/product/OPERATOR_DAILY_WORKFLOW.md).
  OFFLINE: { label: 'Sin conexión', tone: 'danger' },
  STOPPING: { label: 'Deteniendo', tone: 'warning' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  FAILED: { label: 'Fallida', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'muted' },
};

export function ApiChargingSessionStatusBadge({ status }: { status: string }) {
  const descriptor = chargingSessionStatusMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

// WO-ARGOS-056 — EVSE Operational Status. Derived at read time from real
// connectivity + connector + session evidence (never persisted, never a
// substitute for Evse.status — see ApiEvseListItem). Deliberately a
// separate badge from ApiEvseStatusBadge (which remains the Administrative
// Status badge) so the two layers are never visually conflated.
const operationalStatusLabelMap: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  AVAILABLE: { label: 'Disponible', tone: 'success' },
  IN_USE: { label: 'En uso', tone: 'info' },
  PARTIALLY_AVAILABLE: { label: 'Parcialmente disponible', tone: 'warning' },
  UNAVAILABLE: { label: 'No disponible', tone: 'neutral' },
  OFFLINE: { label: 'Fuera de línea', tone: 'danger' },
  UNKNOWN: { label: 'Desconocido', tone: 'neutral' },
};

export function OperationalStatusBadge({ status }: { status: string }) {
  const descriptor = operationalStatusLabelMap[status] ?? {
    label: status,
    tone: 'neutral' as const,
  };
  return <Badge tone={descriptor.tone}>{descriptor.label}</Badge>;
}

// WO-ARGOS-057 — exported (not module-private) so the Unified Attention
// widget can render the same wording this indicator uses, rather than
// restating these strings — same reasoning as ATTENTION_REASON_LABEL in
// work-order-badges.tsx for the WorkOrder-level reason set.
export const EVSE_ATTENTION_REASON_LABEL: Record<string, string> = {
  CONNECTOR_FAULTED: 'Un conector reporta falla',
  ACTIVE_SESSION_CONNECTOR_NOT_IN_USE:
    'Hay una sesión activa que el estado del conector no refleja',
};

/**
 * Transversal flag (WO-ARGOS-056 Decision: requiresAttention is NOT a
 * seventh OperationalStatus value) — can appear next to any status.
 */
export function RequiresAttentionIndicator({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  const title = reasons
    .map((r) => EVSE_ATTENTION_REASON_LABEL[r] ?? r)
    .join(' · ');
  return (
    <span title={title} className="inline-flex text-amber-500">
      <TriangleAlert className="size-4" aria-hidden="true" />
      <span className="sr-only">{title}</span>
    </span>
  );
}
