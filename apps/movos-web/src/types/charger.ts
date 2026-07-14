import type { Connector } from './connector';

export type ChargerStatus =
  | 'AVAILABLE'
  | 'CHARGING'
  | 'OCCUPIED'
  | 'RESERVED'
  | 'UNAVAILABLE'
  | 'FAULTED'
  | 'OFFLINE';

export type ChargerConnector = Pick<
  Connector,
  'id' | 'label' | 'type' | 'maxPowerKw' | 'status'
>;

export type Charger = {
  id: string;
  stationId: string;
  siteId: string;
  name: string;
  vendor: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  ocppVersion: string;
  status: ChargerStatus;
  maxPowerKw: number;
  connectors: ChargerConnector[];
  lastHeartbeat: string;
  isDemo: true;
};
