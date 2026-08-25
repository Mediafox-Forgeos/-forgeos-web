import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MemberRole, MemberStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { CreateMembershipDto } from './dto/create-membership.dto';
import type { UpdateMembershipDto } from './dto/update-membership.dto';

/** Roles an ADMIN may assign or modify. OWNER and ADMIN are deliberately
 * excluded — an ADMIN minting or editing a peer/superior role is a
 * privilege-escalation path this WO closes conservatively (WO-ARGOS-089 §4:
 * "choose conservative behavior where existing policy does not decide").
 * Only OWNER may create or modify an OWNER/ADMIN membership. */
const ADMIN_MANAGEABLE_ROLES: readonly MemberRole[] = [
  MemberRole.OPERATOR,
  MemberRole.SUPPORT,
  MemberRole.ANALYST,
  MemberRole.VIEWER,
  MemberRole.TECHNICIAN,
];

export interface MembershipWithUser {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  createdAt: Date;
  user: { id: string; email: string; displayName: string };
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(organizationId: string): Promise<MembershipWithUser[]> {
    return this.prisma.membership.findMany({
      where: { organizationId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Adds an EXISTING MOVOS user (identified by email) to the organization.
   *
   * Deliberately does NOT create a brand-new User when none exists for the
   * given email. WO-ARGOS-089 §2 requires a proper invitation/password-setup
   * mechanism for that case rather than an invented temporary password, and
   * explicitly requires stopping to report the smallest secure alternative
   * when no reliable email-delivery infrastructure exists — confirmed absent
   * in this codebase (no nodemailer/SendGrid/Resend/SMTP anywhere). That
   * decision needs ARGOS sign-off before implementation; see this WO's
   * closure report. The NotFoundException below is deliberately specific
   * and actionable, not a dead end.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    actorRole: MemberRole,
    dto: CreateMembershipDto,
  ): Promise<MembershipWithUser> {
    if (
      actorRole === MemberRole.ADMIN &&
      !ADMIN_MANAGEABLE_ROLES.includes(dto.role)
    ) {
      throw new ForbiddenException(
        'Un ADMIN no puede asignar el rol OWNER o ADMIN. Solo un OWNER puede hacerlo.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new NotFoundException(
        'No existe una cuenta MOVOS con este correo electrónico. La creación de cuentas completamente nuevas no está disponible todavía en esta fase del piloto — contacta al equipo de MOVOS.',
      );
    }

    const existing = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId } },
    });
    if (existing) {
      throw new ConflictException(
        'Este usuario ya es miembro de esta organización.',
      );
    }

    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        organizationId,
        role: dto.role,
        status: MemberStatus.ACTIVE,
      },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    await this.audit.record({
      action: 'MEMBERSHIP_CREATED',
      organizationId,
      actorUserId,
      subjectType: 'Membership',
      subjectId: membership.id,
      metadata: { targetUserId: user.id, role: dto.role },
    });

    return membership;
  }

  async update(
    organizationId: string,
    actorUserId: string,
    actorRole: MemberRole,
    membershipId: string,
    dto: UpdateMembershipDto,
  ): Promise<MembershipWithUser> {
    if (dto.role === undefined && dto.status === undefined) {
      throw new BadRequestException(
        'Debes especificar un nuevo rol o un nuevo estado.',
      );
    }

    // Tenant isolation: a membership id from another organization is
    // indistinguishable from one that doesn't exist — same discipline used
    // throughout MOVOS (RemoteCommand, stations, credentials, ...).
    const target = await this.prisma.membership.findFirst({
      where: { id: membershipId, organizationId },
    });
    if (!target) {
      throw new NotFoundException('Membresía no encontrada.');
    }

    const targetIsOwnerOrAdmin =
      target.role === MemberRole.OWNER || target.role === MemberRole.ADMIN;
    const nextRoleIsOwnerOrAdmin =
      dto.role === MemberRole.OWNER || dto.role === MemberRole.ADMIN;

    if (
      actorRole === MemberRole.ADMIN &&
      (targetIsOwnerOrAdmin || nextRoleIsOwnerOrAdmin)
    ) {
      throw new ForbiddenException(
        'Un ADMIN no puede modificar una membresía OWNER o ADMIN.',
      );
    }

    const nextRole = dto.role ?? target.role;
    const nextStatus = dto.status ?? target.status;

    const wasActiveOwner =
      target.role === MemberRole.OWNER && target.status === MemberStatus.ACTIVE;
    const staysActiveOwner =
      nextRole === MemberRole.OWNER && nextStatus === MemberStatus.ACTIVE;

    if (wasActiveOwner && !staysActiveOwner) {
      const otherActiveOwners = await this.prisma.membership.count({
        where: {
          organizationId,
          role: MemberRole.OWNER,
          status: MemberStatus.ACTIVE,
          id: { not: target.id },
        },
      });
      if (otherActiveOwners === 0) {
        throw new ConflictException(
          'No es posible: la organización debe conservar al menos un OWNER activo.',
        );
      }
    }

    const updated = await this.prisma.membership.update({
      where: { id: target.id },
      data: { role: nextRole, status: nextStatus },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, email: true, displayName: true } },
      },
    });

    await this.audit.record({
      action: 'MEMBERSHIP_UPDATED',
      organizationId,
      actorUserId,
      subjectType: 'Membership',
      subjectId: target.id,
      metadata: {
        previousRole: target.role,
        previousStatus: target.status,
        role: nextRole,
        status: nextStatus,
      },
    });

    return updated;
  }
}
