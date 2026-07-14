export type StationStatus = 'ONLINE' | 'PARTIAL' | 'MAINTENANCE' | 'OFFLINE';

export type Station = {
  id: string;
  siteId: string;
  name: string;
  status: StationStatus;
  chargerCount: number;
  connectorCount: number;
  availabilityPercent: number;
  lastCommunication: string;
  isDemo: true;
};
