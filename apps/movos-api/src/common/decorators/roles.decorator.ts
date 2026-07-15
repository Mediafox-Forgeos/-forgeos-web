import { SetMetadata } from '@nestjs/common';
import { MemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given organization member roles. Applied together
 * with RolesGuard, which reads this metadata.
 */
export const Roles = (...roles: MemberRole[]) => SetMetadata(ROLES_KEY, roles);
