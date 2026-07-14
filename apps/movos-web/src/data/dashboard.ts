import type {
  NetworkDistribution,
  NetworkMetric,
  PilotMilestone,
} from '@/types';

/** Aggregated demo dashboard metrics. Not production data. */
export const executiveMetrics: NetworkMetric[] = [
  {
    id: 'metric-availability',
    label: 'Disponibilidad de red',
    value: '92%',
    detail: 'Últimas 24 horas',
    trend: 'up',
  },
  {
    id: 'metric-available-chargers',
    label: 'Cargadores disponibles',
    value: '4/6',
    detail: '1 en falla · 1 desconectado',
    trend: 'flat',
  },
  {
    id: 'metric-active-sessions',
    label: 'Sesiones activas',
    value: '2',
    detail: 'En curso ahora',
    trend: 'up',
  },
  {
    id: 'metric-energy',
    label: 'Energía entregada hoy',
    value: '45.8 kWh',
    detail: 'Acumulado del día',
    trend: 'up',
  },
  {
    id: 'metric-alerts',
    label: 'Alertas abiertas',
    value: '1',
    detail: 'Requiere atención',
    trend: 'down',
  },
  {
    id: 'metric-revenue',
    label: 'Ingresos estimados',
    value: 'COP 127,400',
    detail: 'Estimado del día',
    trend: 'up',
  },
];

export const networkDistribution: NetworkDistribution[] = [
  { status: 'AVAILABLE', label: 'Disponible', count: 5 },
  { status: 'CHARGING', label: 'Cargando', count: 1 },
  { status: 'OCCUPIED', label: 'Ocupado', count: 1 },
  { status: 'FAULTED', label: 'Fuera de servicio', count: 2 },
  { status: 'OFFLINE', label: 'Desconectado', count: 1 },
];

export const pilotMilestones: PilotMilestone[] = [
  {
    id: 'milestone-01',
    label: 'Preparación de integración',
    status: 'DONE',
  },
  {
    id: 'milestone-02',
    label: 'Inventario de infraestructura',
    status: 'DONE',
  },
  { id: 'milestone-03', label: 'Validación OCPP', status: 'IN_PROGRESS' },
  {
    id: 'milestone-04',
    label: 'Pruebas operacionales',
    status: 'PENDING',
  },
  { id: 'milestone-05', label: 'Retroalimentación', status: 'PENDING' },
];
