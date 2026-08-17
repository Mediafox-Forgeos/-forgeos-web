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

// WO-ARGOS-054 — Infrastructure Inventory Navigation. Denormalized parent
// names for the global inventory list endpoints only (GET /charging-stations,
// GET /evses, GET /connectors) — the existing per-parent endpoints/types
// above are untouched and keep returning the plain shape.
export interface ApiChargingStationListItem extends ApiChargingStation {
  siteName: string;
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

export type ApiOperationalStatus =
  | 'AVAILABLE'
  | 'IN_USE'
  | 'PARTIALLY_AVAILABLE'
  | 'UNAVAILABLE'
  | 'OFFLINE'
  | 'UNKNOWN';

export type ApiAttentionReason =
  'CONNECTOR_FAULTED' | 'ACTIVE_SESSION_CONNECTOR_NOT_IN_USE';

export interface ApiConnectorSummary {
  total: number;
  available: number;
  inUse: number;
  unavailable: number;
  faulted: number;
}

// WO-ARGOS-054 — "Cargador" is the friendly UX name for Evse; the type
// stays ApiEvse-shaped internally, this only adds parent names for the
// global inventory list.
//
// WO-ARGOS-056 — also carries the derived, never-persisted Operational
// Status (see docs — three-layer separation: Administrative status stays
// `status` above, unchanged; these four fields are the third, derived
// layer, computed at read time, never written back to `status` or to
// Connector.status).
export interface ApiEvseListItem extends ApiEvse {
  chargingStationName: string;
  siteId: string;
  siteName: string;
  operationalStatus: ApiOperationalStatus;
  requiresAttention: boolean;
  attentionReasons: ApiAttentionReason[];
  connectorSummary: ApiConnectorSummary;
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

// WO-ARGOS-054 — parent names for the global connector inventory list.
export interface ApiConnectorListItem extends ApiConnector {
  evseName: string | null;
  chargingStationId: string;
  chargingStationName: string;
  siteId: string;
  siteName: string;
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

// WO-ARGOS-038 — the operator's assignee picker on /work-orders/[id]. A
// projection of User, scoped server-side to ACTIVE MemberRole.TECHNICIAN
// memberships in the caller's own organization only.
export interface ApiAssignableTechnician {
  userId: string;
  displayName: string;
}

// WO-ARGOS-037 — the last 4 values are the field checklist
// (docs/operations/WORK_ORDER_CHECKLISTS.md), written only through
// MyWorkController's checklist-events endpoint.
// WO-ARGOS-049 — SCHEDULED is logged whenever an operator sets/clears
// WorkOrder.scheduledAt; not a status transition.
export type WorkOrderEventType =
  | 'CREATED'
  | 'ASSIGNED'
  | 'STARTED'
  | 'COMMENTED'
  | 'RESOLVED'
  | 'CANCELLED'
  | 'ARRIVAL_CONFIRMED'
  | 'DIAGNOSIS_RECORDED'
  | 'INTERVENTION_RECORDED'
  | 'VALIDATION_RECORDED'
  | 'SCHEDULED';

// WO-ARGOS-049 — derived, read-only. Never a manually-entered field on
// WorkOrder itself: computed server-side from
// WorkOrder -> ChargingStation -> Site at read time.
export interface ApiWorkOrderVisitLocation {
  siteName: string;
  stationName: string;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

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
  /** WO-ARGOS-049 — optional planned field visit, stored UTC. */
  scheduledAt: string | null;
  resolvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  visitLocation: ApiWorkOrderVisitLocation;
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
  /** WO-ARGOS-049 — optional, ISO 8601. */
  scheduledAt?: string;
}

// WO-ARGOS-049 — deliberately separate from TransitionWorkOrderRequest:
// scheduling a visit is not a WorkOrderStatus transition and must not be
// forced through VALID_TRANSITIONS' state-machine rules.
export interface SetWorkOrderScheduleRequest {
  scheduledAt: string | null;
}

export interface TransitionWorkOrderRequest {
  transition: WorkOrderTransition;
  assignedMemberId?: string;
  comment?: string;
}

// Technician Identity & My Work (WO-ARGOS-037). A technician's own
// self-scoped surface over the same WorkOrder/WorkOrderEvent data an
// operator sees on /work-orders — see
// docs/operations/FIELD_TECHNICIAN_CONSOLE.md. Deliberately a narrower
// transition set than WorkOrderTransition: no `assign`, no `cancel` — a
// technician executes and closes their own assigned work, they don't
// dispatch it.
export type MyWorkTransition = 'start' | 'comment' | 'resolve';

export interface TransitionMyWorkRequest {
  transition: MyWorkTransition;
  comment?: string;
}

// docs/operations/WORK_ORDER_CHECKLISTS.md's 5-stage model, stages 1-4
// (stage 5 is the existing `resolve` transition, unchanged). Every field
// besides `type` is optional at the type level because the required set is
// stage-specific — validated server-side in MyWorkService, not here.
export type ChecklistEventType =
  | 'ARRIVAL_CONFIRMED'
  | 'DIAGNOSIS_RECORDED'
  | 'INTERVENTION_RECORDED'
  | 'VALIDATION_RECORDED';

export interface RecordChecklistEventRequest {
  type: ChecklistEventType;
  /** ARRIVAL_CONFIRMED only — opt-in browser geolocation. */
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  /** DIAGNOSIS_RECORDED only — required by the server for this type. */
  finding?: string;
  /** INTERVENTION_RECORDED only — description required, actionType optional. */
  description?: string;
  actionType?: string;
  /** VALIDATION_RECORDED only — required by the server for this type. */
  outcomeNote?: string;
}

// WO-ARGOS-049 — Field evidence (photo/video). The binary itself never
// touches movos-api — only Vercel Blob (movos-web's connected store) holds
// it. This is metadata only, and deliberately omits any storage
// path/URL: a client that's authorized to view an attachment always gets a
// fresh, short-lived signed URL minted on demand, never a durable one
// persisted anywhere.
export type AttachmentKind = 'IMAGE' | 'VIDEO';

// Consumed at runtime by movos-web (bundled by Next.js, safe as a value
// import) for its upload-token constraints and client-side MIME filtering.
// movos-api does NOT import these as values — this package ships as raw
// .ts source with no build step (see package.json's `exports`), so a
// runtime `import { ... }` here works fine inside a bundler but fails
// under movos-api's plain `node dist/main.js` at container start (Node's
// ESM loader can't resolve the extensionless .ts import chain). movos-api
// keeps its own copy in src/work-orders/attachment-constraints.ts,
// consciously duplicated for exactly this reason — see that file's
// comment. Only `import type` from this package is safe inside movos-api.
export const ATTACHMENT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export const ATTACHMENT_MAX_SIZE_BYTES: Record<AttachmentKind, number> = {
  IMAGE: 25 * 1024 * 1024, // 25 MB
  VIDEO: 200 * 1024 * 1024, // 200 MB
};

export function attachmentKindForMimeType(
  mimeType: string,
): AttachmentKind | null {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  return null;
}

// WO-ARGOS-051 — Operations Console "Requires attention" V1. Deterministic
// rules only, evaluated once server-side (WorkOrderService.
// listAttentionItems) — movos-web renders `reasons`, it never re-derives
// them or duplicates the IN_PROGRESS_STALL_HOURS threshold.
export type WorkOrderAttentionReason =
  | 'HIGH_PRIORITY_UNRESOLVED'
  | 'SCHEDULED_OVERDUE'
  | 'UNASSIGNED'
  | 'STALLED_IN_PROGRESS';

export interface ApiWorkOrderAttentionItem {
  workOrder: ApiWorkOrder;
  reasons: WorkOrderAttentionReason[];
}

// WO-ARGOS-051 — the real, linkable list behind
// ApiConnectivitySummary.offline. Only ever built from a verified
// `connectivityStatus === 'OFFLINE'` row; UNKNOWN never appears here.
export interface ApiOfflineStation {
  stationId: string;
  stationName: string;
  siteId: string;
  siteName: string;
  lastDisconnectedAt: string | null;
}

// WO-ARGOS-051 — Operations Console technician workload panel. Roster is
// real ACTIVE MemberRole.TECHNICIAN memberships (the same set
// ApiAssignableTechnician already draws from); counts are real, unresolved
// WorkOrder rows assigned to that technician.
export interface ApiTechnicianWorkload {
  userId: string;
  displayName: string;
  unresolvedCount: number;
  inProgressCount: number;
  scheduledTodayCount: number;
}

export interface ApiWorkOrderAttachment {
  id: string;
  workOrderId: string;
  eventId: string | null;
  kind: AttachmentKind;
  mimeType: string;
  originalFilename: string | null;
  fileSizeBytes: number;
  uploadedById: string;
  uploadedByName: string | null;
  createdAt: string;
  /** Opaque Blob pathname — durable identity, not a fetchable URL on its
   * own (the store is private). Used only by movos-web's own view-url
   * route to mint a fresh short-lived signed URL; never persisted or
   * cached as if it granted access by itself. */
  storagePath: string;
}

/** Sent by movos-web's upload route to movos-api, server-to-server, before
 * minting a client upload token — the one place attachment authorization is
 * actually decided. */
export interface AuthorizeAttachmentUploadRequest {
  mimeType: string;
  fileSizeBytes: number;
  eventId?: string;
}

/** Sent by the browser to movos-api after a direct-to-Blob upload
 * completes, to persist durable metadata. storagePath is the opaque Blob
 * pathname — never a URL, never client-invented (movos-api verifies it was
 * actually issued for this WorkOrder before accepting it). */
export interface CreateWorkOrderAttachmentRequest {
  storagePath: string;
  kind: AttachmentKind;
  mimeType: string;
  fileSizeBytes: number;
  originalFilename?: string;
  eventId?: string;
}

/** Returned by movos-web's read-authorization route: a freshly-minted,
 * short-lived signed URL for viewing/downloading one private attachment.
 * Never cached, never persisted — request a new one each time. */
export interface AttachmentViewUrl {
  url: string;
  expiresAt: string;
}
