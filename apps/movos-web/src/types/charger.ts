import type { Connector } from './connector';

/**
 * DEMO-ONLY. Not the canonical domain model. Despite the name, this type's
 * shape (parented under Station, parent of Connector, carrying ocppVersion/
 * status/maxPowerKw/connectors) is structurally equivalent to the real
 * `Evse` entity (`ApiEvse`), not `ChargingStation` — see "The Charger/EVSE
 * divergence" in docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md before
 * assuming a 1:1 rename. Still backs the standalone /chargers demo pages
 * only; no org-wide "list all EVSEs" endpoint exists to connect them to.
 */
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
