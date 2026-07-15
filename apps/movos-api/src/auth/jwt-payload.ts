/**
 * Signed access-token payload. `orgId` is present once a user has selected an
 * active organization.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  orgId?: string;
}
