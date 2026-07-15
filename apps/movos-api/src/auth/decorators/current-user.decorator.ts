import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type {
  AuthenticatedUser,
  RequestWithContext,
} from '../../common/request-context';

/**
 * Resolves the authenticated user attached to the request by JwtStrategy.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    if (!request.user) {
      throw new Error('CurrentUser used without an auth guard');
    }
    return request.user;
  },
);
