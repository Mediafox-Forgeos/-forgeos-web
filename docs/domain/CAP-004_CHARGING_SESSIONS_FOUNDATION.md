# CAP-004 — Charging Sessions & Authorization Foundation

**Generated:** 2026-07-31 (WO-ARGOS-009)
**Approves/implements:** DEC-013, DEC-014, DEC-015, DEC-016 (all ACCEPTED)
**Builds on:** [CAP-003 OCPP Architecture Decisions](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md), [MOVOS ChargingSession Architecture v0.1](./MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [MOVOS Authorization Architecture v0.1](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md), [OCPP Protocol Coexistence](./OCPP_PROTOCOL_COEXISTENCE_v0.1.md)
**Does not redesign:** the OCPP transport, connection registry, device authentication, or the 1.6J/2.0.1 adapter boundary — all of CAP-003 is reused as-is.

This document is the implementation-authorizing companion to the two CAP-003-era architecture-only documents named above. Those documents deliberately created no Prisma model and designed `AuthorizationCredential`/`ChargingSession` at a conceptual level only, explicitly leaving field-level and lifecycle detail to "a future implementation mission." This is that mission. Where this document's decisions differ from the earlier ones — they do, in a few places, because ARGOS's DEC-013 through DEC-016 are more prescriptive than VULCAN's original CAP-003-era recommendations — this document is authoritative going forward, and the difference is called out explicitly rather than silently overriding the older text.

---

## 1. What this work order answers

MOVOS can now (CAP-003) identify a station, authenticate it, and observe its boot/heartbeat/connector-status. It cannot yet answer any business question about _use_:

- Who initiated the charging session?
- When did it start? When did it end?
- Which connector was used?
- How much energy was consumed?
- How was the session authorized?
- Why did the session end?

This document, and the implementation it authorizes, exists to answer exactly those seven questions — nothing more. Billing, pricing, payments, reservations, Smart Charging, OCPI, ISO 15118/Plug & Charge, and the `Driver`/`Vehicle`/`Fleet` entities remain explicitly out of scope (see [§11](#11-out-of-scope-in-this-work-order)).

---

## 2. Domain hierarchy

```
Organization
    ↓
Site
    ↓
ChargingStation
    ↓
EVSE
    ↓
Connector
    ↓
ChargingSession
```

**Deliberate deviation from the CAP-002/CAP-003 ownership pattern.** `Evse` and `Connector` store no `organizationId`/`siteId` — ownership is derived by walking the parent chain on every access check. `ChargingSession` does the opposite: DEC-013 and the WO's own required-fields list mandate that `organizationId`, `siteId`, `chargingStationId`, `evseId`, and `connectorId` are all stored directly on the session row, not derived. This is a deliberate denormalization for the one table in this schema expected to have session-level query volume and cross-cutting filters (list sessions by organization, by site, by station) that would otherwise require a 4-way join on every request. It is documented here as an intentional exception to the established pattern, not an inconsistency to be "fixed" later.

## 3. Authorization hierarchy

```
AuthorizationCredential
    ↓
AuthorizationAttempt
    ↓
ChargingSession
```

**Consolidation from the CAP-003-era design.** The [Authorization Architecture](./MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md) document envisioned two separate entities downstream of a credential: `AuthorizationAttempt` (the raw event) and `AuthorizationDecision` (the outcome). DEC-013/the WO's model spec collapse these into one `AuthorizationAttempt` row that carries its own `result` field. This is a legitimate simplification, not a loss of information — every attempt still records what was presented, when, and what happened, in one row instead of two joined ones. `AuthorizationDecision` as a distinct concept is retired by this document.

---

## 4. Ownership model (DEC-013)

```
ChargingSession
    │
    ├── AuthorizationCredential (required)
    ├── Driver   (architectural concept only — no model)
    ├── Vehicle  (architectural concept only — no model)
    └── Fleet    (architectural concept only — no model)
```

Every `ChargingSession` has exactly one `AuthorizationCredential` — the credential that authorized it. `Driver`, `Vehicle`, and `Fleet` are named, positioned in the ownership model, and explicitly **not implemented**: no Prisma model, no foreign key, no column. When they exist (Architecture Backlog #46–48), the natural join point is `AuthorizationCredential.ownerRef` (already documented as polymorphic/unresolved in the CAP-003-era Authorization Architecture) — not a new direct field on `ChargingSession`. This document does not change that.

## 5. Session creation boundary (DEC-014)

```
AuthorizationCredential
        ↓
AuthorizationAttempt
        ↓
Authorize
        ↓
ACCEPTED / REJECTED
        ↓
StartTransaction / TransactionEvent(Started)
        ↓
ChargingSession
```

**MOVOS does not create a `ChargingSession` during authorization.** An OCPP `Authorize` message (device asks "is this idTag good?", independent of physically starting a transaction) resolves to an `AuthorizationAttempt` row and nothing else — no session, no reservation of a connector slot, no side effect beyond the audit record. A `ChargingSession` comes into existence only when a real transaction begins: OCPP 1.6J's `StartTransaction`, or (documented, not implemented — [§10](#10-ocpp-201-mapping-documentation-only)) OCPP 2.0.1's `TransactionEvent(eventType: Started)`.

**Where `protocolTransactionId` comes from.** OCPP 1.6J's `StartTransaction` is a request _from_ the device with no transaction identifier attached — the CSMS (MOVOS) is the party that assigns `transactionId` and returns it in `StartTransaction.conf`. This means `createSession()` is the code that mints `protocolTransactionId`, not code that receives it from the device. It is generated by a single in-memory, per-process counter (`TransactionIdGeneratorService`, seeded from `Date.now()` at boot, incrementing thereafter, wrapped to stay within a 32-bit signed integer range some real charge-point firmware expects for OCPP 1.6J's integer `transactionId`). This has the same single-instance dependency CAP-003's connection registry already has (Decision 6) — it is documented here as reusing that existing, already-accepted constraint, not introducing a new one. `protocolTransactionId` is stored as a `String` in the database (protocol-version-neutral, since OCPP 2.0.1's transaction id is itself a string), and the 1.6J adapter serializes it back out as a JSON integer in the `StartTransaction.conf` response.

**Why `AuthorizationAttempt.result` can be `OFFLINE_ACCEPTED` even though `Authorize` alone never creates a session.** A station operating on its Local Authorization List (no live MOVOS connection) can authorize and start a transaction entirely offline. When connectivity resumes and the device's buffered `StartTransaction` arrives, MOVOS still walks the same `AuthorizationAttempt → ChargingSession` path — the attempt is recorded retroactively with `result: OFFLINE_ACCEPTED`, and the session's `startedAt` reflects the device-reported time, not the time MOVOS learned about it (same principle already stated in the CAP-003-era ChargingSession Architecture's "Offline operation" section).

## 6. Session termination model (DEC-015)

Termination is a **business-driven** classification, not a direct pass-through of OCPP's own `StopTransaction.reason` string. The termination reason vocabulary:

`NORMAL_COMPLETION` · `CABLE_DISCONNECTED` · `VEHICLE_FULL` · `REMOTE_STOP` · `EMERGENCY_STOP` · `FAULT` · `TIMEOUT` · `POWER_LOSS` · `STATION_REBOOT` · `USER_CANCELLED` · `NETWORK_FAILURE` · `UNKNOWN`

Four of these (`VEHICLE_FULL`, `TIMEOUT`, `NETWORK_FAILURE`, and in practice most of `FAULT`) have **no direct OCPP 1.6J `StopTransaction.reason` equivalent** — they are reachable only through paths this work order documents but does not implement (a future SoC-aware stop policy, a future session-timeout sweep, a future MOVOS-side connection-loss-during-active-session detector). `stopSession()`/`failSession()` accept any `ChargingSessionTerminationReason` value as an explicit argument precisely so those future callers have a real, already-typed target to call into — this is the same "reserve the shape, don't fake the implementation" discipline CAP-003 used for OCPP 2.0.1's adapter boundary.

### OCPP 1.6J `StopTransaction.reason` → `ChargingSessionTerminationReason` mapping

| 1.6J `reason` (per spec) | `ChargingSessionTerminationReason` | Note                                                                                                                                                                    |
| ------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _(absent)_               | `NORMAL_COMPLETION`                | OCPP treats a missing reason as an ordinary stop                                                                                                                        |
| `Local`                  | `USER_CANCELLED`                   | Stopped via the station's own local UI                                                                                                                                  |
| `EmergencyStop`          | `EMERGENCY_STOP`                   | Direct mapping                                                                                                                                                          |
| `EVDisconnected`         | `CABLE_DISCONNECTED`               | Direct mapping                                                                                                                                                          |
| `HardReset`              | `STATION_REBOOT`                   | Collapsed with `Reboot`/`SoftReset` — see below                                                                                                                         |
| `Other`                  | `UNKNOWN`                          | OCPP's own catch-all maps to ours                                                                                                                                       |
| `PowerLoss`              | `POWER_LOSS`                       | Direct mapping                                                                                                                                                          |
| `Reboot`                 | `STATION_REBOOT`                   | Direct mapping                                                                                                                                                          |
| `Remote`                 | `REMOTE_STOP`                      | Direct mapping                                                                                                                                                          |
| `SoftReset`              | `STATION_REBOOT`                   | Collapsed with `HardReset`/`Reboot` — MOVOS does not currently distinguish hard/soft reset as a business fact                                                           |
| `UnlockCommand`          | `USER_CANCELLED`                   | An operator/user action ended the session                                                                                                                               |
| `DeAuthorized`           | `UNKNOWN`                          | No clean bucket — a mid-session credential deauthorization is not the same as any of the other eleven reasons; deliberately not forced into `FAULT` or `USER_CANCELLED` |

This is a **lossy, deliberate simplification** — the same kind CAP-003's `NormalizedDeviceStatus` → `ConnectorStatus` mapping already established as precedent (see [OCPP/Domain Status Mapping](../engineering/OCPP_DOMAIN_STATUS_MAPPING.md)). The raw OCPP `reason` string is not discarded — it is still preserved verbatim in the corresponding `OcppProtocolEvent.payload` row (CAP-003's append-only protocol log), so nothing is actually lost, only classified.

## 7. Energy persistence model (DEC-016)

```
ChargingSession
    ├── energyWh    — the accumulated total, always present and authoritative
    ├── meterStart  — device-reported cumulative meter reading at start
    ├── meterStop   — device-reported cumulative meter reading at end
    └── MeterValues — optional, append-only, periodic telemetry (0..N rows)
```

**`ChargingSession.energyWh` must always be resolvable without `MeterValue` rows existing.** It is computed and stored on the session itself at every relevant transition (`meterStart` at `StartTransaction`, updated from the latest known reading during `ACTIVE`, finalized as `meterStop − meterStart` at `StopTransaction`) — never computed on read by aggregating `MeterValue` rows. This is the literal meaning of DEC-016's "the session lifecycle must never depend on telemetry availability": a station that never sends a single `MeterValues` message (optional in OCPP, some vendors omit it entirely) still produces a session with correct start/stop energy figures, because those come from `StartTransaction.meterStart` and `StopTransaction.meterStop` directly, not from telemetry.

`MeterValue` rows are a separate, purely additive, append-only telemetry stream — useful for a future consumption-curve UI or Smart Charging feedback loop, never a dependency of the session's own correctness.

## 8. Session lifecycle

```
PENDING
   ↓
AUTHORIZED
   ↓
STARTING
   ↓
ACTIVE  ──────┬──────────┬─────────────┐
   │          │          │             │
STOPPING   OFFLINE     FAILED      CANCELLED
   ↓          │
COMPLETED   (resume) → ACTIVE
```

**Design decision: where `createSession()` sits relative to `Authorize`.** DEC-014 is explicit that authorization alone never creates a session, yet the lifecycle above has both a `PENDING` and an `AUTHORIZED` state before `STARTING`/`ACTIVE`. This is resolved as follows: `createSession()` is invoked only from the `StartTransaction` (1.6J) / `TransactionEvent(Started)` (2.0.1, undocumented-implementation) handler, never from the `Authorize` handler — consistent with DEC-014. In the 1.6J happy path, because `StartTransaction` already implies a device that has validated the idTag locally and physically connected, `createSession()` walks `PENDING → AUTHORIZED → STARTING → ACTIVE` **synchronously within the same handler invocation** — re-confirming the credential via a fresh `AuthorizationAttempt` lookup at the `AUTHORIZED` step. The intermediate states are not dead code: they exist as independently reachable, independently validated states in the lifecycle engine for scenarios this work order's 1.6J vertical does not itself produce but must not foreclose — a future MOVOS-initiated `RemoteStart` (Architecture Backlog #36) would genuinely pause at `AUTHORIZED` awaiting the device's own confirmation, and OCPP 2.0.1's more granular `TransactionEvent` stream maps more naturally onto separate `STARTING`/`ACTIVE` transitions than 1.6J's single-message start does.

**Allowed transitions** (enforced by the lifecycle engine, [§12](#12-session-lifecycle-engine)):

| From         | To                                           |
| ------------ | -------------------------------------------- |
| `PENDING`    | `AUTHORIZED`, `CANCELLED`, `FAILED`          |
| `AUTHORIZED` | `STARTING`, `CANCELLED`, `FAILED`            |
| `STARTING`   | `ACTIVE`, `FAILED`, `CANCELLED`              |
| `ACTIVE`     | `STOPPING`, `OFFLINE`, `FAILED`, `CANCELLED` |
| `OFFLINE`    | `ACTIVE` (resume), `FAILED`, `STOPPING`      |
| `STOPPING`   | `COMPLETED`, `FAILED`                        |
| `COMPLETED`  | _(terminal — no transitions out)_            |
| `FAILED`     | _(terminal — no transitions out)_            |
| `CANCELLED`  | _(terminal — no transitions out)_            |

Any transition not in this table is rejected by the lifecycle engine with an explicit error — see [§12](#12-session-lifecycle-engine). `SUSPENDED` (named in the WO's status enum) is implemented as the `status` value a session takes while paused mid-charge for a device-reported reason (e.g. `SuspendedEV`/`SuspendedEVSE` connector status arriving for the connector a session is active on) — it shares the same transition rules as `OFFLINE` (`ACTIVE ↔ SUSPENDED`) since both represent "still logically active, temporarily not delivering energy," distinguished only by _why_ (device-reported charging suspension vs. connection loss).

## 9. OCPP 1.6J mapping (implemented)

| OCPP 1.6J message  | Normalized event (already reserved by CAP-003) | Domain effect                                                                                                                                                      |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Authorize`        | `Authorization`                                | Creates one `AuthorizationAttempt` row. No session.                                                                                                                |
| `StartTransaction` | `TransactionStart`                             | `createSession()` — resolves credential, walks `PENDING→ACTIVE`, assigns `protocolTransactionId`, sets `meterStart`/`startedAt`.                                   |
| `MeterValues`      | `TransactionUpdate`                            | Appends `MeterValue` row(s); updates `ChargingSession.energyWh` from the latest energy-register sample if present.                                                 |
| `StopTransaction`  | `TransactionEnd`                               | `stopSession()` — sets `meterStop`, finalizes `energyWh`, maps `reason` per [§6](#6-session-termination-model-dec-015), walks `ACTIVE/OFFLINE→STOPPING→COMPLETED`. |

All four normalized event shapes (`Authorization`, `TransactionStart`, `TransactionUpdate`, `TransactionEnd`) already existed in `normalized-events.ts` as CAP-003-reserved, unimplemented shapes — this work order implements their 1.6J adapter parsing and their domain handlers; it does not change the shapes themselves.

## 10. OCPP 2.0.1 mapping (documentation only)

| OCPP 2.0.1 message                     | Normalized event    | Domain effect (once built)         |
| -------------------------------------- | ------------------- | ---------------------------------- |
| `Authorize`                            | `Authorization`     | Same as 1.6J.                      |
| `TransactionEvent(eventType: Started)` | `TransactionStart`  | Same as 1.6J's `StartTransaction`. |
| `TransactionEvent(eventType: Updated)` | `TransactionUpdate` | Same as 1.6J's `MeterValues`.      |
| `TransactionEvent(eventType: Ended)`   | `TransactionEnd`    | Same as 1.6J's `StopTransaction`.  |

**Not implemented.** The `Ocpp201Adapter` remains the boundary-only stub CAP-003 shipped — every 2.0.1 message, including `Authorize`/`TransactionEvent`, still resolves to an explicit `CapabilityNotSupportedError`/`CALLERROR`. This table exists so that whenever the 2.0.1 adapter is eventually built, it normalizes onto the _same_ four event shapes and the _same_ domain handlers 1.6J uses today — no session/authorization domain code should need to change to support 2.0.1, only the adapter's parsing.

## 11. Out of scope in this work order

Billing, Payments, Tariffs, OCPI, Smart Charging, Reservations, ISO 15118, Plug & Charge implementation, `Driver`/`Vehicle`/`Fleet` models, V2G, dynamic pricing, hardware validation. **These are implementation limits, not architectural omissions** — every one of them has a registered [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) entry and a documented relationship to `ChargingSession`/`AuthorizationCredential` in the CAP-003-era architecture docs this document builds on.

## 12. Session lifecycle engine

Implemented as `SessionLifecycleService` (`apps/movos-api/src/sessions/session-lifecycle.service.ts`):

- `createSession(input)` — the only entry point that inserts a `ChargingSession` row; internally walks `PENDING→AUTHORIZED→STARTING→ACTIVE` per [§8](#8-session-lifecycle).
- `activateSession(id)`, `suspendSession(id)`, `resumeSession(id)` — explicit transition helpers for `ACTIVE↔OFFLINE`/`ACTIVE↔SUSPENDED`.
- `stopSession(id, { meterStop, reason })` — `ACTIVE/OFFLINE/SUSPENDED→STOPPING→COMPLETED`.
- `failSession(id, reason)` — any non-terminal state `→FAILED`.
- `cancelSession(id)` — any pre-`ACTIVE` state `→CANCELLED`.

Every method validates the current status against the table in [§8](#8-session-lifecycle) before writing; an invalid transition throws `InvalidSessionTransitionError` and performs no write. `startedAt` is set exactly once, at `createSession()`, and is never included in any subsequent update payload — enforced by the service never accepting `startedAt` as a parameter to any transition method. `endedAt` is set exactly once, at the transition into `COMPLETED`/`FAILED`/`CANCELLED`, and the service refuses to terminate a session whose `endedAt` is already non-null (the literal "a session cannot finish twice" rule).

## 13. Idempotency

Reusing the idempotency rule already stated in the CAP-003-era ChargingSession Architecture: every inbound normalized event that would mutate a `ChargingSession` is idempotent on `(chargingStationId, protocolTransactionId, eventType)`. A retransmitted `StartTransaction` for a transaction that already has a `ChargingSession` row is a no-op (returns the existing session), not a duplicate insert or an error — enforced by the `@@unique([chargingStationId, protocolTransactionId])` database constraint plus an application-level pre-check in `createSession()`.

**WO-ARGOS-063 addendum — `EXPIRED_OFFLINE_SESSION_CANNOT_ABSORB_NEW_TRANSACTION`.** WO-ARGOS-062 discovered that `createSession()`'s connector-scoped occupancy check treated _any_ `OFFLINE` session as "the same transaction retrying," with no age limit — a genuinely new physical `StartTransaction` on a connector whose prior session was `OFFLINE` past `ConnectivityCoordinator`'s recovery window silently reattached to the abandoned row instead of creating a new one, corrupting `meterStart`, `authorizationCredentialId`, `startedAt`, and (on completion) `energyWh`. `createSession()` now distinguishes three cases:

- **CASE A** — an existing non-`OFFLINE` non-terminal session (the original idempotency rule above): returned as-is.
- **CASE B** — an existing `OFFLINE` session still inside `SessionLifecycleService.isOfflineSessionRecoverable`'s window: returned as-is, unchanged from the pre-WO-063 behavior.
- **CASE C** — an existing `OFFLINE` session _outside_ that window: no longer treated as a retry. It is explicitly transitioned `OFFLINE → FAILED` (reason `NETWORK_FAILURE` — connectivity was lost and never recovered, not a user/administrative cancellation), audited as `SESSION_ABANDONED_ON_NEW_TRANSACTION`, and the incoming `StartTransaction` then creates a genuinely new `ChargingSession` row with its own identity, credential, `meterStart`, and `protocolTransactionId`.

`isOfflineSessionRecoverable` is the single, shared definition of the recovery window — used by both `createSession` (this case split) and `ConnectivityCoordinator.attemptRecovery` (the reconnect path) — deliberately kept as one method so the two paths cannot diverge. See `apps/movos-api/test/offline-session-supersession.e2e-spec.ts` for the permanent regression coverage (mandatory billing scenario, StopTransaction A/B/C, idempotency matrix, concurrency, multi-connector, Digital Twin).

## 14. Failure scenarios

| Scenario                                                                      | Behavior                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StartTransaction` for an `idTag` with no matching `AuthorizationCredential`  | `AuthorizationAttempt.result = UNKNOWN`; `createSession()` refuses to create a session; `StartTransaction.conf` returns `idTagInfo.status: Invalid`.                                                                                                      |
| `StartTransaction` for a `REVOKED`/`EXPIRED` credential                       | `AuthorizationAttempt.result` = `REVOKED`/`EXPIRED` respectively; no session created; response reflects the same status.                                                                                                                                  |
| `MeterValues` referencing a `protocolTransactionId` with no active session    | Recorded in the append-only `OcppProtocolEvent` log as `UNSUPPORTED`/`REJECTED` (no `MeterValue` row created — there is no session to attach it to); does not fail the connection.                                                                        |
| `StopTransaction` for an already-`COMPLETED` session (duplicate/retransmit)   | No-op, per [§13](#13-idempotency) — returns the existing terminal state, does not re-run termination logic or error.                                                                                                                                      |
| `energyWh` would go negative (e.g. a device reports `meterStop < meterStart`) | Rejected at the service layer before any write; session transitions to `FAILED` with `reason: UNKNOWN` rather than persisting a negative value. Also enforced as a hard database `CHECK` constraint (`energyWh >= 0`) as a second, independent guarantee. |

## 15. Offline behavior

Reuses the CAP-003-era Authorization Architecture's offline model verbatim: a station operating on its Local Authorization List can authorize and start a transaction with no live MOVOS connection. When it reconnects and the buffered `StartTransaction`/`MeterValues`/`StopTransaction` messages arrive, MOVOS processes them exactly as if they had arrived live — `startedAt`/timestamps come from the device-reported values in the messages, not from MOVOS's own receipt time. A session that begins this way passes through `OFFLINE` rather than `ACTIVE` until the first live message for it is actually processed, then behaves identically to any other session from that point on.

## 16. Future integration points

- **Billing/Tariff** (Architecture Backlog #24/#25): `ChargingSession.energyWh` + `startedAt`/`endedAt` are the natural inputs to a future cost calculation; no pricing field is added to `ChargingSession` itself.
- **Driver/Vehicle/Fleet** (#46–48): join through `AuthorizationCredential.ownerRef` once those entities exist, not through a new direct `ChargingSession` field.
- **Smart Charging** (#20): would consume the `MeterValue` stream and could emit a future `NormalizedOutboundCommand` (e.g. a charging-profile command) — no session/authorization domain code changes required.
- **Reservations** (#18): a reservation would precede `AuthorizationAttempt`, not replace it — out of scope here, but the sequence in [§5](#5-session-creation-boundary-dec-014) has a natural insertion point before `Authorize`.
- **OCPP 2.0.1 functional adapter**: see [§10](#10-ocpp-201-mapping-documentation-only) — no domain-layer change anticipated, only a new adapter.
