# OCPP 2.0.1 Architecture Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/protocol/ocpp201/ocpp201-adapter.ts`
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), ADR-0008

## What exists

Per ARGOS's explicit ruling on CAP-003 Decision 3 (2.0.1 must not be treated as an undefined future idea), the **boundary** is real and registered:

- **Protocol detection works.** A device connecting with `Sec-WebSocket-Protocol: ocpp2.0.1` is correctly identified and routed to `Ocpp201Adapter` (see `protocol-detector.ts` and its tests).
- **The adapter is registered** in `OcppModule` and reachable through the same `ProtocolAdapter` interface as the 1.6J adapter — no special-casing anywhere in the transport or routing layers.
- **Every message explicitly fails.** `capabilities.supportedInbound` and `capabilities.supportedOutbound` are both empty sets. `parseInbound()` resolves every CALL to `UnsupportedMessage`; `formatResponse()` always returns a `CALLERROR` with code `NotImplemented`. **This is never a silent accept** — verified by `ocpp201-adapter.spec.ts`, which asserts a `CALLERROR` (messageTypeId `4`), never a `CALLRESULT` (messageTypeId `3`), for any input.

## What does not exist

No 2.0.1 message is functionally implemented: not `BootNotification`, not `Heartbeat`, not `StatusNotificationRequest`, none of the transaction-event model, none of the security-profile-3 (mutual TLS) authentication path. A device speaking only 2.0.1 can connect (the handshake succeeds if credentials are valid) but cannot do anything useful — every subsequent message it sends will be rejected with `NotImplemented`.

## Why the boundary exists without the implementation

Two reasons, both from [CAP-003 Architecture Decisions — Decision 3](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope):

1. **Hardware is unconfirmed.** No repository evidence exists about which protocol version(s) Kylum's actual pilot fleet speaks — see the [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md). Implementing 2.0.1 messages before that's answered risks building against the wrong protocol version.
2. **The boundary must exist first anyway.** Per [Protocol Adapter Boundary (ADR-0009)](../adr/ADR-0009-ocpp-transport-boundary.md), a second protocol implementation should never require re-architecting the transport/routing layers. Registering the 2.0.1 boundary now, even empty, proves that promise holds — a future engineer implementing real 2.0.1 support fills in `Ocpp201Adapter`'s internals; they do not touch `OcppMessageRouterService`, `ConnectionRegistryService`, or any HTTP/WebSocket transport code.

## What a future 2.0.1 implementation needs to do

Replace the empty `capabilities` sets and the always-`UnsupportedMessage` `parseInbound()` with real parsing for whichever 2.0.1 messages are prioritized, mapping them onto the **same** `NormalizedInboundEvent`/`NormalizedOutboundCommand` vocabulary the 1.6J adapter already uses (see [OCPP Protocol Coexistence — backward-compatibility rules](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md#backward-compatibility-rules)). A 2.0.1-specific concept with no 1.6J equivalent (e.g. its more granular EVSE-level addressing within one connection) extends the normalized vocabulary with a new type — it does not invent a parallel one.

## Testing

`src/ocpp/protocol/ocpp201/ocpp201-adapter.spec.ts` and `src/ocpp/protocol/common/protocol-detector.spec.ts` cover: protocol detection distinguishes 1.6J from 2.0.1, the 2.0.1 adapter declares zero capabilities, every action resolves to an explicit `CALLERROR`, and structurally malformed frames are still reported as `MalformedFrame` rather than a generic unsupported response.
