import { Module } from '@nestjs/common';

import { SessionsService } from './sessions.service';
import { SessionsController } from './sessions.controller';
import { SessionLifecycleService } from './session-lifecycle.service';
import { TransactionIdGeneratorService } from './transaction-id-generator.service';
import { MeterValuesService } from './meter-values.service';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * CAP-004 — Charging Sessions foundation (WO-ARGOS-009). SessionsService is
 * the read-only API surface; SessionLifecycleService is the only writer,
 * consumed by the OCPP module's transaction handlers, never called
 * directly from SessionsController. See
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md.
 */
@Module({
  controllers: [SessionsController],
  providers: [
    OrgContextGuard,
    RolesGuard,
    SessionsService,
    SessionLifecycleService,
    TransactionIdGeneratorService,
    MeterValuesService,
  ],
  exports: [SessionLifecycleService, SessionsService, MeterValuesService],
})
export class SessionsModule {}
