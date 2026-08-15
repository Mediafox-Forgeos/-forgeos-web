import type {
  Organization,
  Membership,
  Site,
  User,
  ChargingStation,
  Evse,
  Connector,
  MeterValue,
  AuthorizationCredential,
  AuthorizationAttempt,
} from '@prisma/client';
import type {
  ApiOrganization,
  ApiMembership,
  ApiSite,
  ApiUser,
  ApiChargingStation,
  ApiEvse,
  ApiConnector,
  ApiChargingSession,
  ApiMeterValue,
  ApiAuthorizationCredential,
  ApiAuthorizationAttempt,
  ApiAction,
  ApiWorkOrder,
  ApiWorkOrderEvent,
  ApiAssignableTechnician,
} from '@mediafox/shared-types';
import type { ChargingSessionWithNames } from '../sessions/sessions.service';
import type { ActionWithNames } from '../recommendations/action.service';
import type {
  WorkOrderWithNames,
  WorkOrderEventWithActor,
  AssignableTechnician,
} from '../work-orders/work-order.service';

/**
 * Explicit projections from Prisma models to public API contracts. These are
 * the ONLY types crossing the API boundary — Prisma models (including
 * passwordHash) never leave the service.
 */
export function toApiUser(user: User): ApiUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    status: user.status,
  };
}

export function toApiOrganization(org: Organization): ApiOrganization {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
  };
}

export function toApiMembership(membership: Membership): ApiMembership {
  return {
    id: membership.id,
    organizationId: membership.organizationId,
    role: membership.role,
    status: membership.status,
  };
}

export function toApiSite(site: Site): ApiSite {
  return {
    id: site.id,
    organizationId: site.organizationId,
    name: site.name,
    slug: site.slug,
    city: site.city,
    address: site.address,
    latitude: site.latitude,
    longitude: site.longitude,
    status: site.status,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
    formattedAddress: site.formattedAddress,
    addressLine1: site.addressLine1,
    addressLine2: site.addressLine2,
    state: site.state,
    postalCode: site.postalCode,
    countryCode: site.countryCode,
    googlePlaceId: site.googlePlaceId,
    locationSource: site.locationSource as ApiSite['locationSource'],
    locationValidationStatus:
      site.locationValidationStatus as ApiSite['locationValidationStatus'],
    locationValidatedAt: site.locationValidatedAt?.toISOString() ?? null,
  };
}

export function toApiChargingStation(
  station: ChargingStation,
): ApiChargingStation {
  return {
    id: station.id,
    siteId: station.siteId,
    name: station.name,
    code: station.code,
    manufacturer: station.manufacturer,
    model: station.model,
    serialNumber: station.serialNumber,
    protocol: station.protocol,
    status: station.status,
    commissionedAt: station.commissionedAt?.toISOString() ?? null,
    createdAt: station.createdAt.toISOString(),
    updatedAt: station.updatedAt.toISOString(),
    connectivityStatus: station.connectivityStatus,
    lastConnectedAt: station.lastConnectedAt?.toISOString() ?? null,
    lastDisconnectedAt: station.lastDisconnectedAt?.toISOString() ?? null,
    lastSeenAt: station.lastSeenAt?.toISOString() ?? null,
    lastProtocolVersion: station.lastProtocolVersion,
  };
}

export function toApiEvse(evse: Evse): ApiEvse {
  return {
    id: evse.id,
    chargingStationId: evse.chargingStationId,
    externalId: evse.externalId,
    name: evse.name,
    status: evse.status,
    maxPowerKw: evse.maxPowerKw,
    currentType: evse.currentType,
    phaseType: evse.phaseType,
    createdAt: evse.createdAt.toISOString(),
    updatedAt: evse.updatedAt.toISOString(),
  };
}

export function toApiConnector(connector: Connector): ApiConnector {
  return {
    id: connector.id,
    evseId: connector.evseId,
    externalId: connector.externalId,
    type: connector.type,
    status: connector.status,
    maxPowerKw: connector.maxPowerKw,
    createdAt: connector.createdAt.toISOString(),
    updatedAt: connector.updatedAt.toISOString(),
  };
}

// CAP-004 — Charging Sessions & Authorization Foundation (WO-ARGOS-009).
// The `site`/`chargingStation` name fields were unified onto this single
// presenter by WO-ARGOS-023 (Operational Consistency Hardening) — every
// real session a human can see (list, detail, or the dashboard's active-
// sessions widget) now goes through this one function, not three
// separately-maintained projections.
export function toApiChargingSession(
  session: ChargingSessionWithNames,
): ApiChargingSession {
  return {
    id: session.id,
    organizationId: session.organizationId,
    siteId: session.siteId,
    siteName: session.site.name,
    chargingStationId: session.chargingStationId,
    chargingStationName: session.chargingStation.name,
    evseId: session.evseId,
    connectorId: session.connectorId,
    authorizationCredentialId: session.authorizationCredentialId,
    protocolVersion: session.protocolVersion,
    protocolTransactionId: session.protocolTransactionId,
    status: session.status,
    terminationReason: session.terminationReason,
    meterStart: session.meterStart,
    meterStop: session.meterStop,
    energyWh: session.energyWh,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export function toApiMeterValue(meterValue: MeterValue): ApiMeterValue {
  return {
    id: meterValue.id,
    sessionId: meterValue.sessionId,
    timestamp: meterValue.timestamp.toISOString(),
    energyWh: meterValue.energyWh,
    powerW: meterValue.powerW,
    voltage: meterValue.voltage,
    current: meterValue.current,
    frequency: meterValue.frequency,
    temperature: meterValue.temperature,
  };
}

// Deliberately omits `metadata` — type-specific data not yet needed by any
// consumer and not worth committing to a public shape prematurely; add it
// when a real caller needs it.
export function toApiAuthorizationCredential(
  credential: AuthorizationCredential,
): ApiAuthorizationCredential {
  return {
    id: credential.id,
    organizationId: credential.organizationId,
    type: credential.type,
    externalIdentifier: credential.externalIdentifier,
    status: credential.status,
    issuedAt: credential.issuedAt?.toISOString() ?? null,
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    revokedAt: credential.revokedAt?.toISOString() ?? null,
    createdAt: credential.createdAt.toISOString(),
    updatedAt: credential.updatedAt.toISOString(),
  };
}

export function toApiAuthorizationAttempt(
  attempt: AuthorizationAttempt,
): ApiAuthorizationAttempt {
  return {
    id: attempt.id,
    organizationId: attempt.organizationId,
    chargingStationId: attempt.chargingStationId,
    evseId: attempt.evseId,
    connectorId: attempt.connectorId,
    authorizationCredentialId: attempt.authorizationCredentialId,
    presentedIdentifier: attempt.presentedIdentifier,
    attemptedAt: attempt.attemptedAt.toISOString(),
    result: attempt.result,
    reason: attempt.reason,
  };
}

// Operational Execution Layer (WO-ARGOS-026).
export function toApiAction(action: ActionWithNames): ApiAction {
  return {
    id: action.id,
    organizationId: action.organizationId,
    chargingStationId: action.chargingStationId,
    chargingStationName: action.chargingStation.name,
    recommendationType: action.recommendationType,
    title: action.title,
    severity: action.severity,
    explanation: action.explanation,
    evidence: action.evidence as string[],
    recommendedAction: action.recommendedAction,
    status: action.status,
    assignedToUserId: action.assignedToUserId,
    assignedToUserName: action.assignedTo?.displayName ?? null,
    snoozedUntil: action.snoozedUntil?.toISOString() ?? null,
    notes: action.notes,
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    resolvedAt: action.resolvedAt?.toISOString() ?? null,
  };
}

// Work Order V1 (WO-ARGOS-035).
export function toApiWorkOrder(workOrder: WorkOrderWithNames): ApiWorkOrder {
  return {
    id: workOrder.id,
    title: workOrder.title,
    description: workOrder.description,
    status: workOrder.status,
    priority: workOrder.priority,
    source: workOrder.source,
    stationId: workOrder.stationId,
    stationName: workOrder.station.name,
    assignedMemberId: workOrder.assignedMemberId,
    assignedMemberName: workOrder.assignedMember?.displayName ?? null,
    assignedAt: workOrder.assignedAt?.toISOString() ?? null,
    startedAt: workOrder.startedAt?.toISOString() ?? null,
    resolvedAt: workOrder.resolvedAt?.toISOString() ?? null,
    notes: workOrder.notes,
    createdAt: workOrder.createdAt.toISOString(),
    updatedAt: workOrder.updatedAt.toISOString(),
  };
}

export function toApiWorkOrderEvent(
  event: WorkOrderEventWithActor,
): ApiWorkOrderEvent {
  return {
    id: event.id,
    workOrderId: event.workOrderId,
    type: event.type,
    actorId: event.actorId,
    actorName: event.actor?.displayName ?? null,
    payload: (event.payload as Record<string, unknown> | null) ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toApiAssignableTechnician(
  technician: AssignableTechnician,
): ApiAssignableTechnician {
  return {
    userId: technician.userId,
    displayName: technician.displayName,
  };
}
