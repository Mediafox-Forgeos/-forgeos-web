import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Membership } from '@prisma/client';

import type { RequestWithContext } from '../request-context';

/**
 * Resolves the active organization Membership attached to the request by
 * OrgContextGuard.
 */
export const OrgContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membership => {
    const request = ctx.switchToHttp().getRequest<RequestWithContext>();
    if (!request.membership) {
      throw new Error('OrgContext used without OrgContextGuard');
    }
    return request.membership;
  },
);
