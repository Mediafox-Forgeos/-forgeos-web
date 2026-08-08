import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';

import { RecommendationService } from './recommendation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';

/**
 * Operational Intelligence MVP (WO-ARGOS-025). Read-only — no write path
 * exists on this controller, and no Alert/Incident/MaintenanceTicket is
 * created, acknowledged, or resolved anywhere here.
 */
@ApiTags('recommendations')
@ApiHeader({
  name: 'X-Organization-Id',
  description: 'Active organization id',
  required: false,
})
@Controller('recommendations')
@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)
export class RecommendationController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get()
  @ApiOperation({
    summary:
      'List current operational recommendations (at most one per type, 5 types total)',
  })
  async list(@OrgContext() membership: Membership) {
    return this.recommendations.getAll(membership.organizationId);
  }
}
