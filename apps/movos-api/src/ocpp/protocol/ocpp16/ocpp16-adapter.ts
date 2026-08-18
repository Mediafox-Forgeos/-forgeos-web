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
  MeterSample,
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
 * OCPP 1.6J concrete adapter — implements BootNotification, Heartbeat,
 * StatusNotification (CAP-003), and Authorize/StartTransaction/
 * MeterValues/StopTransaction (CAP-004, WO-ARGOS-009). Every other 1.6J
 * action (remote-command CALLs, firmware/diagnostics, etc.) still resolves
 * to UnsupportedMessage — see
 * docs/architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md for where each one
 * is tracked.
 */
@Injectable()
export class Ocpp16Adapter implements ProtocolAdapter {
  readonly version = 'OCPP1_6J' as const;

  readonly capabilities: ProtocolCapabilities = {
    supportedInbound: new Set([
      'DeviceBoot',
      'Heartbeat',
      'ConnectorStatus',
      'Authorization',
      'TransactionStart',
      'TransactionUpdate',
      'TransactionEnd',
    ]),
    // WO-ARGOS-059 — Phase A only (ARGOS's WO-058 review decision). Reset/
    // UnlockConnector/ChangeAvailability remain unimplemented; formatOutbound
    // still throws CapabilityNotSupportedError for those three.
    supportedOutbound: new Set(['RemoteStart', 'RemoteStop']),
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
      case 'Authorize':
        return this.parseAuthorize(message.payload, context);
      case 'StartTransaction':
        return this.parseStartTransaction(message.payload, context);
      case 'MeterValues':
        return this.parseMeterValues(message.payload, context);
      case 'StopTransaction':
        return this.parseStopTransaction(message.payload, context);
      default:
        return {
          kind: 'UnsupportedMessage',
          action: message.action,
          reason: 'not_implemented',
        };
    }
  }

  outboundActionName(commandType: NormalizedOutboundCommand['type']): string {
    switch (commandType) {
      case 'RemoteStart':
        return 'RemoteStartTransaction';
      case 'RemoteStop':
        return 'RemoteStopTransaction';
      default:
        throw new CapabilityNotSupportedError(commandType, this.version);
    }
  }

  /** WO-ARGOS-059 — RemoteStartTransaction.req/RemoteStopTransaction.req,
   * the only two 1.6J outbound commands implemented. connectorId/
   * transactionId travel as JSON integers per spec; MOVOS stores both as
   * strings internally (Connector.externalId, ChargingSession.
   * protocolTransactionId), converted here at the protocol boundary —
   * never earlier, matching this file's own "only seam" rule. */
  formatOutbound(command: NormalizedOutboundCommand): RawFrame {
    switch (command.type) {
      case 'RemoteStart':
        return {
          raw: {
            connectorId: Number(command.connectorExternalId),
            idTag: command.idTag,
          },
        };
      case 'RemoteStop':
        return {
          raw: { transactionId: Number(command.transactionRef) },
        };
      default:
        throw new CapabilityNotSupportedError(command.type, this.version);
    }
  }

  /** RemoteStartTransaction.conf/RemoteStopTransaction.conf share the same
   * `{status: 'Accepted'|'Rejected'}` shape in 1.6J — Accepted here means
   * only "the charger will attempt it," never that the transaction actually
   * started/stopped (WO-058 Decision: never inferred as physical outcome
   * confirmation — see RemoteCommandService). */
  parseOutboundResult(
    command: NormalizedOutboundCommand,
    payload: Record<string, unknown>,
  ): { accepted: boolean } {
    switch (command.type) {
      case 'RemoteStart':
      case 'RemoteStop':
        return { accepted: payload.status === 'Accepted' };
      default:
        throw new CapabilityNotSupportedError(command.type, this.version);
    }
  }

  formatResponse(
    event: NormalizedInboundEvent,
    result: DomainResult,
    messageId: string,
  ): RawFrame {
    // Boot/Heartbeat/Status (CAP-003): a domain rejection here means
    // something went wrong internally (e.g. an unknown connector) — a
    // protocol-level CALLERROR is the correct encoding.
    //
    // Authorization/TransactionStart/TransactionEnd (CAP-004) are
    // different: OCPP encodes "no, this idTag isn't valid" as a normal
    // CALLRESULT carrying idTagInfo.status = Invalid/Blocked/Expired, not
    // as a CALLERROR — a rejected authorization is an ordinary protocol
    // answer, not a fault. Those cases below deliberately do not go
    // through this early-return.
    if (
      result.status !== 'Accepted' &&
      (event.type === 'DeviceBoot' ||
        event.type === 'Heartbeat' ||
        event.type === 'ConnectorStatus')
    ) {
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
      case 'Authorization':
        return formatCallResult(messageId, {
          idTagInfo: { status: idTagStatusOf(result) },
        });
      case 'TransactionStart':
        return formatCallResult(messageId, {
          transactionId: protocolTransactionIdOf(result),
          idTagInfo: { status: idTagStatusOf(result) },
        });
      case 'TransactionUpdate':
        // MeterValues.conf carries no payload per the 1.6J spec, whether
        // or not the sample was ultimately usable domain-side.
        return formatCallResult(messageId, {});
      case 'TransactionEnd':
        // StopTransaction.conf's idTagInfo is optional per spec; omitted
        // here rather than re-deriving a status for a transaction that has
        // already ended.
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

  private parseAuthorize(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | MalformedFrame {
    const idTag = payload.idTag;
    if (typeof idTag !== 'string' || idTag.length === 0) {
      return {
        kind: 'MalformedFrame',
        description: 'Authorize requires a non-empty idTag',
      };
    }
    return {
      type: 'Authorization',
      stationIdentity: context.stationIdentity,
      idTag,
    };
  }

  private parseStartTransaction(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | MalformedFrame {
    const { connectorId, idTag, meterStart, timestamp } = payload;
    if (
      typeof connectorId !== 'number' ||
      typeof idTag !== 'string' ||
      idTag.length === 0 ||
      typeof meterStart !== 'number' ||
      typeof timestamp !== 'string'
    ) {
      return {
        kind: 'MalformedFrame',
        description:
          'StartTransaction requires numeric connectorId/meterStart, a non-empty idTag, and a string timestamp',
      };
    }
    return {
      type: 'TransactionStart',
      stationIdentity: context.stationIdentity,
      connectorExternalId: String(connectorId),
      idTag,
      meterStart,
      timestamp,
      protocolVersion: 'OCPP1_6J',
    };
  }

  private parseMeterValues(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | UnsupportedMessage | MalformedFrame {
    const { connectorId, transactionId, meterValue } = payload;
    if (typeof connectorId !== 'number' || !Array.isArray(meterValue)) {
      return {
        kind: 'MalformedFrame',
        description:
          'MeterValues requires a numeric connectorId and a meterValue array',
      };
    }

    // MeterValues sent with no transactionId (periodic connector telemetry
    // unrelated to any charging session) has nowhere to attach in CAP-004's
    // model — MeterValue.sessionId is required. Not a malformed message
    // (it's valid, spec-conformant OCPP), just a shape this vertical
    // doesn't implement. See CAP-004_CHARGING_SESSIONS_FOUNDATION.md §9.
    if (typeof transactionId !== 'number') {
      return {
        kind: 'UnsupportedMessage',
        action: 'MeterValues',
        reason: 'not_implemented',
      };
    }

    const values = extractMeterSamples(meterValue);
    if (values.length === 0) {
      return {
        kind: 'MalformedFrame',
        description: 'MeterValues contained no usable sampledValue entries',
      };
    }

    const firstEntry = meterValue[0] as Record<string, unknown> | undefined;
    const timestamp =
      typeof firstEntry?.timestamp === 'string'
        ? firstEntry.timestamp
        : new Date().toISOString();

    return {
      type: 'TransactionUpdate',
      stationIdentity: context.stationIdentity,
      transactionRef: String(transactionId),
      values,
      timestamp,
    };
  }

  private parseStopTransaction(
    payload: Record<string, unknown>,
    context: ParseContext,
  ): NormalizedInboundEvent | MalformedFrame {
    const { transactionId, meterStop, timestamp, reason } = payload;
    if (
      typeof transactionId !== 'number' ||
      typeof meterStop !== 'number' ||
      typeof timestamp !== 'string'
    ) {
      return {
        kind: 'MalformedFrame',
        description:
          'StopTransaction requires a numeric transactionId/meterStop and a string timestamp',
      };
    }
    return {
      type: 'TransactionEnd',
      stationIdentity: context.stationIdentity,
      transactionRef: String(transactionId),
      meterStop,
      reason: typeof reason === 'string' ? reason : undefined,
      timestamp,
    };
  }
}

/** Extracts every parseable {measurand, value, unit} sample across all
 * meterValue[].sampledValue[] entries. Per the 1.6J spec, sampledValue.value
 * is itself a string (e.g. "230"); entries that don't parse as a finite
 * number are silently dropped rather than failing the whole message — one
 * bad sample in a batch of otherwise-valid ones shouldn't reject real data.
 */
function extractMeterSamples(meterValue: unknown[]): MeterSample[] {
  const samples: MeterSample[] = [];
  for (const entry of meterValue) {
    if (typeof entry !== 'object' || entry === null) continue;
    const sampledValue = (entry as Record<string, unknown>).sampledValue;
    if (!Array.isArray(sampledValue)) continue;

    for (const sample of sampledValue) {
      if (typeof sample !== 'object' || sample === null) continue;
      const raw = sample as Record<string, unknown>;
      const value = typeof raw.value === 'string' ? Number(raw.value) : NaN;
      if (!Number.isFinite(value)) continue;

      samples.push({
        measurand:
          typeof raw.measurand === 'string'
            ? raw.measurand
            : 'Energy.Active.Import.Register',
        value,
        unit: typeof raw.unit === 'string' ? raw.unit : undefined,
      });
    }
  }
  return samples;
}

/** Reads the idTagInfo.status this response should carry from
 * DomainResult.payload — handlers set this explicitly (see
 * AuthorizationHandler/TransactionStartHandler) rather than the adapter
 * inventing a status from a bare Accepted/Rejected boolean, since OCPP's
 * idTagInfo vocabulary (Accepted/Blocked/Expired/Invalid/ConcurrentTx) is
 * richer than DomainResult's binary status. */
function idTagStatusOf(result: DomainResult): string {
  const status = result.payload?.idTagStatus;
  if (typeof status === 'string') return status;
  return result.status === 'Accepted' ? 'Accepted' : 'Invalid';
}

/** Reads the MOVOS-assigned protocolTransactionId a TransactionStart
 * handler placed on the result, and serializes it as the JSON integer
 * 1.6J's StartTransaction.conf requires. */
function protocolTransactionIdOf(result: DomainResult): number {
  const raw = result.payload?.protocolTransactionId;
  return typeof raw === 'string' ? Number(raw) : 0;
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
