export type SessionStatus =
  'STARTING' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'STOPPED';

export type SessionEvent = {
  timestamp: string;
  label: string;
  detail: string;
};

export type ChargingSession = {
  id: string;
  siteId: string;
  stationId: string;
  chargerId: string;
  connectorId: string;
  userId: string;
  tariffId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  energyKwh: number;
  durationMinutes: number;
  estimatedCost: number;
  currency: string;
  events: SessionEvent[];
  isDemo: true;
};
