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
import { ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { SitesService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiSite } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('sites')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('sites')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class SitesController {
  constructor(private readonly sites: SitesService) {}

  @Get()
  @ApiOperation({ summary: 'List non-archived sites for the organization' })
  async list(@OrgContext() membership: Membership) {
    const sites = await this.sites.list(membership.organizationId);
    return sites.map(toApiSite);
  }

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a site (OWNER or ADMIN)' })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSiteDto,
  ) {
    const site = await this.sites.create(
      membership.organizationId,
      user.id,
      dto,
    );
    return toApiSite(site);
  }

  @Get(':siteId')
  @ApiOperation({ summary: 'Get a site by id' })
  async getById(
    @OrgContext() membership: Membership,
    @Param('siteId') siteId: string,
  ) {
    const site = await this.sites.getById(membership.organizationId, siteId);
    return toApiSite(site);
  }

  @Patch(':siteId')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN, MemberRole.OPERATOR)
  @ApiOperation({ summary: 'Update a site (OWNER, ADMIN or OPERATOR)' })
  async update(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId') siteId: string,
    @Body() dto: UpdateSiteDto,
  ) {
    const site = await this.sites.update(
      membership.organizationId,
      user.id,
      siteId,
      dto,
    );
    return toApiSite(site);
  }

  @Post(':siteId/archive')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive a site (OWNER or ADMIN)' })
  async archive(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('siteId') siteId: string,
  ) {
    const site = await this.sites.archive(
      membership.organizationId,
      user.id,
      siteId,
    );
    return toApiSite(site);
  }
}
