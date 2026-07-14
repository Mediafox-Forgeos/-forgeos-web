import type { ReportCard } from '@/types';

/** Demo report catalogue. Generation is not yet implemented. */
export const reportCards: ReportCard[] = [
  {
    id: 'report-availability',
    title: 'Disponibilidad de red',
    description:
      'Uptime por sitio, estación y cargador durante el periodo seleccionado.',
    available: false,
  },
  {
    id: 'report-usage-by-site',
    title: 'Uso por sitio',
    description: 'Sesiones, energía y ocupación desglosadas por ubicación.',
    available: false,
  },
  {
    id: 'report-sessions',
    title: 'Sesiones y consumo',
    description: 'Detalle de sesiones, duración y energía entregada.',
    available: false,
  },
  {
    id: 'report-revenue',
    title: 'Ingresos estimados',
    description:
      'Ingresos estimados por tarifa aplicada. Cifras de demostración.',
    available: false,
  },
  {
    id: 'report-alerts',
    title: 'Alertas e incidentes',
    description: 'Historial de alertas por severidad y tiempo de resolución.',
    available: false,
  },
  {
    id: 'report-charger-performance',
    title: 'Rendimiento de cargadores',
    description: 'Confiabilidad y potencia entregada por cada cargador.',
    available: false,
  },
];
