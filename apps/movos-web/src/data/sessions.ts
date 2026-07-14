import type { ChargingSession } from '@/types';

/** Demo charging sessions — 4 today plus historical. Not production data. */
export const sessions: ChargingSession[] = [
  {
    id: 'sess-01',
    siteId: 'site-01',
    stationId: 'station-01',
    chargerId: 'chg-02',
    connectorId: 'conn-03',
    userId: 'user-02',
    tariffId: 'tariff-01',
    status: 'ACTIVE',
    startedAt: '2026-07-14T13:10:00-05:00',
    endedAt: null,
    energyKwh: 22.4,
    durationMinutes: 42,
    estimatedCost: 28000,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-14T13:10:00-05:00',
        label: 'Autorización',
        detail: 'Sesión autorizada para vehículo de flota.',
      },
      {
        timestamp: '2026-07-14T13:11:00-05:00',
        label: 'Inicio de carga',
        detail: 'Conector B1 · CCS2 · 180 kW.',
      },
    ],
    isDemo: true,
  },
  {
    id: 'sess-02',
    siteId: 'site-02',
    stationId: 'station-03',
    chargerId: 'chg-05',
    connectorId: 'conn-08',
    userId: 'user-03',
    tariffId: 'tariff-02',
    status: 'ACTIVE',
    startedAt: '2026-07-14T12:40:00-05:00',
    endedAt: null,
    energyKwh: 18.2,
    durationMinutes: 72,
    estimatedCost: 34600,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-14T12:40:00-05:00',
        label: 'Inicio de carga',
        detail: 'Conector E1 · CCS2 · 50 kW.',
      },
    ],
    isDemo: true,
  },
  {
    id: 'sess-03',
    siteId: 'site-01',
    stationId: 'station-01',
    chargerId: 'chg-01',
    connectorId: 'conn-01',
    userId: 'user-02',
    tariffId: 'tariff-01',
    status: 'COMPLETED',
    startedAt: '2026-07-14T08:05:00-05:00',
    endedAt: '2026-07-14T08:47:00-05:00',
    energyKwh: 31.6,
    durationMinutes: 42,
    estimatedCost: 39500,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-14T08:05:00-05:00',
        label: 'Inicio de carga',
        detail: 'Conector A1 · CCS2 · 180 kW.',
      },
      {
        timestamp: '2026-07-14T08:47:00-05:00',
        label: 'Fin de carga',
        detail: 'Sesión completada correctamente.',
      },
    ],
    isDemo: true,
  },
  {
    id: 'sess-04',
    siteId: 'site-01',
    stationId: 'station-02',
    chargerId: 'chg-03',
    connectorId: 'conn-05',
    userId: 'user-01',
    tariffId: 'tariff-01',
    status: 'STOPPED',
    startedAt: '2026-07-14T09:30:00-05:00',
    endedAt: '2026-07-14T09:38:00-05:00',
    energyKwh: 4.1,
    durationMinutes: 8,
    estimatedCost: 5100,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-14T09:30:00-05:00',
        label: 'Inicio de carga',
        detail: 'Conector C1 · CCS2 · 200 kW.',
      },
      {
        timestamp: '2026-07-14T09:38:00-05:00',
        label: 'Detención manual',
        detail: 'Sesión detenida por el operador.',
      },
    ],
    isDemo: true,
  },
  {
    id: 'sess-05',
    siteId: 'site-01',
    stationId: 'station-01',
    chargerId: 'chg-01',
    connectorId: 'conn-01',
    userId: 'user-02',
    tariffId: 'tariff-01',
    status: 'COMPLETED',
    startedAt: '2026-07-13T18:20:00-05:00',
    endedAt: '2026-07-13T19:05:00-05:00',
    energyKwh: 28.9,
    durationMinutes: 45,
    estimatedCost: 36100,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-13T18:20:00-05:00',
        label: 'Inicio de carga',
        detail: 'Conector A1 · CCS2 · 180 kW.',
      },
      {
        timestamp: '2026-07-13T19:05:00-05:00',
        label: 'Fin de carga',
        detail: 'Sesión completada correctamente.',
      },
    ],
    isDemo: true,
  },
  {
    id: 'sess-06',
    siteId: 'site-02',
    stationId: 'station-03',
    chargerId: 'chg-05',
    connectorId: 'conn-08',
    userId: 'user-03',
    tariffId: 'tariff-02',
    status: 'FAILED',
    startedAt: '2026-07-13T14:02:00-05:00',
    endedAt: '2026-07-13T14:04:00-05:00',
    energyKwh: 0,
    durationMinutes: 2,
    estimatedCost: 0,
    currency: 'COP',
    events: [
      {
        timestamp: '2026-07-13T14:02:00-05:00',
        label: 'Autorización',
        detail: 'Autorización aceptada.',
      },
      {
        timestamp: '2026-07-13T14:04:00-05:00',
        label: 'Error de comunicación',
        detail: 'El vehículo no completó el handshake CCS.',
      },
    ],
    isDemo: true,
  },
];

export function getSessionById(id: string): ChargingSession | undefined {
  return sessions.find((session) => session.id === id);
}

export function getActiveSessions(): ChargingSession[] {
  return sessions.filter((session) => session.status === 'ACTIVE');
}
