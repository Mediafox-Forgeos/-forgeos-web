import type { ActivityEvent } from '@/types';

/** Demo activity feed. Not production data. */
export const activity: ActivityEvent[] = [
  {
    id: 'act-01',
    kind: 'session',
    title: 'Sesión iniciada en CHG-02',
    detail: 'Conector B1 · flota corporativa.',
    timestamp: '2026-07-14T13:11:00-05:00',
    siteId: 'site-01',
    isDemo: true,
  },
  {
    id: 'act-02',
    kind: 'alert',
    title: 'Alerta abierta: latido perdido',
    detail: 'CHG-06 sin heartbeat en Terminal Sur.',
    timestamp: '2026-07-14T13:20:00-05:00',
    siteId: 'site-02',
    isDemo: true,
  },
  {
    id: 'act-03',
    kind: 'charger',
    title: 'CHG-04 en estado FAULTED',
    detail: 'Conector D1 requiere intervención de soporte.',
    timestamp: '2026-07-14T11:12:00-05:00',
    siteId: 'site-01',
    isDemo: true,
  },
  {
    id: 'act-04',
    kind: 'session',
    title: 'Sesión completada en CHG-01',
    detail: '31.6 kWh entregados en 42 minutos.',
    timestamp: '2026-07-14T08:47:00-05:00',
    siteId: 'site-01',
    isDemo: true,
  },
  {
    id: 'act-05',
    kind: 'user',
    title: 'Invitación enviada',
    detail: 'Julián Ospina fue invitado como Analista.',
    timestamp: '2026-07-12T16:48:00-05:00',
    siteId: null,
    isDemo: true,
  },
];
