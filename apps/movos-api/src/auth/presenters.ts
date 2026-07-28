import type {
  Organization,
  Membership,
  Site,
  User,
  ChargingStation,
  Evse,
  Connector,
} from '@prisma/client';
import type {
  ApiOrganization,
  ApiMembership,
  ApiSite,
  ApiUser,
  ApiChargingStation,
  ApiEvse,
  ApiConnector,
} from '@mediafox/shared-types';

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
