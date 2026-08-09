import { Module } from '@nestjs/common';

import { WorkOrderService } from './work-order.service';
import { WorkOrderController } from './work-order.controller';
import { WorkOrderAutomationService } from './work-order-automation.service';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * Work Order V1 (WO-ARGOS-035) — the first execution layer that
 * coordinates a person, not just a station's status, around an
 * operational problem. See docs/operations/WORK_ORDER_DOMAIN.md
 * (WO-ARGOS-033) and docs/operations/WORKORDER_READINESS.md
 * (WO-ARGOS-034) for the design and scope this implements.
 */
@Module({
  controllers: [WorkOrderController],
  providers: [
    WorkOrderService,
    WorkOrderAutomationService,
    OrgContextGuard,
    RolesGuard,
  ],
  exports: [WorkOrderService],
})
export class WorkOrderModule {}
