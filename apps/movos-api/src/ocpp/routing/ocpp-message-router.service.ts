import { Injectable, Logger } from '@nestjs/common';
import {
  OcppMessageDirection,
  OcppMessageType,
  OcppProcessingStatus,
} from '@prisma/client';
import type { ChargingStation } from '@prisma/client';

import { parseOcppJFrame } from '../protocol/common/ocpp-frame';
import type {
  DomainResult,
  NormalizedInboundEvent,
  ProtocolAdapter,
  RawFrame,
} from '../protocol/common/normalized-events';
import { ConnectionRegistryService } from '../connection-registry/connection-registry.service';
import { OcppProtocolEventService } from '../persistence/ocpp-protocol-event.service';
import { BootNotificationHandler } from '../handlers/boot-notification.handler';
import { HeartbeatHandler } from '../handlers/heartbeat.handler';
import { StatusNotificationHandler } from '../handlers/status-notification.handler';
import { AuthorizationHandler } from '../handlers/authorization.handler';
import { TransactionStartHandler } from '../handlers/transaction-start.handler';
import { TransactionUpdateHandler } from '../handlers/transaction-update.handler';
import { TransactionEndHandler } from '../handlers/transaction-end.handler';

/**
 * The seam between the Protocol Layer and everything else. Domain handlers
 * only ever see a NormalizedInboundEvent, resolved and validated here — see
 * docs/domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md for the full flow diagram
 * this class implements.
 */
@Injectable()
export class OcppMessageRouterService {
  private readonly logger = new Logger(OcppMessageRouterService.name);

  constructor(
    private readonly connectionRegistry: ConnectionRegistryService,
    private readonly protocolEvents: OcppProtocolEventService,
    private readonly bootHandler: BootNotificationHandler,
    private readonly heartbeatHandler: HeartbeatHandler,
    private readonly statusHandler: StatusNotificationHandler,
    private readonly authorizationHandler: AuthorizationHandler,
    private readonly transactionStartHandler: TransactionStartHandler,
    private readonly transactionUpdateHandler: TransactionUpdateHandler,
    private readonly transactionEndHandler: TransactionEndHandler,
  ) {}

  /** Returns the RawFrame to send back to the device, or null if no
   * response should be sent (malformed envelope with no extractable
   * messageId, or an unexpected CALLRESULT/CALLERROR from a device — OCPP
   * never responds to a response). */
  async handleInboundFrame(
    adapter: ProtocolAdapter,
    station: ChargingStation,
    frame: RawFrame,
  ): Promise<RawFrame | null> {
    this.connectionRegistry.touch(station.ocppIdentity as string);

    const envelope = parseOcppJFrame(frame);

    if (envelope.kind === 'MalformedFrame') {
      await this.protocolEvents.record({
        chargingStationId: station.id,
        protocolVersion: adapter.version,
        direction: OcppMessageDirection.INBOUND,
        messageType: OcppMessageType.CALL,
        payload: frame.raw,
        processingStatus: OcppProcessingStatus.FAILED,
        processingError: envelope.description,
      });
      this.logger.warn(
        `Malformed frame from ${station.ocppIdentity}: ${envelope.description}`,
      );
      return null; // no messageId to respond with — protocol-correct to drop it
    }

    if (envelope.kind !== 'CALL') {
      // A device sending us a CALLRESULT/CALLERROR implies we sent a CALL —
      // no CAP-003 adapter has any supportedOutbound entries, so this is
      // always unexpected. Log it; OCPP never responds to a response.
      await this.protocolEvents.record({
        chargingStationId: station.id,
        protocolVersion: adapter.version,
        direction: OcppMessageDirection.INBOUND,
        messageType:
          envelope.kind === 'CALLRESULT'
            ? OcppMessageType.CALLRESULT
            : OcppMessageType.CALLERROR,
        protocolMessageId: envelope.messageId,
        payload: frame.raw,
        processingStatus: OcppProcessingStatus.UNSUPPORTED,
        correlationId: envelope.messageId,
      });
      return null;
    }

    const event = adapter.parseInbound(frame, {
      stationIdentity: station.ocppIdentity as string,
    });

    if ('kind' in event && event.kind === 'MalformedFrame') {
      await this.protocolEvents.record({
        chargingStationId: station.id,
        protocolVersion: adapter.version,
        direction: OcppMessageDirection.INBOUND,
        messageType: OcppMessageType.CALL,
        action: envelope.action,
        protocolMessageId: envelope.messageId,
        payload: frame.raw,
        processingStatus: OcppProcessingStatus.FAILED,
        processingError: event.description,
        correlationId: envelope.messageId,
      });
      return adapter.formatErrorResponse(envelope.messageId, {
        code: 'FormationViolation',
        description: event.description,
        category: 'malformed',
      });
    }

    if ('kind' in event && event.kind === 'UnsupportedMessage') {
      await this.protocolEvents.record({
        chargingStationId: station.id,
        protocolVersion: adapter.version,
        direction: OcppMessageDirection.INBOUND,
        messageType: OcppMessageType.CALL,
        action: envelope.action,
        protocolMessageId: envelope.messageId,
        payload: frame.raw,
        processingStatus: OcppProcessingStatus.UNSUPPORTED,
        correlationId: envelope.messageId,
      });
      return adapter.formatErrorResponse(envelope.messageId, {
        code: 'NotImplemented',
        description: `${event.action} is not implemented`,
        category: 'unsupported',
      });
    }

    // event is a real NormalizedInboundEvent — dispatch to the domain.
    const result = await this.routeByType(event, station);

    await this.protocolEvents.record({
      chargingStationId: station.id,
      protocolVersion: adapter.version,
      direction: OcppMessageDirection.INBOUND,
      messageType: OcppMessageType.CALL,
      action: envelope.action,
      protocolMessageId: envelope.messageId,
      payload: frame.raw,
      processingStatus:
        result.status === 'Accepted'
          ? OcppProcessingStatus.PROCESSED
          : OcppProcessingStatus.REJECTED,
      correlationId: envelope.messageId,
    });

    return adapter.formatResponse(event, result, envelope.messageId);
  }

  private async routeByType(
    event: NormalizedInboundEvent,
    station: ChargingStation,
  ): Promise<DomainResult> {
    switch (event.type) {
      case 'DeviceBoot':
        return this.bootHandler.handle(event, station);
      case 'Heartbeat':
        return this.heartbeatHandler.handle(event, station);
      case 'ConnectorStatus':
        return this.statusHandler.handle(event, station);
      case 'Authorization':
        return this.authorizationHandler.handle(event, station);
      case 'TransactionStart':
        return this.transactionStartHandler.handle(event, station);
      case 'TransactionUpdate':
        return this.transactionUpdateHandler.handle(event, station);
      case 'TransactionEnd':
        return this.transactionEndHandler.handle(event, station);
      default:
        // Unreachable for CAP-003/CAP-004's adapters (capabilities.
        // supportedInbound only ever yields the seven types handled above)
        // — kept as a defensive exhaustiveness fallback, not a real
        // runtime path for this work order's implementation.
        return { status: 'Rejected' };
    }
  }
}
