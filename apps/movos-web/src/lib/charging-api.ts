import type {
  ApiChargingStation,
  ApiConnector,
  ApiEvse,
} from '@mediafox/shared-types';

import { apiClient } from './api-client';

/**
 * Thin, typed wrappers around the CAP-002 charging-core endpoints
 * (ChargingStation -> Evse -> Connector). Centralized here instead of inline
 * apiClient calls per page because this domain has three nested resources
 * and 12 call sites across list/detail/create/edit — the Sites feature only
 * has 5 call sites and gets away with inline calls, this one doesn't.
 */

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

export function listEvsesByChargingStation(
  chargingStationId: string,
): Promise<ApiEvse[]> {
  return apiClient.get<ApiEvse[]>(
    `/charging-stations/${chargingStationId}/evses`,
  );
}

export function getEvse(id: string): Promise<ApiEvse> {
  return apiClient.get<ApiEvse>(`/evses/${id}`);
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
