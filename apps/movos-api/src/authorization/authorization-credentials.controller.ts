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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MemberRole, type Membership } from '@prisma/client';

import { AuthorizationCredentialsService } from './authorization-credentials.service';
import { CreateCredentialDto } from './dto/create-credential.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiAuthorizationCredential } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('credentials')
@Controller('credentials')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class AuthorizationCredentialsController {
  constructor(private readonly credentials: AuthorizationCredentialsService) {}

  @Get()
  @ApiOperation({
    summary: 'List authorization credentials for the active organization',
  })
  async list(@OrgContext() membership: Membership) {
    const credentials = await this.credentials.list(membership.organizationId);
    return credentials.map(toApiAuthorizationCredential);
  }

  @Post()
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue an authorization credential (OWNER or ADMIN)',
  })
  async create(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCredentialDto,
  ) {
    const credential = await this.credentials.create(
      membership.organizationId,
      user.id,
      dto,
    );
    return toApiAuthorizationCredential(credential);
  }

  @Patch(':id/revoke')
  @Roles(MemberRole.OWNER, MemberRole.ADMIN)
  @ApiOperation({
    summary: 'Revoke an authorization credential (OWNER or ADMIN)',
  })
  async revoke(
    @OrgContext() membership: Membership,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    const credential = await this.credentials.revoke(
      membership.organizationId,
      id,
      user.id,
    );
    return toApiAuthorizationCredential(credential);
  }
}
