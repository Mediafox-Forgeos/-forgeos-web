import { Module } from '@nestjs/common';

import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { ActionService } from './action.service';
import { ActionController } from './action.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Operational Intelligence MVP (WO-ARGOS-025) + Operational Execution
 * Layer (WO-ARGOS-026). One module for both — RecommendationService
 * (read-only, computed) and ActionService (the one write path, over its
 * own `Action` table) are closely related enough to share a module rather
 * than split into two for a "lightweight Action Center," per the work
 * order's own framing. See
 * docs/product/RECOMMENDATION_CATALOG.md and
 * docs/implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md.
 */
@Module({
  controllers: [RecommendationController, ActionController],
  providers: [
    RecommendationService,
    ActionService,
    OrgContextGuard,
    RolesGuard,
  ],
  exports: [RecommendationService, ActionService],
})
export class RecommendationModule {}
