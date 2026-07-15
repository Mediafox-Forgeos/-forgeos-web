import type { Organization, Membership, Site, User } from '@prisma/client';
import type {
  ApiOrganization,
  ApiMembership,
  ApiSite,
  ApiUser,
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
  };
}
