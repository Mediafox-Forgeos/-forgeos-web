import { Module } from '@nestjs/common';

import { AuthorizationCredentialsService } from './authorization-credentials.service';
import { AuthorizationCredentialsController } from './authorization-credentials.controller';
import { AuthorizationAttemptsService } from './authorization-attempts.service';
import { AuthorizationAttemptsController } from './authorization-attempts.controller';
import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

/**
 * CAP-004 — Authorization foundation (WO-ARGOS-009). See
 * docs/domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md and
 * docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md. Exports
 * AuthorizationAttemptsService for the OCPP module's Authorize/
 * StartTransaction handlers — no OCPP-specific code lives here.
 */
@Module({
  controllers: [
    AuthorizationCredentialsController,
    AuthorizationAttemptsController,
  ],
  providers: [
    OrgContextGuard,
    RolesGuard,
    AuthorizationCredentialsService,
    AuthorizationAttemptsService,
  ],
  exports: [AuthorizationAttemptsService, AuthorizationCredentialsService],
})
export class AuthorizationModule {}
