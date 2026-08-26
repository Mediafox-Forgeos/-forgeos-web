import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { MembershipsService } from './memberships.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiOrganizationMember } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

/**
 * WO-ARGOS-089 — organization member management (list/add/role-change/
 * deactivate). OWNER/ADMIN only at the route level; finer-grained
 * boundaries (an ADMIN cannot touch an OWNER/ADMIN membership, the
 * final-OWNER invariant) live in MembershipsService — see its doc
 * comments. Adding a brand-new (not-yet-a-MOVOS-user) person is
 * deliberately out of scope here; see MembershipsService.create.
 */
@ApiTags('memberships')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('memberships')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary: 'List members of the active organization (OWNER or ADMIN)',
  })
  async list(@OrgContext() membership: Membership) {
    const rows = await this.memberships.list(membership.organizationId);
    return rows.map(toApiOrganizationMember);
  }

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Add an existing MOVOS user to the active organization (OWNER or ADMIN)',
  })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMembershipDto,
  ) {
    const created = await this.memberships.create(
      membership.organizationId,
      user.id,
      membership.role,
      dto,
    );
    return toApiOrganizationMember(created);
  }

  @Patch(':id')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary: 'Change a member’s role and/or status (OWNER or ADMIN)',
  })
  async update(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMembershipDto,
  ) {
    const updated = await this.memberships.update(
      membership.organizationId,
      user.id,
      membership.role,
      id,
      dto,
    );
    return toApiOrganizationMember(updated);
  }
}
