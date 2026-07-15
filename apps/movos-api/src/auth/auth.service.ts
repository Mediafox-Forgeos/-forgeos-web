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
  refresh: IssuedRefresh;
  user: User;
  organizations: Organization[];
  memberships: Membership[];
}

export interface RefreshResult {
  accessToken: string;
  refresh: IssuedRefresh;
  userId: string;
}

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
    });

    const organizations = memberships.map((m) => m.organization);
    const bareMemberships = memberships.map(
      ({ organization: _organization, ...rest }) => rest,
    );

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
    });
    const refresh = await this.issueRefreshToken(user.id, ctx);

    await this.audit.record({
      action: 'LOGIN_SUCCEEDED',
      actorUserId: user.id,
      subjectType: 'User',
      subjectId: user.id,
    });

    return {
      accessToken,
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
   */
  async refresh(
    presentedToken: string | undefined,
    ctx: AuthContext = {},
  ): Promise<RefreshResult> {
    if (!presentedToken) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const tokenHash = this.hashRefreshToken(presentedToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
    });

    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException('Sesión expirada');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Sesión no válida');
    }

    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.signAccessToken({
      sub: user.id,
      email: user.email,
    });
    const refresh = await this.issueRefreshToken(user.id, ctx);

    return { accessToken, refresh, userId: user.id };
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
   * ACTIVE membership.
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
