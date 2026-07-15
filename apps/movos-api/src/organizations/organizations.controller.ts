import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toApiOrganization } from '../auth/presenters';
import type { AuthenticatedUser } from '../common/request-context';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List organizations the current user belongs to' })
  async list(@CurrentUser() user: AuthenticatedUser) {
    const orgs = await this.organizations.listForUser(user.id);
    return orgs.map(toApiOrganization);
  }
}
