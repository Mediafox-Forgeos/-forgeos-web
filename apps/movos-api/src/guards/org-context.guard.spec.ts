import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import { OrgContextGuard } from './org-context.guard';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithContext } from '../common/request-context';

function createContext(request: Partial<RequestWithContext>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OrgContextGuard', () => {
  let guard: OrgContextGuard;
  let prisma: { membership: { findUnique: jest.Mock } };

  beforeEach(() => {
    prisma = { membership: { findUnique: jest.fn() } };
    guard = new OrgContextGuard(prisma as unknown as PrismaService);
  });

  it('throws when there is no authenticated user', async () => {
    const context = createContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws when the token carries no orgId (a pre-selection token)', async () => {
    const context = createContext({
      user: { id: 'u1', email: 'a@b.co', displayName: 'A', orgId: undefined },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  // DEC-022 (WO-ARGOS-015) Invariant 2/3: the JWT `orgId` claim is the sole
  // source of truth. A `X-Organization-Id` header must have zero effect —
  // neither overriding the token's org nor substituting for a missing one.
  it('ignores the X-Organization-Id header entirely, using only the token orgId', async () => {
    const request: Partial<RequestWithContext> = {
      user: { id: 'u1', email: 'a@b.co', displayName: 'A', orgId: 'o1' },
      headers: { 'x-organization-id': 'o2' },
    } as Partial<RequestWithContext>;
    prisma.membership.findUnique.mockResolvedValue({
      userId: 'u1',
      organizationId: 'o1',
      status: 'ACTIVE',
    });

    await guard.canActivate(createContext(request));

    expect(prisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: 'u1', organizationId: 'o1' } },
    });
  });

  it('rejects a header-only organization id when the token has none', async () => {
    const request: Partial<RequestWithContext> = {
      user: { id: 'u1', email: 'a@b.co', displayName: 'A', orgId: undefined },
      headers: { 'x-organization-id': 'o2' },
    } as Partial<RequestWithContext>;

    await expect(
      guard.canActivate(createContext(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  it('throws when the membership is missing or not ACTIVE', async () => {
    const context = createContext({
      user: { id: 'u1', email: 'a@b.co', displayName: 'A', orgId: 'o1' },
    });
    prisma.membership.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('attaches the resolved membership to the request and allows the call through', async () => {
    const request: Partial<RequestWithContext> = {
      user: { id: 'u1', email: 'a@b.co', displayName: 'A', orgId: 'o1' },
    };
    const membership = { userId: 'u1', organizationId: 'o1', status: 'ACTIVE' };
    prisma.membership.findUnique.mockResolvedValue(membership);

    const allowed = await guard.canActivate(createContext(request));

    expect(allowed).toBe(true);
    expect(request.membership).toEqual(membership);
  });
});
