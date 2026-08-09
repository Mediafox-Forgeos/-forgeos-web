import type {
  ApiStationHealthSummary,
  StationHealthStatus,
} from '@mediafox/shared-types';

export interface NetworkVerdict {
  status: StationHealthStatus;
  label: string;
  description: string;
}

const VERDICT_COPY: Record<
  StationHealthStatus,
  Omit<NetworkVerdict, 'status'>
> = {
  healthy: {
    label: 'Red saludable',
    description: 'Todas las estaciones operando con normalidad.',
  },
  degraded: {
    label: 'Atención requerida',
    description: 'Una o más estaciones presentan conectores en falla.',
  },
  offline: {
    label: 'Problema de conectividad',
    description: 'Una o más estaciones están desconectadas.',
  },
  unknown: {
    label: 'Estado desconocido',
    description: 'Sin evidencia reciente de conectividad para parte de la red.',
  },
};

// Same precedence StationHealthService.computeHealth() already applies per
// station (connectivity evidence before fault evidence) — reduced here
// across the fleet-wide counts /operator/fleet-status already returns, to a
// single verdict for the Command Center's headline.
const PRECEDENCE: StationHealthStatus[] = [
  'offline',
  'unknown',
  'degraded',
  'healthy',
];

export function computeNetworkVerdict(
  counts: ApiStationHealthSummary | null,
): NetworkVerdict | null {
  if (!counts) return null;
  if (counts.totalStations === 0) {
    return { status: 'unknown', ...VERDICT_COPY.unknown };
  }
  const worst = PRECEDENCE.find((status) => counts[status] > 0) ?? 'healthy';
  return { status: worst, ...VERDICT_COPY[worst] };
}
