import type {
  ApiInvitationPreview,
  ApiMembershipInvitation,
  ApiMembershipInvitationCreated,
  ApiOrganizationMember,
} from '@mediafox/shared-types';

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

/** For a person with no MOVOS account yet — returns the invitation plus the
 * one-time plaintext token, embedded by the caller into the /invite/<token>
 * URL and never persisted beyond that single response. */
export function createInvitation(
  email: string,
  role: string,
): Promise<ApiMembershipInvitationCreated> {
  return apiClient.post<ApiMembershipInvitationCreated>(
    '/memberships/invitations',
    { email, role },
  );
}

export function listPendingInvitations(): Promise<ApiMembershipInvitation[]> {
  return apiClient.get<ApiMembershipInvitation[]>('/memberships/invitations');
}

/** Public — no organization context, no auth required. Used by the
 * unauthenticated /invite/<token> acceptance page. */
export function previewInvitation(
  token: string,
): Promise<ApiInvitationPreview> {
  return apiClient.get<ApiInvitationPreview>(
    `/invitations/${encodeURIComponent(token)}`,
    { skipOrgHeader: true },
  );
}

export function acceptInvitation(
  token: string,
  payload: {
    displayName: string;
    password: string;
    passwordConfirmation: string;
  },
): Promise<{ email: string }> {
  return apiClient.post<{ email: string }>(
    `/invitations/${encodeURIComponent(token)}/accept`,
    payload,
    { skipOrgHeader: true },
  );
}
