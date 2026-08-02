# CAP-005 — Connectivity Engine

**Generated:** 2026-08-02 (WO-ARGOS-010)
**Implements:** DEC-017 (ACCEPTED, see [DEC-017's Approval Record](./DEC-017_OFFLINE_POLICY.md#argos-approval-record-2026-08-02-wo-argos-010))
**Builds on:** [CAP-003 OCPP Architecture Decisions](./CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) (`ConnectionRegistryService`), [CAP-004 Charging Sessions Foundation](./CAP-004_CHARGING_SESSIONS_FOUNDATION.md) (`SessionLifecycleService`)
**Does not implement:** RFID-specific behavior, billing, tariffs, invoices, payments, remote start/stop, OCPP 2.0.1 functional messages, smart charging, vendor profiles, Redis/message brokers, multi-instance connection routing, SLA analytics, alerting workflows.

This document is the implementation record for CAP-005: the seam between "a WebSocket is open" (CAP-003's `ConnectionRegistryService`) and "a session is running" (CAP-004's `SessionLifecycleService`), which — before this capability — had zero wiring between them (confirmed in DEC-017's "current state" audit).

---

## 1. Four concepts that are not the same thing

CAP-005 introduces device **connectivity** as a fifth, independent state alongside four that already existed. None of the five determine each other automatically:

| Concept                              | Owner                                                    | Meaning                                                                        |
| ------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| WebSocket connected state            | `ConnectionRegistryService` (in-memory)                  | Is a TCP/WS socket for this `ocppIdentity` open right now?                     |
| `ChargingStation.status`             | Administrative (CAP-002)                                 | Is this station commissioned/in service, per an operator's own record-keeping? |
| `Evse.status` / `Connector.status`   | Operational (CAP-002/CAP-003, OCPP `StatusNotification`) | What is the connector physically doing (Available/Charging/Faulted/...)?       |
| `ChargingSession.status`             | Domain (CAP-004)                                         | Is a specific charging session PENDING/ACTIVE/COMPLETED/...?                   |
| `ChargingStation.connectivityStatus` | **New — CAP-005**                                        | Last-known evidence of whether this station's device is reachable at all.      |

A station can be administratively `ACTIVE`, operationally `Available`, with connectivity `OFFLINE` — that combination is not a contradiction, it is the expected state of a commissioned, idle charger whose device has lost its connection.

## 2. Connectivity types

`src/ocpp/connectivity/connectivity.types.ts`:

```ts
export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type ConnectivityEventType =
  'CONNECTED' | 'DISCONNECTED' | 'STALE' | 'RECONNECTED';
```

`UNKNOWN` is a first-class state, not a placeholder for `OFFLINE` — see §5 (startup reconciliation). It means "no live evidence either way," and is never conflated with a verified loss of connection.

## 3. Event flow

```
ConnectionRegistryService (CAP-003)
        │  register() / unregister() / sweepStale()
        ▼
ConnectivityCoordinator (CAP-005, new)
        │  handleConnectionEstablished() / handleConnectionClosed()
        ▼
SessionLifecycleService (CAP-004) — only for STALE closes
```

`ConnectionRegistryService` is the **sole** source of connectivity notifications — nothing else in the codebase calls `ConnectivityCoordinator` from a connectivity-detection path of its own. Calls are fire-and-forget (`void promise.catch(...)`) from the registry's side: a connectivity-side failure (e.g. a transient DB error) must never propagate back into transport-layer connection handling, which is why registration/close/sweep logic itself never awaits these calls.

### 3.1 On connection established (`register()`)

1. Station's `connectivityStatus` → `ONLINE`, `lastConnectedAt`/`lastSeenAt` → now, `lastProtocolVersion` → the negotiated version.
2. If an `OFFLINE` `ChargingSession` exists for this station: event is `RECONNECTED`, and recovery is attempted (§6). If not: event is `CONNECTED`.
3. **A connection event never creates a `ChargingSession`** — reconnecting a device that was never running a session simply reports `CONNECTED` and stops there.

### 3.2 On connection closed (`unregister()` — clean, or `sweepStale()` — stale)

1. Station's `connectivityStatus` → `OFFLINE`, `lastDisconnectedAt` → now. This happens for **both** a clean disconnect and a stale-sweep eviction — the station-level field reflects "not currently connected," full stop.
2. Only a **stale** close (reason `'stale'`) also finds every `ACTIVE`/`SUSPENDED` session on the station and moves it to `OFFLINE` via `SessionLifecycleService.suspendSession(id, 'OFFLINE')`.
3. A **clean** close (reason `'clean'`) never touches a `ChargingSession` — see §4's known asymmetry.

## 4. Known, deliberate asymmetry: clean disconnect vs. stale

DEC-017's approved policy requires the OFFLINE session trigger to come from `ConnectionRegistryService`, coordinated with its existing stale-sweep — "do not create an independent competing timer." Read literally, the WO's Phase 5 spec distinguishes:

- **Clean disconnect (`DISCONNECTED`)**: "never immediately complete or fail a session" — does not say it may move a session to OFFLINE.
- **Stale (`STALE`)**: "transition any current ACTIVE or SUSPENDED session ... to OFFLINE" — explicit authorization.

CAP-005 implements this literally: only `STALE` moves a session to `OFFLINE`. This produces a real, known limitation — **a device that cleanly disconnects (a graceful WebSocket close) and never reconnects leaves its session stuck `ACTIVE` forever**, because a de-registered connection is removed from `ConnectionRegistryService`'s map and can never again be swept as stale (`sweepStale()` only iterates currently-registered connections). This was not fixed with a second timer, because the WO explicitly forbids an independent competing timer, and a cleanly-closed connection has no natural periodic re-check without inventing one. It is recorded here as a limitation for a future work order to close (e.g., a periodic sweep of `ACTIVE` sessions whose station `connectivityStatus` is `OFFLINE` and has been for longer than the recovery window — not implemented by this capability).

## 5. Persisted state and startup reconciliation

`ChargingStation` gains five fields (migration `20260802041352_add_connectivity_engine`):

| Field                 | Type                                     | Updated when                                            |
| --------------------- | ---------------------------------------- | ------------------------------------------------------- |
| `connectivityStatus`  | `ConnectivityStatus` (default `UNKNOWN`) | Every connect, reconnect, clean close, stale close      |
| `lastConnectedAt`     | `DateTime?`                              | Every connect/reconnect                                 |
| `lastDisconnectedAt`  | `DateTime?`                              | Every clean or stale close                              |
| `lastSeenAt`          | `DateTime?`                              | Every connect/reconnect **only** — see limitation below |
| `lastProtocolVersion` | `OcppProtocolVersion?`                   | Every connect/reconnect                                 |

No live socket object or registry-internal state is ever persisted — `ConnectionRegistryService`'s in-memory map remains the only place a `WebSocket` instance lives.

**`lastSeenAt` known simplification.** It is set only at connect/reconnect time, identical to `lastConnectedAt` — not on every inbound OCPP message. Updating it per-message would mean a DB write on every Heartbeat/StatusNotification/MeterValues across the entire fleet, the same write-amplification `HeartbeatHandler`'s own design already argues against. In this version, `lastSeenAt` is not yet distinguishable from `lastConnectedAt`; a future version could update it from `ConnectionRegistryService.touch()` (already called on every inbound frame) without a DB write on every call, e.g. via a periodic batched flush — not implemented here.

**Startup reconciliation.** `ConnectivityCoordinator implements OnModuleInit`. `ConnectionRegistryService`'s in-memory map always boots empty — no station can have live connection evidence at the instant a fresh process starts. On boot, every station whose persisted `connectivityStatus` is `ONLINE` is force-reset to `UNKNOWN`: never left as a false `ONLINE` (that belief predates this process and cannot be verified), and never guessed to `OFFLINE` either (a device may reconnect within seconds and prove it was fine all along — `UNKNOWN` is the honest state until it does, which then correctly restores `ONLINE` via `handleConnectionEstablished`). Stations already persisted as `OFFLINE` are left as `OFFLINE` — that belief doesn't become less true because the process restarted.

## 6. Session recovery policy (Phase 7)

An `OFFLINE` session returns to `ACTIVE` (`SessionLifecycleService.resumeSession`) only when, at reconnect time:

1. The reconnecting station is the same one the session belongs to (trivially true — recovery only ever looks up `OFFLINE` sessions scoped to the reconnecting `chargingStationId`).
2. No conflicting non-terminal session (`PENDING`/`AUTHORIZED`/`STARTING`/`ACTIVE`/`SUSPENDED`/`STOPPING`) already exists on the same connector.
3. The reconnect lands within the recovery window: `Date.now() - session.updatedAt <= RECOVERY_WINDOW_MS`, where `RECOVERY_WINDOW_MS = 3 × 300_000ms = 900_000ms (15 minutes)` — the same 3×-heartbeat-interval multiplier DEC-017 approved, measured from the moment the session was moved to `OFFLINE` (its own `updatedAt`).

If either check fails, the session **stays `OFFLINE`** — never guessed back to `ACTIVE` — and a `SESSION_RECOVERY_REJECTED` audit event records why (`conflicting-session-on-connector` or `outside-recovery-window`). Billing corrections for a session that couldn't recover are explicitly out of scope for this capability.

Recovery never creates a new `ChargingSession` — it only ever resumes the existing `OFFLINE` row it found. A device that reconnects with no prior `OFFLINE` session simply gets `CONNECTED`, never a spuriously-created session.

## 7. Audit events

All emitted via `AuditService.record` (never throws; failures are logged, not propagated):

| Action                              | Subject         | When                                                               |
| ----------------------------------- | --------------- | ------------------------------------------------------------------ |
| `STATION_CONNECTIVITY_CONNECTED`    | ChargingStation | First connection, no prior OFFLINE session                         |
| `STATION_CONNECTIVITY_RECONNECTED`  | ChargingStation | Connection established with a prior OFFLINE session on the station |
| `STATION_CONNECTIVITY_DISCONNECTED` | ChargingStation | Clean close                                                        |
| `STATION_CONNECTIVITY_STALE`        | ChargingStation | Stale-sweep close                                                  |
| `SESSION_MOVED_OFFLINE`             | ChargingSession | An ACTIVE/SUSPENDED session moved to OFFLINE on a stale close      |
| `SESSION_RECOVERED`                 | ChargingSession | An OFFLINE session successfully resumed to ACTIVE                  |
| `SESSION_RECOVERY_REJECTED`         | ChargingSession | Recovery attempted but rejected (conflict or window expiry)        |

Every metadata payload is limited to `ocppIdentity`, `protocolVersion`, `chargingStationId`, `protocolTransactionId`, and `reason` — **no credentials, secrets, or Authorization headers are ever logged** by this capability.

## 8. API and frontend

`ApiChargingStation` (shared-types) carries all five persisted fields; `toApiChargingStation` maps them directly. The charging-station list card and detail page (`apps/movos-web`) render a connectivity badge (`ApiConnectivityStatusBadge`: ONLINE/OFFLINE/UNKNOWN) alongside — not merged with — the existing administrative status badge, plus (detail page only) last-seen timestamp and last-known protocol version. No uptime percentage or SLA metric is computed or displayed — connectivity is reported as last-known evidence only.

## 9. Out of scope (implementation limits, not architectural omissions)

RFID-specific behavior · billing/tariffs/invoices/payments · remote start/stop · OCPP 2.0.1 functional messages · smart charging/vendor profiles · Redis or any message broker · high-availability multi-instance connection routing · SLA analytics/alerting workflows · the clean-disconnect-to-OFFLINE gap noted in §4 · per-station-configurable heartbeat intervals (still a single hardcoded global 300s, per DEC-017's own noted limitation).

## 10. Runtime validation

See [`CONNECTIVITY_RUNTIME_GUIDE.md`](../engineering/CONNECTIVITY_RUNTIME_GUIDE.md) and the WO-ARGOS-010 final report for the real-boot / real-Postgres / real-WebSocket validation record: connect → ONLINE, idle past the real 5-minute stale threshold → station and session both OFFLINE, reconnect with the same protocol transaction → session recovered to ACTIVE, exactly one `ChargingSession` row throughout.
