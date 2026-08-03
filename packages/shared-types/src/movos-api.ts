/**
 * Public MOVOS API contracts shared between the NestJS API and the Next.js
 * web console. These are hand-written projections — Prisma-generated types are
 * never shared across the boundary.
 */

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

export interface ApiOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface ApiMembership {
  id: string;
  organizationId: string;
  role: string;
  status: string;
}

export type LocationSource =
  'GOOGLE_PLACES' | 'GOOGLE_GEOCODING' | 'MANUAL' | 'MANUAL_ADJUSTMENT';

export type LocationValidationStatus =
  'UNVALIDATED' | 'SUGGESTED' | 'CONFIRMED' | 'PARTIAL' | 'INVALID';

export interface LocationSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface AddressComponents {
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface ResolvedLocation {
  placeId: string;
  formattedAddress: string;
  components: AddressComponents;
  latitude: number;
  longitude: number;
  source: LocationSource;
}

export interface ApiSite {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  // Rich location fields
  formattedAddress: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  state: string | null;
  postalCode: string | null;
  countryCode: string | null;
  googlePlaceId: string | null;
  locationSource: LocationSource;
  locationValidationStatus: LocationValidationStatus;
  locationValidatedAt: string | null;
}

// CAP-002 — charging core domain (Site -> ChargingStation -> EVSE ->
// Connector, M001-A-DEC-005). "Charger" is not a persisted entity; see
// docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md for how these map to
// the frontend's existing Station/Charger/Connector types.

export interface ApiChargingStation {
  id: string;
  siteId: string;
  name: string;
  code: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  protocol: string | null;
  status: string;
  commissionedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // CAP-005 — device connectivity, distinct from `status` above
  // (ChargingStationStatus is administrative; this is last-known
  // connectivity evidence). See docs/domain/CAP-005_CONNECTIVITY_ENGINE.md.
  connectivityStatus: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastSeenAt: string | null;
  lastProtocolVersion: string | null;
}

export interface ApiEvse {
  id: string;
  chargingStationId: string;
  externalId: string | null;
  name: string | null;
  status: string;
  maxPowerKw: number | null;
  currentType: string | null;
  phaseType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiConnector {
  id: string;
  evseId: string;
  externalId: string | null;
  type: string;
  status: string;
  maxPowerKw: number | null;
  createdAt: string;
  updatedAt: string;
}

// CAP-004 — Charging Sessions & Authorization Foundation (WO-ARGOS-009).
// See docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md.

export interface ApiChargingSession {
  id: string;
  organizationId: string;
  siteId: string;
  chargingStationId: string;
  evseId: string;
  connectorId: string;
  authorizationCredentialId: string;
  protocolVersion: string;
  protocolTransactionId: string;
  status: string;
  terminationReason: string | null;
  meterStart: number;
  meterStop: number | null;
  energyWh: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiMeterValue {
  id: string;
  sessionId: string;
  timestamp: string;
  energyWh: number;
  powerW: number | null;
  voltage: number | null;
  current: number | null;
  frequency: number | null;
  temperature: number | null;
}

export interface ApiAuthorizationCredential {
  id: string;
  organizationId: string;
  type: string;
  // Never the raw physical UID's storage key, but the value itself is not
  // a secret (see MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md) — safe to
  // return to an authenticated, role-gated caller.
  externalIdentifier: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAuthorizationAttempt {
  id: string;
  organizationId: string;
  chargingStationId: string;
  evseId: string | null;
  connectorId: string | null;
  authorizationCredentialId: string | null;
  presentedIdentifier: string;
  attemptedAt: string;
  result: string;
  reason: string | null;
}

export interface LoginResponse {
  accessToken: string;
  /** DEC-022: the organization the access token is bound to, or `null` for
   * a "pre-selection" token (0 or >1 active memberships). */
  organizationId: string | null;
  user: ApiUser;
  organizations: ApiOrganization[];
  memberships: ApiMembership[];
}

export interface MeResponse {
  /** DEC-022: the organization the *current* access token is bound to. */
  organizationId: string | null;
  user: ApiUser;
  organizations: ApiOrganization[];
  memberships: ApiMembership[];
}

export interface RefreshResponse {
  accessToken: string;
  /** DEC-022: the organization the newly-issued token is bound to. `null`
   * if none was requested, or if the requested one is no longer a valid
   * ACTIVE membership (see AuthService.refresh). */
  organizationId: string | null;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
