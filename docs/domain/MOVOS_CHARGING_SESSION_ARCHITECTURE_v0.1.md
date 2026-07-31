# MOVOS ChargingSession Architecture v0.1

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Approves:** CAP-003 Architecture Decisions — Decision 7, ADR-0012 (both ACCEPTED)
**Companion documents:** [MOVOS Charging Ecosystem Architecture — §4 Charging Operations](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#4-charging-operations), [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md), [OCPP Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (#16, #17)

**No Prisma model is created by this document.** This defines the concept in enough depth that a future implementation mission builds it once, correctly, rather than reinventing it under time pressure.

---

## Identity

`ChargingSession.id` — a MOVOS-internal cuid, same convention as every other entity in this schema. Never derived from, or equal to, any protocol-level identifier.

## Protocol transaction identity

A separate field (working name `protocolTransactionId`) stores the OCPP transaction identifier as a mutable, protocol-scoped attribute — mirroring the `externalId` pattern already established on `Evse`/`Connector`. **A `ChargingSession` is not an OCPP transaction.** They are related, commonly 1:1, but not definitionally identical — see "Reconnect behavior" below for the one case where they diverge.

## Ownership / relation to the domain hierarchy

```
Organization
└── Site
    └── ChargingStation
        └── EVSE
            └── Connector
                └── ChargingSession
```

A `ChargingSession` references its `Connector` directly (the most specific real attachment point — a session happens at one connector) and derives the rest of the chain (`Evse → ChargingStation → Site → Organization`) exactly as CAP-002 already does for `Evse`/`Connector` — no redundant `organizationId`/`siteId`/`chargingStationId`/`evseId` stored on the session itself. Every access check walks the full chain in one query, matching the established pattern.

## Session lifecycle

```
                 ┌─────────────┐
  authorize ───▶ │   PENDING   │  (optional — see "Start triggers")
                 └──────┬──────┘
                        │ device confirms start / meterStart received
                        ▼
                 ┌─────────────┐
                 │   ACTIVE    │ ◀──── reconnect, same transaction (see below)
                 └──────┬──────┘
             ┌──────────┼──────────────┐
     normal stop   device/connection   station reboot mid-session
             │      lost mid-session          │
             ▼               │                ▼
      ┌─────────────┐        │         ┌──────────────┐
      │ COMPLETED   │        └────────▶│   ABORTED    │
      └─────────────┘                  └──────────────┘
```

A dedicated status enum, distinct from `Evse`/`Connector` operational status (consistent with this schema's one-enum-per-entity convention): `PENDING` (optional — see below) / `ACTIVE` / `COMPLETED` / `ABORTED`.

## Authorization relationship

A `ChargingSession` references an `AuthorizationDecision` (see [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md)) as its authorization basis. **Per ARGOS's approval, this reference is optional in the first implementation** — a session can exist without a fully-resolved authorization chain behind it, since RFID/App/QR/etc. are not implemented yet. When they are, this becomes the natural join point; it is not retrofitted as a breaking change, since the field already exists as nullable/optional from the start.

## Start and stop triggers

A session may be triggered by:

- A device-initiated `StartTransaction` (1.6J) / transaction-event (2.0.1) — the device itself reports a physical connection + authorization event.
- A MOVOS-initiated `RemoteStart` command (Architecture Backlog #36), once implemented — MOVOS tells the device to begin, and the device's subsequent transaction-start message confirms it.

Both converge on the same lifecycle above; the trigger is metadata (which one happened), not a different state machine.

## Reconnect behavior

**This is the one place ARGOS's approval materially refined the original architecture recommendation** (see [CAP-003 Architecture Decisions — Decision 7, ARGOS Approval Record](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#argos-approval-record-2026-07-30-wo-argos-007)):

> A `ChargingSession` **may survive a WebSocket reconnection** specifically when the device continues the same underlying protocol transaction. Session continuity is tied to **transaction continuity**, not connection continuity.

Concretely: if a station's WebSocket connection drops and reconnects, and the device's subsequent messages reference the _same_ `protocolTransactionId` that was active before the drop, the existing `ChargingSession` (still `ACTIVE`) continues — no new session is created, no premature `COMPLETED`/`ABORTED` transition happens purely because the socket dropped. If the device starts a _new_ transaction after reconnecting (a different `protocolTransactionId`, or no transaction reference at all), that is unambiguously a new session.

This requires the connection registry (Transport module, Decision 4/6) to be decoupled from session lifecycle — a dropped connection is a transport-layer event; whether it ends a session is a domain-layer decision made by inspecting transaction continuity, not the connection event itself.

## Meter-start and meter-stop semantics

`meterStartKwh` (captured from the transaction-start event) and `meterStopKwh` (captured from the transaction-end event) — the terminal energy value is `meterStopKwh - meterStartKwh`. Both are raw device-reported cumulative meter readings, not MOVOS-computed deltas, consistent with how OCPP itself reports them.

## Intermediate meter values

Periodic readings during an active session (OCPP `MeterValues`) are **not** part of the mandatory `ChargingSession` shape — they belong to the Telemetry concern (Architecture Backlog #41/#42), referenced via `protocolTransactionId` but stored separately (if/when a dedicated telemetry strategy is built, per CAP-003 Decision 5's explicit deferral). A `ChargingSession` needs only its terminal values to be useful as a business record.

## Abnormal termination

Represented via `status = ABORTED` plus an optional `terminationReason` field, reusing OCPP's own stop-reason vocabulary directly (`EVDisconnected`, `PowerLoss`, `EmergencyStop`, `HardReset`, `SoftReset`, `Other`, etc.) rather than inventing a parallel MOVOS vocabulary — the same "don't invent a new vocabulary where the protocol already has one that maps cleanly" principle used throughout the [Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md) design.

## Station reboot behavior

A `BootNotification` arriving for a station that has an `ACTIVE` session open (from before the reboot) is a signal, not an automatic session-ending event. The correct behavior depends on whether the reboot also lost the transaction context (device-side) — if the subsequent status/transaction messages after boot reference the same `protocolTransactionId`, treat it like any other reconnect (see above); if not, the session should transition to `ABORTED` with `terminationReason` reflecting the reboot. This mirrors the transaction-continuity rule rather than introducing a separate reboot-specific rule.

## Offline operation

A session that starts while a station is genuinely offline (no MOVOS connection at all, operating purely on Local Authorization List — see [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md)) has no live `ChargingSession` row until connectivity resumes and the device reports the transaction retroactively. The eventual `ChargingSession` record's `startedAt` should reflect the device-reported start time, not the time MOVOS learned about it — the record describes what happened physically, not what MOVOS observed.

## Duplicate-message handling / idempotency

OCPP devices may retransmit a message if they don't receive a timely response (network jitter, MOVOS-side processing delay). Every inbound normalized event that would mutate a `ChargingSession` must be idempotent on `(stationIdentity, protocolTransactionId, eventType)` — a retransmitted `TransactionStart` for a transaction MOVOS already has a `PENDING`/`ACTIVE` session for must not create a duplicate session; it should be treated as a no-op (or, at most, an updated-timestamp touch), not an error and not a second row.

## Tariff / billing / payment / reservation relationships

All explicitly out of scope for CAP-003 and this document, per [CAP-003 Architecture Decisions — Decision 7](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary)'s own mandatory-vs-deferred split (restated below). A `ChargingSession` is designed to be a clean reference target for these later capabilities ([Commercial](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#6-commercial), Architecture Backlog #18/#24–27) — it does not grow pricing/invoice/payment fields itself.

## Driver, fleet, and vehicle relationships

Referenced only indirectly, through the (optional) `AuthorizationDecision` → `AuthorizationCredential` → `ownerRef` chain (see [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md)). `ChargingSession` itself does not carry a direct `driverId`/`fleetId`/`vehicleId` — none of those entities exist yet (Architecture Backlog #46–48), and forcing the reference now would either be nullable dead weight or a premature commitment to a shape those future entities haven't earned yet.

## OCPP 1.6J transaction mapping

| 1.6J concept                                                   | `ChargingSession` field                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `StartTransaction.transactionId` (server-assigned in response) | `protocolTransactionId`                                       |
| `StartTransaction.meterStart`                                  | `meterStartKwh`                                               |
| `StartTransaction.idTag`                                       | resolved to `AuthorizationDecision`/`AuthorizationCredential` |
| `StopTransaction.meterStop`                                    | `meterStopKwh`                                                |
| `StopTransaction.reason`                                       | `terminationReason` (only set when non-normal)                |

## OCPP 2.0.1 transaction-event mapping

2.0.1 replaces the discrete Start/Stop messages with a unified `TransactionEventRequest` (`eventType: Started | Updated | Ended`) carrying a `transactionInfo.transactionId`. The mapping is conceptually the same (`transactionId` → `protocolTransactionId`, `Started`/`Ended` payload fields → `meterStartKwh`/`meterStopKwh`), but the OCPP 2.0.1 adapter (not implemented by this work order — see [Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md)) is responsible for normalizing 2.0.1's richer event stream into the same `TransactionStart`/`TransactionUpdate`/`TransactionEnd` normalized events 1.6J produces, so the domain handler code is identical regardless of which protocol version originated the session.

---

## What's approved now vs. required for CAP-003 vs. deferred

**Architecture approved now (this document):** the full conceptual shape above — identity, ownership, lifecycle, reconnect-spanning rule, meter semantics, abnormal termination, idempotency requirement, and protocol mapping for both versions.

**Implementation required for the first vertical slice CAP-003 actually ships:** none. This work order's vertical (BootNotification/Heartbeat/StatusNotification) never creates, reads, or references a `ChargingSession` — there is no transaction handling in this slice at all.

**Implementation deferred to a later capability:** the `ChargingSession` Prisma model itself, `Authorize`/`StartTransaction`/`StopTransaction`/`TransactionEvent` message handling, idempotency enforcement, reconnect-spanning logic, and any UI surface. This is very likely the next capability after CAP-003's boot vertical (see Architecture Backlog #16), but is not started by this work order.

**Explicitly not designed here (belongs to later Commercial capabilities):** cost/pricing calculation, currency, invoice linkage, payment reference, refund handling.
