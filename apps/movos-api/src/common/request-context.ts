import type { Membership } from '@prisma/client';
import type { Request } from 'express';

/**
 * The authenticated principal attached to the request by JwtStrategy.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  orgId?: string;
}

/**
 * Express request augmented with auth and tenant context populated by the
 * JWT strategy, the organization-context guard and the correlation
 * interceptor.
 */
export interface RequestWithContext extends Request {
  user?: AuthenticatedUser;
  membership?: Membership;
  correlationId?: string;
}
