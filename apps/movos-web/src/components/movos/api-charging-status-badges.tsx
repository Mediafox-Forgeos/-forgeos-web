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
