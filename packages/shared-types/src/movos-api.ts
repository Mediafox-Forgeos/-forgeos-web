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
