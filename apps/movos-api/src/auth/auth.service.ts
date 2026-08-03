import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Organization, Membership, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID, createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../common/request-context';
import type { JwtPayload } from './jwt-payload';

export interface AuthContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedRefresh {
  token: string;
  expiresAt: Date;
}

export interface LoginResult {
  accessToken: string;
  /** The organization the access token above is bound to, or `null` for a
   * "pre-selection" token — echoes the token's own `orgId` claim so callers
   * never need to decode the JWT to know it. */
  organizationId: string | null;
  refresh: IssuedRefresh;
  user: User;
  organizations: Organization[];
  memberships: Membership[];
}

export interface RefreshResult {
  accessToken: string;
  organizationId: string | null;
  refresh: IssuedRefresh;
  userId: string;
}

/**
 * How long after a refresh session is revoked a duplicate presentation of
 * its now-superseded token is still tolerated as a legitimate, racing
 * duplicate (e.g. two browser tabs refreshing near-simultaneously against
 * the same shared cookie) rather than rejected outright. See
 * docs/domain/DEC-022_MIGRATION.md — this is strictly about tolerating a
 * benign refresh-token rotation race; it does not extend how long a
 * revoked *membership* remains effective, which is re-checked fresh on
 * every request regardless of this window.
 */
const REFRESH_GRACE_WINDOW_MS = 10_000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Verifies email + password. Returns the authenticated principal, or null
   * for any failure (unknown email, bad password, non-active user). Callers
   * must surface only a generic error and never reveal which check failed.
   */
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<AuthenticatedUser | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return null;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return null;
    }

    if (user.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  }

  /**
   * Completes a login: loads memberships/orgs, issues an access token and a
   * rotating refresh token, and records an audit event.
   *
   * DEC-022 (WO-ARGOS-015) — a human access token is bound to exactly one
   * active organization (Invariant 1). Login itself resolves that binding
   * where it can be resolved unambiguously: a user with exactly one ACTIVE
   * membership is auto-selected into it immediately (no separate
   * select-organization round trip needed for the common case), and that
   * selection is itself audited as ORGANIZATION_SELECTED (trigger: auto),
   * same as an explicit one. A user with zero or multiple ACTIVE
   * memberships receives a token with no `orgId` — a deliberately narrow
   * "pre-selection" token, valid only for identity- and
   * organization-listing endpoints (`/auth/me`, `/organizations`,
   * `/auth/select-organization` itself); `OrgContextGuard` rejects it for
   * every organization-scoped route, by construction, since it has no
   * `orgId` to resolve. See docs/domain/DEC-022_MIGRATION.md.
   */
  async login(
    principal: AuthenticatedUser,
    ctx: AuthContext = {},
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: principal.id },
    });
    if (!user) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { organization: { name: 'asc' } },
    });

    const organizations = memberships.map((m) => m.organization);
    const bareMemberships = memberships.map(
      ({ organization: _organization, ...rest }) => rest,
    );

    const autoSelectedOrgId =
      memberships.length === 1 ? memberships[0]!.organizationId : undefined;

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      orgId: autoSelectedOrgId,
    });
    const refresh = await this.issueRefreshToken(user.id, ctx);

    await this.audit.record({
      action: 'LOGIN_SUCCEEDED',
      actorUserId: user.id,
      subjectType: 'User',
      subjectId: user.id,
    });

    if (autoSelectedOrgId) {
      await this.audit.record({
        action: 'ORGANIZATION_SELECTED',
        actorUserId: user.id,
        organizationId: autoSelectedOrgId,
        subjectType: 'Organization',
        subjectId: autoSelectedOrgId,
        metadata: { trigger: 'auto', reason: 'single-membership-at-login' },
      });
    }

    return {
      accessToken,
      organizationId: autoSelectedOrgId ?? null,
      refresh,
      user,
      organizations,
      memberships: bareMemberships,
    };
  }

  async recordFailedLogin(email: string): Promise<void> {
    await this.audit.record({
      action: 'LOGIN_FAILED',
      metadata: { email: email.trim().toLowerCase() },
    });
  }

  /**
   * Rotates a refresh token: validates the presented token, revokes its
   * session, and issues a fresh access + refresh pair.
   *
   * DEC-022 (WO-ARGOS-015) — two behaviors beyond plain rotation:
   *
   * 1. **Organization affinity survives refresh (Invariant 1 / rule 11).**
   *    The caller may pass `requestedOrganizationId` — the organization the
   *    *client* (one specific browser tab) currently has active. Membership
   *    is re-validated fresh, exactly like `selectOrganization`; if valid,
   *    the newly-minted access token carries that `orgId`. If invalid (e.g.
   *    revoked since the last refresh), the new token simply omits `orgId`
   *    rather than failing the whole refresh — the user's underlying
   *    session is still legitimate, they've only lost that one
   *    organization. This is also what makes independent per-tab
   *    organization affinity possible without a shared, server-side
   *    "current org" concept: each tab supplies its own value on its own
   *    refresh calls (see docs/domain/DEC-022_MIGRATION.md).
   *
   * 2. **A short grace window absorbs the refresh-rotation race identified
   *    in DEC-022's threat model** (two tabs refreshing near-simultaneously
   *    against the same shared cookie). If the presented token was revoked
   *    very recently (within `REFRESH_GRACE_WINDOW_MS`), this is treated as
   *    a legitimate, racing duplicate of an already-completed rotation, not
   *    a replay — the caller is issued their own fresh session rather than
   *    a spurious `401`. A token revoked outside that window is rejected
   *    exactly as before. This does not touch membership-revocation
   *    immediacy (Invariant 7) — that check happens fresh, per request,
   *    unaffected by this window.
   */
  async refresh(
    presentedToken: string | undefined,
    ctx: AuthContext = {},
    requestedOrganizationId?: string,
  ): Promise<RefreshResult> {
    if (!presentedToken) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const tokenHash = this.hashRefreshToken(presentedToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (!session || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const withinGraceWindow =
      session.revokedAt !== null &&
      Date.now() - session.revokedAt.getTime() <= REFRESH_GRACE_WINDOW_MS;

    if (session.revokedAt !== null && !withinGraceWindow) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sesión no válida');
    }

    const refresh = await this.issueRefreshToken(user.id, ctx);

    if (session.revokedAt === null) {
      // The normal path: this is the currently-active session. Revoke it
      // now, atomically recording what replaced it so a racing duplicate
      // presentation (see above) can be resolved gracefully instead of
      // hard-failing.
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: this.hashRefreshToken(refresh.token),
        },
      });
    }
    // Grace-window path: session is already revoked by an earlier, winning
    // rotation. Nothing further to update on it — this caller simply
    // receives their own fresh, independent session rather than a 401.

    const orgId = requestedOrganizationId
      ? await this.resolveActiveMembershipOrgId(
          user.id,
          requestedOrganizationId,
        )
      : undefined;

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      orgId,
    });

    return {
      accessToken,
      organizationId: orgId ?? null,
      refresh,
      userId: user.id,
    };
  }

  /** Returns `organizationId` if the user holds an ACTIVE membership in it,
   * `undefined` otherwise — never throws, since a caller passing a
   * no-longer-valid organization should fall back to no `orgId`, not fail
   * outright (see `refresh`'s doc comment). */
  private async resolveActiveMembershipOrgId(
    userId: string,
    organizationId: string,
  ): Promise<string | undefined> {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    return membership && membership.status === 'ACTIVE'
      ? organizationId
      : undefined;
  }

  /**
   * Revokes the refresh session tied to the presented token (logout).
   */
  async logout(
    userId: string,
    presentedToken: string | undefined,
  ): Promise<void> {
    if (presentedToken) {
      const tokenHash = this.hashRefreshToken(presentedToken);
      await this.prisma.refreshSession.updateMany({
        where: { tokenHash, userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record({
      action: 'LOGOUT',
      actorUserId: userId,
      subjectType: 'User',
      subjectId: userId,
    });
  }

  /**
   * Returns the current user together with active memberships/orgs.
   */
  async getProfile(userId: string): Promise<{
    user: User;
    organizations: Organization[];
    memberships: Membership[];
  }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const memberships = await this.prisma.membership.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { organization: true },
      orderBy: { organization: { name: 'asc' } },
    });

    return {
      user,
      organizations: memberships.map((m) => m.organization),
      memberships: memberships.map(
        ({ organization: _organization, ...rest }) => rest,
      ),
    };
  }

  /**
   * Issues an access token scoped to a specific organization after verifying
   * ACTIVE membership (Invariant 4's explicit switch). Unlike `refresh`'s
   * graceful degrade-to-no-org fallback, an explicit user-initiated
   * selection of an organization they don't have ACTIVE access to fails
   * loudly — the user asked for something specific and should be told it
   * didn't work, not silently handed a pre-selection token instead.
   */
  async selectOrganization(
    userId: string,
    organizationId: string,
  ): Promise<{ accessToken: string; organizationId: string }> {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Acceso a la organización denegado');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Sesión no válida');
    }

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
      orgId: organizationId,
    });

    await this.audit.record({
      action: 'ORGANIZATION_SELECTED',
      actorUserId: userId,
      organizationId,
      subjectType: 'Organization',
      subjectId: organizationId,
      metadata: { trigger: 'explicit' },
    });

    return { accessToken, organizationId };
  }

  private async signAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<number>('JWT_ACCESS_TTL') ?? 900,
    });
  }

  private async issueRefreshToken(
    userId: string,
    ctx: AuthContext,
  ): Promise<IssuedRefresh> {
    const token = randomUUID();
    const tokenHash = this.hashRefreshToken(token);
    const ttlSeconds = this.config.get<number>('JWT_REFRESH_TTL') ?? 604800;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Refresh tokens are opaque random UUIDs. We store a SHA-256 hash so a
   * database leak cannot be replayed, while keeping lookups O(1) by unique
   * hash. (bcrypt cannot be used for lookup because its salt differs per row.)
   */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
