export type ConnectorType = 'CCS2' | 'Type2' | 'CHAdeMO';

export type ConnectorStatus =
  | 'AVAILABLE'
  | 'CHARGING'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'UNAVAILABLE'
  | 'FAULTED'
  | 'OFFLINE';

export type Connector = {
  id: string;
  chargerId: string;
  label: string;
  type: ConnectorType;
  maxPowerKw: number;
  status: ConnectorStatus;
  activeSessionId: string | null;
  lastUpdate: string;
  isDemo: true;
};
