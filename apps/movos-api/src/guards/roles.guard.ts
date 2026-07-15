import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MemberRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import type { RequestWithContext } from '../common/request-context';

/**
 * Enforces role requirements declared with @Roles(). Runs after
 * OrgContextGuard, which attaches the active Membership.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      MemberRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const membership = request.membership;

    if (!membership || !requiredRoles.includes(membership.role)) {
      throw new ForbiddenException('Permisos insuficientes');
    }

    return true;
  }
}
