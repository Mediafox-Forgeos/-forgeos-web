import type {
  ApiChargingStation,
  ApiChargingStationListItem,
  ApiConnector,
  ApiConnectorListItem,
  ApiEvse,
  ApiEvseListItem,
} from '@mediafox/shared-types';

import { apiClient } from './api-client';

/**
 * Thin, typed wrappers around the CAP-002 charging-core endpoints
 * (ChargingStation -> Evse -> Connector). Centralized here instead of inline
 * apiClient calls per page because this domain has three nested resources
 * and 12 call sites across list/detail/create/edit — the Sites feature only
 * has 5 call sites and gets away with inline calls, this one doesn't.
 */

function toQueryString(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// WO-ARGOS-054 — global, organization-scoped inventories. Distinct from the
// per-parent list functions below (listChargingStationsBySite etc.), which
// remain unchanged and are used by the existing Site/detail drill-down UI.

export function listAllChargingStations(
  filters: {
    siteId?: string;
    status?: string;
    connectivityStatus?: string;
  } = {},
): Promise<ApiChargingStationListItem[]> {
  return apiClient.get<ApiChargingStationListItem[]>(
    `/charging-stations${toQueryString(filters)}`,
  );
}

export function listAllEvses(
  filters: {
    siteId?: string;
    chargingStationId?: string;
    status?: string;
  } = {},
): Promise<ApiEvseListItem[]> {
  return apiClient.get<ApiEvseListItem[]>(`/evses${toQueryString(filters)}`);
}

export function listAllConnectors(
  filters: {
    siteId?: string;
    chargingStationId?: string;
    evseId?: string;
    status?: string;
  } = {},
): Promise<ApiConnectorListItem[]> {
  return apiClient.get<ApiConnectorListItem[]>(
    `/connectors${toQueryString(filters)}`,
  );
}

export function listChargingStationsBySite(
  siteId: string,
): Promise<ApiChargingStation[]> {
  return apiClient.get<ApiChargingStation[]>(
    `/sites/${siteId}/charging-stations`,
  );
}

export function getChargingStation(id: string): Promise<ApiChargingStation> {
  return apiClient.get<ApiChargingStation>(`/charging-stations/${id}`);
}

export function createChargingStation(
  siteId: string,
  payload: Record<string, unknown>,
): Promise<ApiChargingStation> {
  return apiClient.post<ApiChargingStation>(
    `/sites/${siteId}/charging-stations`,
    payload,
  );
}

export function updateChargingStation(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiChargingStation> {
  return apiClient.patch<ApiChargingStation>(
    `/charging-stations/${id}`,
    payload,
  );
}

// WO-ARGOS-056 — both endpoints now also carry the derived Operational
// Status evidence (see ApiEvseListItem), so both return that richer shape
// rather than the bare ApiEvse used elsewhere (create/update responses,
// which don't have connector/session evidence to derive from).
export function listEvsesByChargingStation(
  chargingStationId: string,
): Promise<ApiEvseListItem[]> {
  return apiClient.get<ApiEvseListItem[]>(
    `/charging-stations/${chargingStationId}/evses`,
  );
}

export function getEvse(id: string): Promise<ApiEvseListItem> {
  return apiClient.get<ApiEvseListItem>(`/evses/${id}`);
}

export function createEvse(
  chargingStationId: string,
  payload: Record<string, unknown>,
): Promise<ApiEvse> {
  return apiClient.post<ApiEvse>(
    `/charging-stations/${chargingStationId}/evses`,
    payload,
  );
}

export function updateEvse(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiEvse> {
  return apiClient.patch<ApiEvse>(`/evses/${id}`, payload);
}

export function listConnectorsByEvse(evseId: string): Promise<ApiConnector[]> {
  return apiClient.get<ApiConnector[]>(`/evses/${evseId}/connectors`);
}

export function getConnector(id: string): Promise<ApiConnector> {
  return apiClient.get<ApiConnector>(`/connectors/${id}`);
}

export function createConnector(
  evseId: string,
  payload: Record<string, unknown>,
): Promise<ApiConnector> {
  return apiClient.post<ApiConnector>(`/evses/${evseId}/connectors`, payload);
}

export function updateConnector(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiConnector> {
  return apiClient.patch<ApiConnector>(`/connectors/${id}`, payload);
}
