import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Membership } from '@prisma/client';
import type { ApiRecommendation } from '@mediafox/shared-types';

import { RecommendationService } from './recommendation.service';
import { ActionService } from './action.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { OrgContext } from '../common/decorators/org-context.decorator';
import { toApiAction } from '../auth/presenters';

/**
 * Operational Intelligence MVP (WO-ARGOS-025) + Operational Execution
 * Layer (WO-ARGOS-026). RecommendationService itself remains read-only —
 * this controller enriches its output with each recommendation's
 * currently-relevant Action (if any), read via ActionService, but writes
 * nothing here. No Alert/Incident/MaintenanceTicket.
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
  constructor(
    private readonly recommendations: RecommendationService,
    private readonly actions: ActionService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List current operational recommendations (at most one per type, 5 types total), each enriched with its currently-relevant Action if one exists',
  })
  async list(
    @OrgContext() membership: Membership,
  ): Promise<ApiRecommendation[]> {
    const live = await this.recommendations.getAll(membership.organizationId);
    return Promise.all(
      live.map(async (recommendation) => {
        const action = recommendation.stationId
          ? await this.actions.findRelevant(
              membership.organizationId,
              recommendation.stationId,
              recommendation.type,
            )
          : null;
        return {
          ...recommendation,
          action: action ? toApiAction(action) : null,
        };
      }),
    );
  }
}
