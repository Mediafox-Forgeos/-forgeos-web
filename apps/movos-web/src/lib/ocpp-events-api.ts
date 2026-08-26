import type { ApiOcppProtocolEventsResponse } from '@mediafox/shared-types';

import { apiClient } from './api-client';

/** WO-ARGOS-091 — OCPP support read model. Backend remains the sole
 * authority on tenant scoping, redaction, and bounding; this layer only
 * carries the request through. */
export function listOcppEvents(
  stationId: string,
  filter: {
    limit?: number;
    before?: string;
    action?: string;
    direction?: string;
  } = {},
): Promise<ApiOcppProtocolEventsResponse> {
  const params = new URLSearchParams();
  if (filter.limit) params.set('limit', String(filter.limit));
  if (filter.before) params.set('before', filter.before);
  if (filter.action) params.set('action', filter.action);
  if (filter.direction) params.set('direction', filter.direction);
  const query = params.toString();

  return apiClient.get<ApiOcppProtocolEventsResponse>(
    `/charging-stations/${encodeURIComponent(stationId)}/ocpp-events${query ? `?${query}` : ''}`,
  );
}
