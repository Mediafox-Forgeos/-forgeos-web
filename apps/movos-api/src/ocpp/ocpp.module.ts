import { Module } from '@nestjs/common';

import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthorizationModule } from '../authorization/authorization.module';

import { OcppAuthenticationService } from './authentication/ocpp-authentication.service';
import { OcppProvisioningService } from './authentication/ocpp-provisioning.service';
import { OcppProvisioningController } from './authentication/ocpp-provisioning.controller';
import { ConnectionRegistryService } from './connection-registry/connection-registry.service';
import { ConnectivityCoordinator } from './connectivity/connectivity-coordinator.service';
import { PendingCallRegistryService } from './outbound/pending-call-registry.service';
import { RemoteCommandService } from './remote-commands/remote-command.service';
import {
  DEFAULT_REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
  REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
  RemoteCommandConfirmationService,
} from './remote-commands/remote-command-confirmation.service';
import { RemoteCommandsController } from './remote-commands/remote-commands.controller';
import { Ocpp16Adapter } from './protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from './protocol/ocpp201/ocpp201-adapter';
import { OcppProtocolEventService } from './persistence/ocpp-protocol-event.service';
import { BootNotificationHandler } from './handlers/boot-notification.handler';
import { HeartbeatHandler } from './handlers/heartbeat.handler';
import { StatusNotificationHandler } from './handlers/status-notification.handler';
import { AuthorizationHandler } from './handlers/authorization.handler';
import { TransactionStartHandler } from './handlers/transaction-start.handler';
import { TransactionUpdateHandler } from './handlers/transaction-update.handler';
import { TransactionEndHandler } from './handlers/transaction-end.handler';
import { OcppMessageRouterService } from './routing/ocpp-message-router.service';
import { OcppWebSocketServer } from './transport/ocpp-websocket.server';

/**
 * The OCPP engine, as one module inside apps/movos-api (CAP-003
 * Architecture Decisions Decision 4). See
 * docs/engineering/OCPP_ENGINE_GUIDE.md for the module map this class list
 * mirrors, and docs/domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md for the
 * contracts these providers implement.
 */
@Module({
  imports: [SessionsModule, AuthorizationModule],
  controllers: [OcppProvisioningController, RemoteCommandsController],
  providers: [
    OrgContextGuard,
    RolesGuard,
    OcppAuthenticationService,
    OcppProvisioningService,
    ConnectivityCoordinator,
    ConnectionRegistryService,
    PendingCallRegistryService,
    RemoteCommandService,
    RemoteCommandConfirmationService,
    // WO-ARGOS-064 §9 — "keep it configurable/testable." Real production
    // wiring gets the real 5-minute default unless explicitly overridden
    // via env var; e2e tests set REMOTE_COMMAND_CONFIRMATION_WINDOW_MS to a
    // short value before booting the app to exercise the UNCONFIRMED-after-
    // window path deterministically, without waiting out the real window.
    {
      provide: REMOTE_COMMAND_CONFIRMATION_WINDOW_MS,
      useFactory: () => {
        const raw = process.env.REMOTE_COMMAND_CONFIRMATION_WINDOW_MS;
        const parsed = raw ? Number(raw) : NaN;
        return Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_REMOTE_COMMAND_CONFIRMATION_WINDOW_MS;
      },
    },
    Ocpp16Adapter,
    Ocpp201Adapter,
    OcppProtocolEventService,
    BootNotificationHandler,
    HeartbeatHandler,
    StatusNotificationHandler,
    AuthorizationHandler,
    TransactionStartHandler,
    TransactionUpdateHandler,
    TransactionEndHandler,
    OcppMessageRouterService,
    OcppWebSocketServer,
  ],
  exports: [
    OcppWebSocketServer,
    ConnectionRegistryService,
    RemoteCommandService,
  ],
})
export class OcppModule {}
