import { Module } from '@nestjs/common';

import { OrgContextGuard } from '../guards/org-context.guard';
import { RolesGuard } from '../guards/roles.guard';

import { OcppAuthenticationService } from './authentication/ocpp-authentication.service';
import { OcppProvisioningService } from './authentication/ocpp-provisioning.service';
import { OcppProvisioningController } from './authentication/ocpp-provisioning.controller';
import { ConnectionRegistryService } from './connection-registry/connection-registry.service';
import { Ocpp16Adapter } from './protocol/ocpp16/ocpp16-adapter';
import { Ocpp201Adapter } from './protocol/ocpp201/ocpp201-adapter';
import { OcppProtocolEventService } from './persistence/ocpp-protocol-event.service';
import { BootNotificationHandler } from './handlers/boot-notification.handler';
import { HeartbeatHandler } from './handlers/heartbeat.handler';
import { StatusNotificationHandler } from './handlers/status-notification.handler';
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
  controllers: [OcppProvisioningController],
  providers: [
    OrgContextGuard,
    RolesGuard,
    OcppAuthenticationService,
    OcppProvisioningService,
    ConnectionRegistryService,
    Ocpp16Adapter,
    Ocpp201Adapter,
    OcppProtocolEventService,
    BootNotificationHandler,
    HeartbeatHandler,
    StatusNotificationHandler,
    OcppMessageRouterService,
    OcppWebSocketServer,
  ],
  exports: [OcppWebSocketServer, ConnectionRegistryService],
})
export class OcppModule {}
