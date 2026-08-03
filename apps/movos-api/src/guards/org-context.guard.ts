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
 * Enforces multi-tenant isolation. DEC-022 (WO-ARGOS-015, Invariant 2/3):
 * the active organization is the `orgId` claim embedded in the caller's
 * access token — the sole source of truth for ordinary, organization-scoped
 * human requests. The `X-Organization-Id` header is **not** read here and
 * has no effect on which organization a request resolves to; a token with
 * no `orgId` (a "pre-selection" token — see `AuthService.login`) is
 * rejected outright for every route this guard protects, regardless of any
 * header a caller might still send.
 *
 * The one sanctioned exception to "the token is the sole source" is
 * `POST /auth/refresh`'s optional `organizationId` body field — that is a
 * token-*issuance* endpoint, not an ordinary organization-scoped resource
 * request, and it does not use this guard at all; it re-validates
 * membership itself, exactly like `select-organization` already does. See
 * docs/domain/DEC-022_MIGRATION.md for why that is not a violation of this
 * guard's invariant.
 *
 * Membership is ALWAYS re-validated server-side against the database on
 * every request — the JWT's `orgId` claim is never trusted as authorization
 * on its own, only as a selector for which row to re-verify. The resolved
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

    const organizationId = user.orgId;

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
