/**
 * DEMO-ONLY. This is not the canonical domain model — the real, persisted
 * entity is `ChargingStation` (`ApiChargingStation` from
 * `@mediafox/shared-types`), implemented by CAP-002. This type still backs
 * the standalone /stations demo page only, which has no real-data
 * equivalent because the API exposes no org-wide "list all stations across
 * all sites" endpoint (only per-site: GET /sites/:siteId/charging-stations).
 * `chargerCount`, `connectorCount`, and `availabilityPercent` below are
 * fabricated/mocked here — the real UI (under /sites/[siteId]/...) only
 * ever displays these as values derived live from returned child records,
 * never as stored fields. See
 * docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md.
 */
export type StationStatus = 'ONLINE' | 'PARTIAL' | 'MAINTENANCE' | 'OFFLINE';

export type Station = {
  id: string;
  siteId: string;
  name: string;
  status: StationStatus;
  /** @deprecated derived-only in the real UI, never a persisted field */
  chargerCount: number;
  /** @deprecated derived-only in the real UI, never a persisted field */
  connectorCount: number;
  /** @deprecated derived-only in the real UI, never a persisted field */
  availabilityPercent: number;
  lastCommunication: string;
  isDemo: true;
};
