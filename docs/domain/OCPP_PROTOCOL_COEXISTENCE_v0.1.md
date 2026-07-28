# OCPP Protocol Coexistence v0.1

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Approves:** CAP-003 Architecture Decisions — Decision 3 (expanded scope), ADR-0008
**Companion documents:** [MOVOS Charging Ecosystem Architecture — §2 Protocol Layer](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#2-protocol-layer), [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md), [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md)

This document defines how MOVOS supports multiple OCPP versions without any of them leaking into the domain. It is a contract design, not an implementation — the interfaces sketched below are illustrative of the shape the CAP-003 implementation follows, not a literal source dump. Where this document and the actual code in `apps/movos-api/src/ocpp/` diverge in a future mission, the code is authoritative and this document should be updated, not the reverse.

**The rule that governs everything below:** the domain must not directly depend on OCPP 1.6J classes or DTOs. The domain must not directly depend on OCPP 2.0.1 classes or DTOs. Every domain handler receives a `NormalizedProtocolEvent` and nothing else.

---

## The flow

**Inbound:**

```
WebSocket Frame
  → Protocol Detector        (which adapter owns this connection?)
  → Version Adapter          (1.6J / 2.0.1 / simulator — parses the raw frame)
  → Normalized Protocol Event (protocol-agnostic, typed)
  → Domain Handler            (never sees the raw frame or protocol DTO)
  → Domain State / Business Event
```

**Outbound:**

```
MOVOS Command
  → Capability Check          (does this station/adapter support this command?)
  → Protocol Adapter          (formats the command for the connection's protocol version)
  → OCPP-specific CALL
  → Device
```

---

## Protocol adapter interface

One adapter per wire version. Each adapter is stateless — it translates in both directions and does not itself hold connection state (that's the connection registry's job, a separate concern in the Transport module).

```ts
interface ProtocolAdapter {
  readonly version: OcppProtocolVersion;

  /** Parses a raw inbound WebSocket frame into a normalized event, or an
   *  explicit UnsupportedMessage if the action isn't handled by this
   *  adapter. Never throws on a merely-unrecognized action — that's a
   *  normal, expected outcome this design accounts for explicitly. */
  parseInbound(frame: RawFrame): NormalizedInboundEvent | UnsupportedMessage;

  /** Formats a normalized outbound command into this protocol's wire
   *  format. Throws CapabilityNotSupportedError if the adapter's
   *  capabilities (see below) don't include this command — callers must
   *  check capabilities first; this is a defensive backstop, not the
   *  primary control. */
  formatOutbound(command: NormalizedOutboundCommand): RawFrame;

  /** Formats a CALLRESULT/CALLERROR response to an inbound message this
   *  adapter parsed. */
  formatResponse(event: NormalizedInboundEvent, result: DomainResult): RawFrame;

  /** What this adapter can do — used for capability discovery (below),
   *  never hardcoded as a per-vendor conditional in a domain handler. */
  readonly capabilities: ProtocolCapabilities;
}

type OcppProtocolVersion = 'OCPP1_6J' | 'OCPP2_0_1';
```

## Normalized inbound event model

A discriminated union — domain handlers switch on `type`, never on a protocol-specific action name.

```ts
type NormalizedInboundEvent =
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
    }
  | {
      type: 'TransactionUpdate';
      stationIdentity: string;
      transactionRef: string;
      values: MeterSample[];
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
```

Only `DeviceBoot`, `Heartbeat`, and `ConnectorStatus` are implemented by CAP-003 (this work order). The rest are reserved shapes — defined now so the vocabulary doesn't need inventing twice, not implemented until the capability they belong to (`ChargingSession`, Meter Values, Authorization — see the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md)) is actually built.

## Normalized outbound command model

```ts
type NormalizedOutboundCommand =
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
    }
  | {
      type: 'FirmwareUpdate';
      stationIdentity: string;
      downloadUrl: string;
      retrieveAt?: string;
    }
  | { type: 'DiagnosticsRequest'; stationIdentity: string; uploadUrl: string }
  | {
      type: 'Reservation';
      stationIdentity: string;
      connectorExternalId: string;
      idTag: string;
      expiresAt: string;
    }
  | {
      type: 'ChargingProfile';
      stationIdentity: string;
      connectorExternalId?: string;
      profile: unknown;
    };
```

None of these are implemented by CAP-003. The shapes are reserved so Remote Start/Stop, Reset, and Unlock Connector — named explicitly as future capabilities in the Architecture Backlog — have a contract to implement against rather than being designed twice.

## Version-agnostic vocabulary (required minimum, per this work order)

| Concept                  | `NormalizedInboundEvent`/`NormalizedOutboundCommand` type | CAP-003 status                                                  |
| ------------------------ | --------------------------------------------------------- | --------------------------------------------------------------- |
| Device boot              | `DeviceBoot`                                              | Implemented                                                     |
| Heartbeat                | `Heartbeat`                                               | Implemented                                                     |
| Connector or EVSE status | `ConnectorStatus`                                         | Implemented                                                     |
| Meter readings           | `MeterReading`                                            | Defined, not implemented (evaluated for raw-event capture only) |
| Transaction start        | `TransactionStart`                                        | Defined, not implemented                                        |
| Transaction update       | `TransactionUpdate`                                       | Defined, not implemented                                        |
| Transaction end          | `TransactionEnd`                                          | Defined, not implemented                                        |
| Authorization            | `Authorization`                                           | Defined, not implemented                                        |
| Remote start             | `RemoteStart`                                             | Defined, not implemented                                        |
| Remote stop              | `RemoteStop`                                              | Defined, not implemented                                        |
| Reset                    | `Reset`                                                   | Defined, not implemented                                        |
| Unlock                   | `UnlockConnector`                                         | Defined, not implemented                                        |
| Firmware                 | `FirmwareStatus` / `FirmwareUpdate`                       | Defined, not implemented                                        |
| Diagnostics              | `DiagnosticsStatus` / `DiagnosticsRequest`                | Defined, not implemented                                        |
| Reservation              | `Reservation`                                             | Defined, not implemented                                        |
| Charging profile         | `ChargingProfile`                                         | Defined, not implemented                                        |

## Protocol-specific message parser / response formatter

Each adapter owns its own parser and formatter internally (`ocpp/protocol/ocpp16/` and `ocpp/protocol/ocpp201/` — see the [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md) for the actual module layout). The parser's job is narrow: turn a validated wire-format frame into a `NormalizedInboundEvent`, or return `UnsupportedMessage` for anything it doesn't recognize. It must never throw for an unrecognized-but-well-formed message — that's a normal outcome (see "Unsupported-feature handling" below), not an error condition. It **should** throw (or return a distinct `MalformedFrame` result) for a frame that fails basic structural/JSON validation — that's genuinely exceptional.

## Capability discovery

Each `ProtocolAdapter.capabilities` declares what normalized event/command types it actually implements:

```ts
interface ProtocolCapabilities {
  readonly supportedInbound: ReadonlySet<NormalizedInboundEvent['type']>;
  readonly supportedOutbound: ReadonlySet<NormalizedOutboundCommand['type']>;
}
```

The CAP-003 OCPP 1.6J adapter declares `supportedInbound: {DeviceBoot, Heartbeat, ConnectorStatus}` and `supportedOutbound: {}` (empty — no outbound commands are implemented yet). This is queried before attempting to format an outbound command (see the outbound flow above) and is also what the Architecture Backlog's per-capability "implementation status" fields are checked against in code review, so the two never drift silently apart.

## Unsupported-feature handling

Two distinct cases, handled differently:

1. **A recognized-but-unimplemented inbound action** (e.g., a real 1.6J `Authorize` message arrives, and the type exists in the normalized vocabulary but CAP-003 doesn't implement it yet): the parser returns `UnsupportedMessage { action: string, reason: 'not_implemented' }`. The engine responds with a protocol-correct `CALLERROR` (`NotImplemented`), and logs the raw frame via the raw-event log (below) — nothing is silently dropped.
2. **A genuinely unrecognized action** (not in the OCPP spec the adapter targets at all, or a vendor extension with no registered handler): same `UnsupportedMessage` path, `reason: 'unrecognized'`. Same `CALLERROR` response.

**OCPP 2.0.1 specifically:** the adapter stub implemented by CAP-003 is not a "silent accept" — every message it receives resolves to `UnsupportedMessage` and a `CALLERROR`, explicitly, because no 2.0.1 message is functionally implemented yet. This is a deliberate, tested behavior (see the CAP-003 test suite), not an oversight.

## Protocol-version negotiation

OCPP does not have a single, universal in-band version-negotiation handshake the way, say, HTTP content negotiation does — version is typically fixed per deployment/connection (via the WebSocket subprotocol header, `Sec-WebSocket-Protocol: ocpp1.6` vs. `ocpp2.0.1`, which is the mechanism CAP-003's Protocol Detector uses). The Protocol Detector inspects this header at connection time and selects the matching adapter; a connection that doesn't declare a recognized subprotocol is rejected at the transport layer before any adapter is invoked.

## Vendor-extension handling

Not implemented by CAP-003 (Architecture Backlog #4). The designed extension point: a `VendorExtensionAdapter` would sit alongside the version adapters, consulted only when the base adapter's parser returns `UnsupportedMessage` with a vendor-specific action name matching a registered extension. This keeps vendor-specific logic entirely out of the OCPP 1.6J/2.0.1 core adapters, consistent with this work order's explicit prohibition on vendor conditionals inside the protocol core.

## Mapping from protocol concepts to MOVOS domain concepts

| Protocol concept                                    | MOVOS domain concept                                    | Notes                                                                                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Charge point identity (URL path / BootNotification) | `ChargingStation.ocppIdentity`                          | Never the MOVOS internal `id`.                                                                                                                                                                             |
| OCPP 1.6J `idTag` / 2.0.1 `idToken`                 | future `AuthorizationCredential`                        | See [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).                                                                                                                              |
| OCPP `transactionId`                                | future `ChargingSession.protocolTransactionId`          | Never the MOVOS internal `ChargingSession.id`. See [ChargingSession Architecture](./MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md).                                                                          |
| Connector/EVSE status enums (per protocol)          | `EvseStatus`/`ConnectorStatus` (existing CAP-002 enums) | Mapped via the normalization layer — see the field-classification table in [CAP-003 Architecture Decisions — Decision 5](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path). |

## Error-normalization strategy

Protocol-level errors (`CALLERROR` payloads, malformed frames, unsupported actions) are normalized into a single internal `ProtocolError` shape (`{ code, description, category: 'malformed' | 'unsupported' | 'protocol_violation' | 'internal' }`) before any logging or domain-facing reporting — so a debugging engineer never needs to know whether a given failure came from a 1.6J or 2.0.1 connection to reason about it.

## Raw-event preservation

Every inbound and outbound frame — regardless of whether it was successfully normalized, returned `UnsupportedMessage`, or failed to parse at all — is written to the append-only OCPP protocol-event log (CAP-003 Decision 5; see the [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md) for the persisted shape and retention policy). This is what makes "unsupported-feature handling" auditable rather than a silent black hole.

## Backward-compatibility rules

1. A normalized event/command type, once shipped, is never removed — only deprecated with a documented migration note, since domain handlers and (eventually) tests depend on its exact shape.
2. Adding a new optional field to an existing normalized type is backward-compatible; changing or removing an existing field is not, and requires a version bump to this document plus a review of every consumer.
3. A new protocol version's adapter must map onto the _existing_ normalized vocabulary wherever the concepts genuinely correspond (e.g., 2.0.1's `StatusNotificationRequest` maps onto the same `ConnectorStatus` type 1.6J uses) — a new adapter is not license to invent a parallel vocabulary.
4. Where a new protocol version introduces a genuinely new concept with no 1.6J equivalent (e.g., 2.0.1's more granular EVSE-level addressing within one connection), extend the normalized vocabulary with a new type rather than overloading an existing one.
