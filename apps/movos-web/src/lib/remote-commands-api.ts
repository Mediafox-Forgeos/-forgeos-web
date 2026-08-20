import type {
  ApiAuthorizationCredential,
  ApiRemoteCommand,
  RequestRemoteStartRequest,
} from '@mediafox/shared-types';

import { apiClient } from './api-client';

/** WO-ARGOS-064 — Remote Operations Phase A frontend API surface. Every
 * call goes through the tenant-scoped, RBAC-gated backend endpoints; this
 * module never resolves protocol identifiers itself. */

export function listCredentials(): Promise<ApiAuthorizationCredential[]> {
  return apiClient.get<ApiAuthorizationCredential[]>('/credentials');
}

export function requestRemoteStart(
  connectorId: string,
  authorizationCredentialId: string,
): Promise<ApiRemoteCommand> {
  const body: RequestRemoteStartRequest = { authorizationCredentialId };
  return apiClient.post<ApiRemoteCommand>(
    `/connectors/${connectorId}/remote-start`,
    body,
  );
}

export function requestRemoteStop(
  sessionId: string,
): Promise<ApiRemoteCommand> {
  return apiClient.post<ApiRemoteCommand>(`/sessions/${sessionId}/remote-stop`);
}

export function getRemoteCommand(id: string): Promise<ApiRemoteCommand> {
  return apiClient.get<ApiRemoteCommand>(`/remote-commands/${id}`);
}

export function listRemoteCommandsForConnector(
  connectorId: string,
): Promise<ApiRemoteCommand[]> {
  return apiClient.get<ApiRemoteCommand[]>(
    `/connectors/${connectorId}/remote-commands`,
  );
}

export function listRemoteCommandsForSession(
  sessionId: string,
): Promise<ApiRemoteCommand[]> {
  return apiClient.get<ApiRemoteCommand[]>(
    `/sessions/${sessionId}/remote-commands`,
  );
}
