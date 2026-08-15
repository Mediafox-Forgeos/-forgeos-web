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
  // Denormalized display names — WO-ARGOS-023 (Operational Consistency
  // Hardening) unified this onto the one session type every real screen
  // uses (list, detail, and the operator dashboard's active-sessions
  // widget), replacing what was previously a separate ApiActiveSession
  // type with the same two fields duplicated under a different name.
  siteName: string;
  chargingStationId: string;
  chargingStationName: string;
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

// CAP-X — Operator Control Center, Sprint 1 (WO-ARGOS-022). Read-only
// aggregation surface over ChargingStation/Evse/Connector/ChargingSession —
// see docs/domain/CAP-X_STATION_HEALTH.md and
// docs/implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md. StationHealthStatus
// is deliberately 4 values, not the 5 named in the full architecture —
// `maintenance` requires MaintenanceTicket, which does not exist yet
// (out of scope for Sprint 1, see the restrictions in WO-ARGOS-022).

export type StationHealthStatus =
  'healthy' | 'degraded' | 'offline' | 'unknown';

export interface ApiStationHealth {
  stationId: string;
  status: StationHealthStatus;
  reason: string;
}

export interface ApiStationHealthSummary {
  organizationId: string;
  siteId: string | null;
  totalStations: number;
  healthy: number;
  degraded: number;
  offline: number;
  unknown: number;
}

export interface ApiConnectivitySummary {
  organizationId: string;
  siteId: string | null;
  totalStations: number;
  online: number;
  offline: number;
  unknown: number;
}

export interface ApiConnectorStatusCounts {
  AVAILABLE: number;
  CHARGING: number;
  OCCUPIED: number;
  RESERVED: number;
  UNAVAILABLE: number;
  FAULTED: number;
  OFFLINE: number;
}

export interface ApiOccupancySummary {
  organizationId: string;
  siteId: string | null;
  totalConnectors: number;
  connectorStatusCounts: ApiConnectorStatusCounts;
  occupiedCount: number;
  eligibleCount: number;
  occupancyRate: number | null;
}

export interface ApiSiteHealthSummary {
  siteId: string;
  siteName: string;
  latitude: number | null;
  longitude: number | null;
  totalStations: number;
  worstStatus: StationHealthStatus;
  healthy: number;
  degraded: number;
  offline: number;
  unknown: number;
}

// Operational Intelligence MVP (WO-ARGOS-025). Read-only, computed insights
// over ChargingSession/AuthorizationAttempt/MeterValue — see
// docs/product/RECOMMENDATION_CATALOG.md (WO-ARGOS-024) for the discovery
// this implements, and docs/implementation/OPERATIONAL_INTELLIGENCE_
// TECHNICAL_NOTES.md for the exact algorithms. Exactly 5 recommendation
// types, each surfacing at most its single worst current instance — never
// persisted, recomputed on every request.
export type RecommendationType =
  | 'ENERGY_ANOMALY'
  | 'AUTH_FAILURE_SPIKE'
  | 'IDLE_CONNECTOR'
  | 'COMPARATIVE_UNDERPERFORMANCE'
  | 'EFFICIENCY_DRIFT';

// Uppercase — WO-ARGOS-026 corrected this from the Operational Intelligence
// MVP's original lowercase 'high'/'medium', the one status-vocabulary value
// in this API that didn't match every other status enum's UPPER_CASE
// convention (docs/product/OPERATIONAL_VOCABULARY.md). Now mirrors the
// real Prisma RecommendationSeverity enum exactly.
export type RecommendationSeverity = 'HIGH' | 'MEDIUM';

export interface ApiRecommendation {
  type: RecommendationType;
  title: string;
  severity: RecommendationSeverity;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  stationId: string | null;
  stationName: string | null;
  generatedAt: string;
  // WO-ARGOS-026 — the currently-relevant Action for this recommendation,
  // if an operator has already interacted with it (non-terminal, or
  // terminal and still within its cooldown window). Null means: no action
  // has been taken yet, or enough time has passed since the last one that
  // this reads as a fresh occurrence again. See ActionService.findRelevant.
  action?: ApiAction | null;
}

// Operational Execution Layer (WO-ARGOS-026). The persisted, actionable
// counterpart to ApiRecommendation above — see
// docs/implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md for
// the full state diagram. Deliberately not Alert/Incident/MaintenanceTicket
// — a narrower entity scoped only to RecommendationService's own output.
export type ActionStatus =
  'OPEN' | 'ACKNOWLEDGED' | 'ASSIGNED' | 'RESOLVED' | 'DISMISSED';

export interface ApiAction {
  id: string;
  organizationId: string;
  chargingStationId: string;
  chargingStationName: string;
  recommendationType: RecommendationType;
  title: string;
  severity: RecommendationSeverity;
  explanation: string;
  evidence: string[];
  recommendedAction: string;
  status: ActionStatus;
  assignedToUserId: string | null;
  assignedToUserName: string | null;
  snoozedUntil: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export type ActionTransition =
  'acknowledge' | 'assign' | 'snooze' | 'resolve' | 'dismiss';

export interface CreateActionRequest {
  recommendationType: RecommendationType;
  stationId: string;
  transition: ActionTransition;
  assignedToUserId?: string;
  notes?: string;
  snoozeMinutes?: number;
}

export interface TransitionActionRequest {
  transition: ActionTransition;
  assignedToUserId?: string;
  notes?: string;
  snoozeMinutes?: number;
}

// Work Order V1 (WO-ARGOS-035). The first execution layer that coordinates
// a person, not just a station's status, around an operational problem —
// see docs/operations/WORK_ORDER_DOMAIN.md (WO-ARGOS-033) for the full
// design this implements a deliberately smaller slice of, and
// docs/operations/WORKORDER_READINESS.md (WO-ARGOS-034) for why exactly
// these 3 sources and not the other 2 the full design proposed.
export type WorkOrderStatus =
  'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED';

export type WorkOrderPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type WorkOrderSource = 'CONNECTIVITY_LOSS' | 'RECOMMENDATION' | 'MANUAL';

export type WorkOrderEventType =
  'CREATED' | 'ASSIGNED' | 'STARTED' | 'COMMENTED' | 'RESOLVED' | 'CANCELLED';

export interface ApiWorkOrder {
  id: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  source: WorkOrderSource;
  stationId: string;
  stationName: string;
  assignedMemberId: string | null;
  assignedMemberName: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiWorkOrderEvent {
  id: string;
  workOrderId: string;
  type: WorkOrderEventType;
  actorId: string | null;
  actorName: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

export type WorkOrderTransition =
  'assign' | 'start' | 'comment' | 'resolve' | 'cancel';

export interface CreateWorkOrderRequest {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  source: WorkOrderSource;
  stationId: string;
}

export interface TransitionWorkOrderRequest {
  transition: WorkOrderTransition;
  assignedMemberId?: string;
  comment?: string;
}
