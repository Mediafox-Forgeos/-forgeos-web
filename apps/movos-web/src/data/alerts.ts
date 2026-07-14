import type { Alert } from '@/types';

/** Demo operational alerts. Not production data. */
export const alerts: Alert[] = [
  {
    id: 'alert-01',
    title: 'Latido perdido',
    description:
      'CHG-06 no ha enviado heartbeat OCPP en los últimos 15 minutos.',
    severity: 'HIGH',
    status: 'OPEN',
    siteId: 'site-02',
    chargerId: 'chg-06',
    createdAt: '2026-07-14T13:20:00-05:00',
    source: 'Monitoreo OCPP',
    isDemo: true,
  },
  {
    id: 'alert-02',
    title: 'Falla de conector',
    description: 'El conector D1 de CHG-04 reporta estado FAULTED.',
    severity: 'CRITICAL',
    status: 'ACKNOWLEDGED',
    siteId: 'site-01',
    chargerId: 'chg-04',
    createdAt: '2026-07-14T11:12:00-05:00',
    source: 'Diagnóstico de hardware',
    isDemo: true,
  },
  {
    id: 'alert-03',
    title: 'Sesión prolongada',
    description: 'La sesión sess-02 supera los 70 minutos por debajo de 25 kW.',
    severity: 'WARNING',
    status: 'OPEN',
    siteId: 'site-02',
    chargerId: 'chg-05',
    createdAt: '2026-07-14T13:52:00-05:00',
    source: 'Reglas de operación',
    isDemo: true,
  },
  {
    id: 'alert-04',
    title: 'Baja disponibilidad',
    description: 'La estación Terminal Sur A opera al 33% de disponibilidad.',
    severity: 'INFO',
    status: 'RESOLVED',
    siteId: 'site-02',
    chargerId: null,
    createdAt: '2026-07-14T10:00:00-05:00',
    source: 'Análisis de red',
    isDemo: true,
  },
];

export function getOpenAlerts(): Alert[] {
  return alerts.filter((alert) => alert.status !== 'RESOLVED');
}
