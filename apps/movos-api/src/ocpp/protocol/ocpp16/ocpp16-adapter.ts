import { Injectable } from '@nestjs/common';

import {
  formatCallError,
  formatCallResult,
  parseOcppJFrame,
} from '../common/ocpp-frame';
import { CapabilityNotSupportedError } from '../common/errors';
import type {
  DomainResult,
  MalformedFrame,
  NormalizedDeviceStatus,
  NormalizedInboundEvent,
  NormalizedOutboundCommand,
  ParseContext,
  ProtocolAdapter,
  ProtocolCapabilities,
  ProtocolError,
  RawFrame,
  UnsupportedMessage,
} from '../common/normalized-events';

/**
 * OCPP 1.6J concrete adapter — implements BootNotification, Heartbeat, and
 * StatusNotification only, per CAP-003's first vertical slice. Every other
 * 1.6J action (Authorize, StartTransaction, StopTransaction, MeterValues,
 * remote-command CALLs, etc.) resolves to UnsupportedMessage — see
 * docs/architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md for where each one
 * is tracked.
 */
@Injectable()
export class Ocpp16Adapter implements ProtocolAdapter {
  readonly version = 'OCPP1_6J' as const;

  readonly capabilities: ProtocolCapabilities = {
    supportedInbound: new Set(['DeviceBoot', 'Heartbeat', 'ConnectorStatus']),
    supportedOutbound: new Set(),
  };

  parseInbound(
    frame: RawFrame,
    context: ParseContext,
  ): NormalizedInboundEvent | UnsupportedMessage | MalformedFrame {
    const message = parseOcppJFrame(frame);

    if (message.kind === 'MalformedFrame') {
      return message;
    }

    // CALLRESULT/CALLERROR are responses to outbound commands this adapter
    // never sends (empty supportedOutbound) — nothing to correlate them to.
    if (message.kind !== 'CALL') {
      return {
        kind: 'UnsupportedMessage',
        action: message.kind,
        reason: 'unrecognized',
      };
    }

    switch (message.action) {
      case 'BootNotification':
        return this.parseBootNotification(message.payload, context);
      case 'Heartbeat':
        return { type: 'Heartbeat', stationIdentity: context.stationIdentity };
      case 'StatusNotification':
        return this.parseStatusNotification(message.payload, context);
      default:
        return {
          kind: 'UnsupportedMessage',
          action: message.action,
          reason: 'not_implemented',
        };
    }
  }

  formatOutbound(command: NormalizedOutboundCommand): RawFrame {
    throw new CapabilityNotSupportedError(command.type, this.version);
  }

  formatResponse(
    event: NormalizedInboundEvent,
    result: DomainResult,
    messageId: string,
  ): RawFrame {
    if (result.status !== 'Accepted') {
      return formatCallError(
        messageId,
        'InternalError',
        'Rejected by MOVOS',
        {},
      );
    }

    switch (event.type) {
      case 'DeviceBoot':
        return formatCallResult(messageId, {
          status: 'Accepted',
          currentTime: new Date().toISOString(),
          interval: 300,
        });
      case 'Heartbeat':
        return formatCallResult(messageId, {
          currentTime: new Date().toISOString(),
        });
      case 'ConnectorStatus':
        return formatCallResult(messageId, {});
      default:
        return formatCallResult(messageId, {});
    }
  }

  formatErrorResponse(messageId: string, error: ProtocolError): RawFrame {
    return formatCallError(
      messageId,
      protocolErrorCode(error),
      error.description,
    );
  }

  private parseBootNotification(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | MalformedFrame {
    const vendor = payload.chargePointVendor;
    const model = payload.chargePointModel;
    if (typeof vendor !== 'string' || typeof model !== 'string') {
      return {
        kind: 'MalformedFrame',
        description:
          'BootNotification requires chargePointVendor and chargePointModel',
      };
    }
    return {
      type: 'DeviceBoot',
      stationIdentity: context.stationIdentity,
      vendor,
      model,
      firmwareVersion:
        typeof payload.firmwareVersion === 'string'
          ? payload.firmwareVersion
          : undefined,
      protocolVersion: 'OCPP1_6J',
    };
  }

  private parseStatusNotification(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | MalformedFrame {
    const status = payload.status;
    if (typeof status !== 'string' || !isKnownOcpp16Status(status)) {
      return {
        kind: 'MalformedFrame',
        description: `StatusNotification has an unrecognized status value: ${String(status)}`,
      };
    }
    return {
      type: 'ConnectorStatus',
      stationIdentity: context.stationIdentity,
      // 1.6J addresses a single integer connectorId per station (0 = the
      // station itself); mapping that onto MOVOS's Evse/Connector externalId
      // pair happens in the normalization layer, not here — this adapter
      // only translates protocol vocabulary, never resolves domain records.
      connectorExternalId:
        typeof payload.connectorId === 'number'
          ? String(payload.connectorId)
          : undefined,
      status: mapOcpp16Status(status),
      errorCode:
        typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
      timestamp:
        typeof payload.timestamp === 'string'
          ? payload.timestamp
          : new Date().toISOString(),
    };
  }
}

const OCPP16_STATUSES = [
  'Available',
  'Preparing',
  'Charging',
  'SuspendedEVSE',
  'SuspendedEV',
  'Finishing',
  'Reserved',
  'Unavailable',
  'Faulted',
] as const;

function isKnownOcpp16Status(
  value: string,
): value is (typeof OCPP16_STATUSES)[number] {
  return (OCPP16_STATUSES as readonly string[]).includes(value);
}

function mapOcpp16Status(
  status: (typeof OCPP16_STATUSES)[number],
): NormalizedDeviceStatus {
  const map: Record<(typeof OCPP16_STATUSES)[number], NormalizedDeviceStatus> =
    {
      Available: 'AVAILABLE',
      Preparing: 'PREPARING',
      Charging: 'CHARGING',
      SuspendedEVSE: 'SUSPENDED_EVSE',
      SuspendedEV: 'SUSPENDED_EV',
      Finishing: 'FINISHING',
      Reserved: 'RESERVED',
      Unavailable: 'UNAVAILABLE',
      Faulted: 'FAULTED',
    };
  return map[status];
}

function protocolErrorCode(error: ProtocolError): string {
  switch (error.category) {
    case 'malformed':
      return 'FormationViolation';
    case 'unsupported':
      return 'NotImplemented';
    case 'protocol_violation':
      return 'ProtocolError';
    default:
      return 'InternalError';
  }
}
