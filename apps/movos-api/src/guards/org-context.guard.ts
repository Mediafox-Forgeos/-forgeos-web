import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithContext } from '../common/request-context';

/**
 * Enforces multi-tenant isolation. The active organization is taken from the
 * X-Organization-Id header, falling back to the orgId claim in the access
 * token. Membership is ALWAYS re-validated server-side against the database —
 * a client-supplied organization id is never trusted on its own. The resolved
 * ACTIVE Membership is attached to the request for downstream guards and
 * handlers.
 */
@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithContext>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const headerValue = request.headers['x-organization-id'];
    const headerOrgId =
      typeof headerValue === 'string' && headerValue.length > 0
        ? headerValue
        : undefined;
    const organizationId = headerOrgId ?? user.orgId;

    if (!organizationId) {
      throw new ForbiddenException('Organización no especificada');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Acceso a la organización denegado');
    }

    request.membership = membership;
    return true;
  }
}
