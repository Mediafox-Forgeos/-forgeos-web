import { Badge, type BadgeTone } from '@/components/ui/badge';
import type {
  AlertSeverity,
  AlertStatus,
  ChargerStatus,
  ConnectorStatus,
  SessionStatus,
  SiteStatus,
  StationStatus,
  UserStatus,
} from '@/types';

type Descriptor = { label: string; tone: BadgeTone };

const chargerMap: Record<ChargerStatus, Descriptor> = {
  AVAILABLE: { label: 'Disponible', tone: 'success' },
  CHARGING: { label: 'Cargando', tone: 'info' },
  OCCUPIED: { label: 'Ocupado', tone: 'info' },
  RESERVED: { label: 'Reservado', tone: 'neutral' },
  UNAVAILABLE: { label: 'No disponible', tone: 'muted' },
  FAULTED: { label: 'Fuera de servicio', tone: 'danger' },
  OFFLINE: { label: 'Desconectado', tone: 'warning' },
};

const connectorMap: Record<ConnectorStatus, Descriptor> = chargerMap;

const sessionMap: Record<SessionStatus, Descriptor> = {
  STARTING: { label: 'Iniciando', tone: 'neutral' },
  ACTIVE: { label: 'Activa', tone: 'info' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  FAILED: { label: 'Fallida', tone: 'danger' },
  STOPPED: { label: 'Detenida', tone: 'warning' },
};

const alertSeverityMap: Record<AlertSeverity, Descriptor> = {
  INFO: { label: 'Informativa', tone: 'info' },
  WARNING: { label: 'Advertencia', tone: 'warning' },
  HIGH: { label: 'Alta', tone: 'warning' },
  CRITICAL: { label: 'Crítica', tone: 'danger' },
};

const alertStatusMap: Record<AlertStatus, Descriptor> = {
  OPEN: { label: 'Abierta', tone: 'warning' },
  ACKNOWLEDGED: { label: 'Reconocida', tone: 'info' },
  RESOLVED: { label: 'Resuelta', tone: 'success' },
};

const siteMap: Record<SiteStatus, Descriptor> = {
  OPERATIONAL: { label: 'Operativo', tone: 'success' },
  DEGRADED: { label: 'Degradado', tone: 'warning' },
  MAINTENANCE: { label: 'Mantenimiento', tone: 'neutral' },
  OFFLINE: { label: 'Fuera de línea', tone: 'danger' },
};

const stationMap: Record<StationStatus, Descriptor> = {
  ONLINE: { label: 'En línea', tone: 'success' },
  PARTIAL: { label: 'Parcial', tone: 'warning' },
  MAINTENANCE: { label: 'Mantenimiento', tone: 'neutral' },
  OFFLINE: { label: 'Fuera de línea', tone: 'danger' },
};

const userMap: Record<UserStatus, Descriptor> = {
  ACTIVE: { label: 'Activo', tone: 'success' },
  INVITED: { label: 'Invitado', tone: 'info' },
  SUSPENDED: { label: 'Suspendido', tone: 'danger' },
};

function Descriptored({ label, tone }: Descriptor, className?: string) {
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

export function ChargerStatusBadge({
  status,
  className,
}: {
  status: ChargerStatus;
  className?: string;
}) {
  return Descriptored(chargerMap[status], className);
}

export function ConnectorStatusBadge({
  status,
  className,
}: {
  status: ConnectorStatus;
  className?: string;
}) {
  return Descriptored(connectorMap[status], className);
}

export function SessionStatusBadge({
  status,
  className,
}: {
  status: SessionStatus;
  className?: string;
}) {
  return Descriptored(sessionMap[status], className);
}

export function AlertSeverityBadge({
  severity,
  className,
}: {
  severity: AlertSeverity;
  className?: string;
}) {
  return Descriptored(alertSeverityMap[severity], className);
}

export function AlertStatusBadge({
  status,
  className,
}: {
  status: AlertStatus;
  className?: string;
}) {
  return Descriptored(alertStatusMap[status], className);
}

export function SiteStatusBadge({
  status,
  className,
}: {
  status: SiteStatus;
  className?: string;
}) {
  return Descriptored(siteMap[status], className);
}

export function StationStatusBadge({
  status,
  className,
}: {
  status: StationStatus;
  className?: string;
}) {
  return Descriptored(stationMap[status], className);
}

export function UserStatusBadge({
  status,
  className,
}: {
  status: UserStatus;
  className?: string;
}) {
  return Descriptored(userMap[status], className);
}
