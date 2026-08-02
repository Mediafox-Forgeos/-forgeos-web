# Session Reconnect Recovery Guide

**Generated:** 2026-08-02 (WO-ARGOS-010)
**Code:** `ConnectivityCoordinator.handleConnectionEstablished` / private `attemptRecovery` (`connectivity-coordinator.service.ts`)
**Architecture:** [CAP-005 §6](../domain/CAP-005_CONNECTIVITY_ENGINE.md#6-session-recovery-policy-phase-7), [DEC-017](../domain/DEC-017_OFFLINE_POLICY.md)

## When recovery is attempted at all

Every `handleConnectionEstablished` call looks up whether the reconnecting station has a `ChargingSession` with `status = 'OFFLINE'`. If none exists, this is a plain `CONNECTED` event — recovery is never attempted, and no session is created. If one exists, the event is `RECONNECTED` and recovery is attempted.

## The three checks (all must pass)

| #   | Check                                   | Query                                                                                                                                                                        | On failure                                                             |
| --- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Same station                            | Implicit — the `OFFLINE` lookup is already scoped to `chargingStationId`                                                                                                     | N/A (structurally guaranteed)                                          |
| 2   | No conflicting session on the connector | `findFirst` for any non-terminal session (`PENDING`/`AUTHORIZED`/`STARTING`/`ACTIVE`/`SUSPENDED`/`STOPPING`) on the same `connectorId`, excluding the OFFLINE session itself | `SESSION_RECOVERY_REJECTED`, reason `conflicting-session-on-connector` |
| 3   | Within the recovery window              | `Date.now() - session.updatedAt <= RECOVERY_WINDOW_MS` (15 min, from the moment the session went OFFLINE)                                                                    | `SESSION_RECOVERY_REJECTED`, reason `outside-recovery-window`          |

If both pass: `SessionLifecycleService.resumeSession(session.id)` transitions `OFFLINE → ACTIVE`, and `SESSION_RECOVERED` is recorded.

If either fails: the session **stays `OFFLINE`** — never guessed back to `ACTIVE` on incomplete evidence — and the rejection is recorded as a diagnostic audit event, not silently dropped.

## What "same protocol transaction" means here

Recovery does not re-verify the device's own transaction id against the session's `protocolTransactionId` at reconnect time — a WebSocket reconnect carries no OCPP transaction context by itself (that only arrives later, via the device's own `StartTransaction`/`MeterValues`/`StopTransaction` traffic, keyed by the transaction id **MOVOS itself assigned**, per CAP-004's `TransactionIdGeneratorService`). Recovery instead relies on structural uniqueness: at most one non-terminal `ChargingSession` can exist per connector (`SessionLifecycleService.createSession`'s own idempotency check enforces this), so "the connector's `OFFLINE` session" and "the transaction the device will resume talking about" are the same row by construction, not by an explicit id comparison at this layer. If a _different_ transaction was legitimately started on the same connector while the original was `OFFLINE` (e.g. an operator manually reset the connector), that new session is what check #2 detects as a conflict, correctly blocking recovery of the stale one.

## Billing corrections are explicitly out of scope here

A session that fails recovery (conflict or window expiry) simply remains `OFFLINE` — an operator or a future capability decides what happens to it next (manual close, billing adjustment, etc.). This guide's code path performs no such correction itself.

## Related guides

[Connectivity Runtime Guide](./CONNECTIVITY_RUNTIME_GUIDE.md) · [Session Lifecycle Guide](./SESSION_LIFECYCLE_GUIDE.md) · [CAP-004 Charging Sessions Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md)
