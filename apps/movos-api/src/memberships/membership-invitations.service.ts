import { randomUUID, createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  MemberRole,
  MemberStatus,
  type MembershipInvitation,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ADMIN_MANAGEABLE_ROLES } from './memberships.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { AcceptInvitationDto } from './dto/accept-invitation.dto';

// Same rounds constant used everywhere else a password/secret is bcrypt-hashed
// in this codebase (prisma/seed.ts, ocpp-provisioning.service.ts).
const BCRYPT_ROUNDS = 12;

// One message for "token doesn't exist" / "expired" / "already accepted" —
// deliberately indistinguishable (§4: "token comparison must not expose
// useful distinction between nonexistent/expired/used token").
const INVALID_INVITATION_MESSAGE = 'Esta invitación no es válida o ya expiró.';

export interface InvitationWithOrgName {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
  role: MemberRole;
}

@Injectable()
export class MembershipInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Creates a one-time invitation for a person with no MOVOS account yet.
   * The frontend is expected to try POST /memberships (existing-user
   * direct-add) first and only fall back to this on a 404 — but this method
   * independently re-checks (never trusts the caller's sequencing) so a
   * direct API call can't create a dead invitation for an email that
   * already has a real account.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    actorRole: MemberRole,
    dto: CreateInvitationDto,
  ): Promise<{ invitation: MembershipInvitation; plaintextToken: string }> {
    if (
      actorRole === MemberRole.ADMIN &&
      !ADMIN_MANAGEABLE_ROLES.includes(dto.role)
    ) {
      throw new ForbiddenException(
        'Un ADMIN no puede invitar con el rol OWNER o ADMIN. Solo un OWNER puede hacerlo.',
      );
    }

    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException(
        'Ya existe una cuenta MOVOS con este correo — agrégalo directamente en lugar de invitarlo.',
      );
    }

    const existingInvitation = await this.prisma.membershipInvitation.findFirst(
      {
        where: {
          organizationId,
          email,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
      },
    );
    if (existingInvitation) {
      throw new ConflictException(
        'Ya existe una invitación pendiente para este correo en esta organización.',
      );
    }

    const plaintextToken = randomUUID();
    const tokenHash = this.hashToken(plaintextToken);
    const ttlHours =
      this.config.get<number>('MEMBERSHIP_INVITATION_TTL_HOURS') ?? 48;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const invitation = await this.prisma.membershipInvitation.create({
      data: {
        organizationId,
        email,
        role: dto.role,
        tokenHash,
        expiresAt,
        createdByUserId: actorUserId,
      },
    });

    await this.audit.record({
      action: 'MEMBERSHIP_INVITATION_CREATED',
      organizationId,
      actorUserId,
      subjectType: 'MembershipInvitation',
      subjectId: invitation.id,
      // Never the token itself, never anything password-adjacent.
      metadata: { email, role: dto.role },
    });

    return { invitation, plaintextToken };
  }

  /** Pending only — not accepted, not expired. Accepted/expired invitations
   * are historical noise for an OWNER/ADMIN glancing at who still needs to
   * onboard, not something this WO's UI needs to surface. */
  async listPending(organizationId: string): Promise<InvitationWithOrgName[]> {
    return this.prisma.membershipInvitation.findMany({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Public — resolves by token only, no auth/org context. Used by the
   * unauthenticated acceptance page before it asks for a password. */
  async preview(token: string): Promise<InvitationPreview> {
    const invitation = await this.findValidByToken(token);
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: invitation.organizationId },
      select: { name: true },
    });
    return {
      organizationName: organization.name,
      email: invitation.email,
      role: invitation.role,
    };
  }

  /**
   * Public, atomic acceptance. Creates the User (or reuses one that came to
   * exist through some other path between invite-creation and acceptance —
   * rare, but handled rather than assumed impossible) and the Membership
   * together, consumes the invitation, and audits — all inside one
   * transaction, re-validating the invitation's freshness inside it to
   * close the race between two concurrent accept attempts on the same
   * token. A retry after successful consumption hits the same
   * INVALID_INVITATION_MESSAGE as any other already-used token — it never
   * silently succeeds twice, and never creates a duplicate Membership.
   */
  async accept(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<{ email: string }> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new ConflictException('Las contraseñas no coinciden.');
    }

    // Validated once outside the transaction to fail fast/cheaply before
    // hashing a password for a token that's obviously already dead.
    const invitation = await this.findValidByToken(token);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.prisma.$transaction(async (tx) => {
      const fresh = await tx.membershipInvitation.findUnique({
        where: { id: invitation.id },
      });
      if (!fresh || fresh.acceptedAt || fresh.expiresAt < new Date()) {
        throw new NotFoundException(INVALID_INVITATION_MESSAGE);
      }

      let user = await tx.user.findUnique({ where: { email: fresh.email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email: fresh.email,
            passwordHash,
            displayName: dto.displayName.trim(),
            status: 'ACTIVE',
          },
        });
      }

      const existingMembership = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: fresh.organizationId,
          },
        },
      });
      if (existingMembership) {
        throw new ConflictException(
          'Este usuario ya es miembro de esta organización.',
        );
      }

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: fresh.organizationId,
          role: fresh.role,
          status: MemberStatus.ACTIVE,
        },
      });

      await tx.membershipInvitation.update({
        where: { id: fresh.id },
        data: { acceptedAt: new Date() },
      });

      await this.audit.record(
        {
          action: 'MEMBERSHIP_INVITATION_ACCEPTED',
          organizationId: fresh.organizationId,
          actorUserId: user.id,
          subjectType: 'MembershipInvitation',
          subjectId: fresh.id,
          metadata: { email: fresh.email, role: fresh.role },
        },
        tx,
      );

      return { email: fresh.email };
    });
  }

  private async findValidByToken(token: string): Promise<MembershipInvitation> {
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.membershipInvitation.findUnique({
      where: { tokenHash },
    });
    if (
      !invitation ||
      invitation.acceptedAt !== null ||
      invitation.expiresAt < new Date()
    ) {
      throw new NotFoundException(INVALID_INVITATION_MESSAGE);
    }
    return invitation;
  }

  /** Same construction as AuthService.hashRefreshToken: SHA-256 over a
   * high-entropy random token, for O(1) lookup while a database leak alone
   * can't be replayed. bcrypt is deliberately not used here — its per-row
   * salt makes lookup-by-hash impossible, and it exists to slow down
   * brute-forcing a low-entropy human password, not a 122-bit random UUID. */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
