/**
 * Pure type contracts for future authorization work (Architecture Backlog
 * #4-15, docs/domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md). No runtime
 * code, no Prisma model, no service — nothing here is implemented. This
 * file exists only so the future implementation has a compile-checked
 * starting shape, and so CI proves these types stay internally consistent
 * even though nothing implements them yet.
 */

export type AuthorizationCredentialType =
  | 'RFID'
  | 'QR'
  | 'App'
  | 'Remote'
  | 'API'
  | 'Fleet'
  | 'PlugAndCharge'
  | 'Guest'
  | 'LocalList';

export type AuthorizationCredentialStatus =
  'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'EXPIRED';

export interface AuthorizationCredential {
  id: string;
  type: AuthorizationCredentialType;
  /** The physical/protocol-facing identifier (e.g. an RFID UID) — never
   * the primary key, mirroring Evse.externalId/Connector.externalId. */
  externalIdentifier: string;
  status: AuthorizationCredentialStatus;
  validFrom?: string;
  validUntil?: string;
}

export type AuthorizationDecisionOutcome =
  'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'BLOCKED';

export interface AuthorizationAttempt {
  id: string;
  credentialId: string | null;
  stationIdentity: string;
  connectorExternalId?: string;
  attemptedAt: string;
}

export interface AuthorizationDecision {
  id: string;
  attemptId: string;
  outcome: AuthorizationDecisionOutcome;
  reason?: string;
}
