import { Module } from '@nestjs/common';

import { RecommendationService } from './recommendation.service';
import { RecommendationController } from './recommendation.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Operational Intelligence MVP (WO-ARGOS-025). See
 * docs/product/RECOMMENDATION_CATALOG.md and
 * docs/implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md.
 */
@Module({
  controllers: [RecommendationController],
  providers: [RecommendationService, OrgContextGuard, RolesGuard],
  exports: [RecommendationService],
})
export class RecommendationModule {}
