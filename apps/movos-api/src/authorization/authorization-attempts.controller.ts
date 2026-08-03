import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { AuthorizationAttemptsService } from './authorization-attempts.service';
import { ListAttemptsQueryDto } from './dto/list-attempts-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { toApiAuthorizationAttempt } from '../auth/presenters';

@ApiTags('authorization-attempts')
@Controller('authorization-attempts')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class AuthorizationAttemptsController {
  constructor(private readonly attempts: AuthorizationAttemptsService) {}

  @Get()
  @ApiOperation({
    summary: 'List authorization attempts for the active organization',
  })
  async list(
    @OrgContext() membership: Membership,
    @Query() query: ListAttemptsQueryDto,
  ) {
    const attempts = await this.attempts.list(membership.organizationId, query);
    return attempts.map(toApiAuthorizationAttempt);
  }
}
