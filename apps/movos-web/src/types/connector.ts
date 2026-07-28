/**
 * DEMO-ONLY. Not the canonical domain model — the real entity is
 * `Connector` (`ApiConnector` from `@mediafox/shared-types`), parented by
 * `evseId` instead of this type's `chargerId`. Still backs the standalone
 * /connectors demo page only; no org-wide "list all connectors" endpoint
 * exists to connect it to. See
 * docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md.
 */
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
