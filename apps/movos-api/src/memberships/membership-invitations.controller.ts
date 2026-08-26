import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { MembershipInvitationsService } from './membership-invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiMembershipInvitation } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

/**
 * WO-ARGOS-089 — creating/listing invitations for people with no MOVOS
 * account yet. Authenticated, org-scoped, OWNER/ADMIN only — the public
 * token-preview/acceptance routes live in PublicInvitationsController
 * instead, since they must never require a session or org context.
 */
@ApiTags('memberships')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('memberships/invitations')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class MembershipInvitationsController {
  constructor(private readonly invitations: MembershipInvitationsService) {}

  @Get()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary: 'List pending invitations for the active organization',
  })
  async list(@OrgContext() membership: Membership) {
    const rows = await this.invitations.listPending(membership.organizationId);
    return rows.map(toApiMembershipInvitation);
  }

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Invite a person with no MOVOS account yet to the active organization',
  })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    const { invitation, plaintextToken } = await this.invitations.create(
      membership.organizationId,
      user.id,
      membership.role,
      dto,
    );
    return {
      ...toApiMembershipInvitation(invitation),
      // The plaintext token exists only in this one response — the
      // frontend embeds it into the /invite/<token> URL and never persists
      // it beyond that. Never logged, never re-derivable, never stored.
      token: plaintextToken,
    };
  }
}
