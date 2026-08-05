import { Module } from '@nestjs/common';

import { StationHealthService } from './station-health.service';
import { OperatorController } from './operator.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * CAP-X Operator Control Center, Sprint 1 (WO-ARGOS-022). See
 * docs/domain/CAP-X_OPERATOR_DOMAIN.md — this module owns only the
 * read-only, non-persisted StationHealth computation and its aggregations.
 * Alert/Incident/MaintenanceTicket (Sprint 2) are explicitly out of scope
 * and introduce no code here.
 */
@Module({
  controllers: [OperatorController],
  providers: [StationHealthService, OrgContextGuard, RolesGuard],
  exports: [StationHealthService],
})
export class OperatorModule {}
