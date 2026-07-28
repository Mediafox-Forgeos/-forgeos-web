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

export interface LoginResponse {
  accessToken: string;
  user: ApiUser;
  organizations: ApiOrganization[];
  memberships: ApiMembership[];
}

export interface MeResponse {
  user: ApiUser;
  organizations: ApiOrganization[];
  memberships: ApiMembership[];
}

export interface RefreshResponse {
  accessToken: string;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
