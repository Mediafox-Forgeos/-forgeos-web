/**
 * Protocol-agnostic contracts every OCPP adapter implements and every
 * domain handler consumes. Nothing outside apps/movos-api/src/ocpp/protocol
 * may construct or depend on a raw OCPP 1.6J or 2.0.1 DTO — this file (and
 * its version-specific siblings in ./ocpp16, ./ocpp201) is the only seam.
 *
 * Mirrors docs/domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md exactly. If this
 * file and that document diverge, this file is authoritative and the
 * document should be updated to match.
 */

export type OcppProtocolVersion = 'OCPP1_6J' | 'OCPP2_0_1';

export interface MeterSample {
  measurand: string;
  value: number;
  unit?: string;
}

/** Discriminated union — domain handlers switch on `type`, never on a
 * protocol-specific action name. Only DeviceBoot/Heartbeat/ConnectorStatus
 * are implemented by CAP-003; the rest are reserved shapes. */
export type NormalizedInboundEvent =
  | {
      type: 'DeviceBoot';
      stationIdentity: string;
      vendor?: string;
      model?: string;
      firmwareVersion?: string;
      protocolVersion: OcppProtocolVersion;
    }
  | { type: 'Heartbeat'; stationIdentity: string }
  | {
      type: 'ConnectorStatus';
      stationIdentity: string;
      evseExternalId?: string;
      connectorExternalId?: string;
      status: NormalizedDeviceStatus;
      errorCode?: string;
      timestamp: string;
    }
  | {
      type: 'MeterReading';
      stationIdentity: string;
      connectorExternalId: string;
      transactionRef?: string;
      values: MeterSample[];
    }
  | {
      type: 'TransactionStart';
      stationIdentity: string;
      connectorExternalId: string;
      idTag: string;
      meterStart: number;
      timestamp: string;
      // Added by CAP-004 (WO-ARGOS-009) — ChargingSession.protocolVersion
      // needs it and TransactionStartHandler has no other way to learn
      // which adapter produced this event, mirroring DeviceBoot's existing
      // protocolVersion field.
      protocolVersion: OcppProtocolVersion;
    }
  | {
      type: 'TransactionUpdate';
      stationIdentity: string;
      transactionRef: string;
      values: MeterSample[];
      // Added by CAP-004 (WO-ARGOS-009) — represents the first
      // meterValue[].timestamp in the batch (1.6J's MeterValues.req can
      // carry multiple readings per message; MeterValue rows are recorded
      // one per handler call, not one per underlying sample).
      timestamp: string;
    }
  | {
      type: 'TransactionEnd';
      stationIdentity: string;
      transactionRef: string;
      meterStop: number;
      reason?: string;
      timestamp: string;
    }
  | { type: 'Authorization'; stationIdentity: string; idTag: string }
  | { type: 'FirmwareStatus'; stationIdentity: string; status: string }
  | { type: 'DiagnosticsStatus'; stationIdentity: string; status: string };

/** Normalized device-reported status vocabulary — mapped onto EvseStatus/
 * ConnectorStatus by the normalization layer, never used as a Prisma enum
 * value directly (protocol vocabularies and domain vocabularies are kept
 * distinct on purpose, see docs/domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md
 * Decision 5). */
export type NormalizedDeviceStatus =
  | 'AVAILABLE'
  | 'PREPARING'
  | 'CHARGING'
  | 'SUSPENDED_EV'
  | 'SUSPENDED_EVSE'
  | 'FINISHING'
  | 'RESERVED'
  | 'UNAVAILABLE'
  | 'FAULTED'
  | 'OFFLINE';

/** Not implemented by CAP-003 — reserved shapes so future commands
 * (Architecture Backlog #36-39) have a contract to build against. */
export type NormalizedOutboundCommand =
  | {
      type: 'RemoteStart';
      stationIdentity: string;
      connectorExternalId: string;
      idTag: string;
    }
  | { type: 'RemoteStop'; stationIdentity: string; transactionRef: string }
  | { type: 'Reset'; stationIdentity: string; mode: 'Soft' | 'Hard' }
  | {
      type: 'UnlockConnector';
      stationIdentity: string;
      connectorExternalId: string;
    }
  | {
      type: 'ChangeAvailability';
      stationIdentity: string;
      connectorExternalId?: string;
      availability: 'Operative' | 'Inoperative';
    };

export interface UnsupportedMessage {
  readonly kind: 'UnsupportedMessage';
  action: string;
  reason: 'not_implemented' | 'unrecognized';
}

export interface MalformedFrame {
  readonly kind: 'MalformedFrame';
  description: string;
}

export interface DomainResult {
  status: 'Accepted' | 'Rejected';
  payload?: Record<string, unknown>;
}

export interface ProtocolError {
  code: string;
  description: string;
  category: 'malformed' | 'unsupported' | 'protocol_violation' | 'internal';
}

/** A raw wire-format frame, already JSON-parsed but not yet interpreted —
 * `ocpp` is the standard [messageTypeId, messageId, ...] array shape both
 * 1.6J and 2.0.1 share at the transport level. */
export interface RawFrame {
  raw: unknown;
}

export interface ProtocolCapabilities {
  readonly supportedInbound: ReadonlySet<NormalizedInboundEvent['type']>;
  readonly supportedOutbound: ReadonlySet<NormalizedOutboundCommand['type']>;
}

/** Connection-level context a frame arrives with — the station's identity
 * is a property of the connection (resolved at authentication time), never
 * carried inside an OCPP payload itself, so it's threaded in separately
 * rather than parsed out of the frame. */
export interface ParseContext {
  stationIdentity: string;
}

/** One adapter per wire version. Stateless — translates in both
 * directions, never holds connection state itself (that's the connection
 * registry's job). */
export interface ProtocolAdapter {
  readonly version: OcppProtocolVersion;

  parseInbound(
    frame: RawFrame,
    context: ParseContext,
  ): NormalizedInboundEvent | UnsupportedMessage | MalformedFrame;

  /** The wire action name for a CALL frame (e.g. 'RemoteStartTransaction')
   * — kept in the protocol layer, never guessed/mapped by a caller, per
   * this file's "only seam" rule. Throws CapabilityNotSupportedError for
   * any command type this adapter doesn't implement. */
  outboundActionName(commandType: NormalizedOutboundCommand['type']): string;

  /** Throws CapabilityNotSupportedError if `command.type` isn't in
   * `capabilities.supportedOutbound` — callers must check capabilities
   * first; this is a defensive backstop, not the primary control. Returns
   * only the CALL's payload object (as RawFrame.raw) — NOT the full
   * [2, messageId, action, payload] envelope, since formatOutbound doesn't
   * receive a messageId (the caller generates and tracks that via
   * PendingCallRegistryService); the caller wraps this payload with
   * formatCall(messageId, outboundActionName(...), payload.raw) to build
   * the actual frame to send. Implemented for RemoteStart/RemoteStop only,
   * by Ocpp16Adapter (WO-ARGOS-059, Architecture Backlog #36-37) — every
   * other command and the whole of Ocpp201Adapter still throw. */
  formatOutbound(command: NormalizedOutboundCommand): RawFrame;

  /** The decode side of formatOutbound — interprets a CALLRESULT payload
   * for the outbound command that produced it. Kept in the protocol layer
   * rather than left to the caller to interpret raw OCPP vocabulary
   * directly, per this file's own "only seam" rule. Throws
   * CapabilityNotSupportedError for any command type this adapter doesn't
   * implement, same discipline as formatOutbound. */
  parseOutboundResult(
    command: NormalizedOutboundCommand,
    payload: Record<string, unknown>,
  ): { accepted: boolean };

  /** `messageId` is the original CALL's OCPP-J message id, extracted by the
   * router when it parsed the inbound frame — threaded through explicitly
   * rather than carried on NormalizedInboundEvent, since it's wire-protocol
   * metadata, not domain data. */
  formatResponse(
    event: NormalizedInboundEvent,
    result: DomainResult,
    messageId: string,
  ): RawFrame;

  formatErrorResponse(messageId: string, error: ProtocolError): RawFrame;

  readonly capabilities: ProtocolCapabilities;
}
