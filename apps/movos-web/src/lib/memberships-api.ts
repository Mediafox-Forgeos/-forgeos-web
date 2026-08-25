import type { ApiOrganizationMember } from '@mediafox/shared-types';

import { apiClient } from './api-client';

/** WO-ARGOS-089 — organization member management. Backend remains
 * authoritative for every RBAC/tenant/final-owner rule below; this layer
 * only carries requests through. */

export function listMembers(): Promise<ApiOrganizationMember[]> {
  return apiClient.get<ApiOrganizationMember[]>('/memberships');
}

export function addMember(
  email: string,
  role: string,
): Promise<ApiOrganizationMember> {
  return apiClient.post<ApiOrganizationMember>('/memberships', {
    email,
    role,
  });
}

export function updateMember(
  membershipId: string,
  payload: { role?: string; status?: string },
): Promise<ApiOrganizationMember> {
  return apiClient.patch<ApiOrganizationMember>(
    `/memberships/${membershipId}`,
    payload,
  );
}
