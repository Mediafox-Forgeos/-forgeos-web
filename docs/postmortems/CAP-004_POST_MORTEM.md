# CAP-004 Post-Mortem — Charging Sessions & Authorization Foundation

**Generated:** 2026-08-01
**Work orders:** WO-ARGOS-009 (implementation), WO-ARGOS-009A (architectural validation gate)
**PR:** [#25](https://github.com/Mediafox-Forgeos/-forgeos-web/pull/25), merged as `46206f259ce6dd6ec0bb31a42f1f4a4d11451447`
**Tag:** `CAP-004_COMPLETE`
**Related:** [CAP-004 Charging Sessions Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md), [DEC-017 Offline Policy](../domain/DEC-017_OFFLINE_POLICY.md), [DEC-018 Billing Boundary Analysis](../domain/DEC-018_BILLING_BOUNDARY_ANALYSIS.md)

## What this capability answers

Before CAP-004, MOVOS could identify and authenticate a charging station and observe its boot/heartbeat/connector-status (CAP-003), but had no way to answer any business question about _use_. CAP-004 closes that gap: who initiated a session, when it started/ended, which connector, how much energy, how it was authorized, and why it ended.

## What shipped

- 4 Prisma models (`ChargingSession`, `AuthorizationCredential`, `AuthorizationAttempt`, `MeterValue`), 5 enums, 1 migration, applied and verified against a real database.
- `SessionLifecycleService` — the sole writer for `ChargingSession`, with an explicit, tested transition table covering the full happy path plus `OFFLINE`/`SUSPENDED`/`FAILED`/`CANCELLED` branches.
- OCPP 1.6J `Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction`, wired through 4 new domain handlers into the existing CAP-003 router — the four normalized event shapes CAP-003 had deliberately reserved but left unimplemented.
- `AuthorizationAttemptsService` — every presented credential resolved and recorded unconditionally, whether accepted or not.
- 7 new HTTP endpoints (3 read-only sessions, 3 credentials, 1 read-only attempts).
- Simulator extended with the four new message types.
- 11 commits, 63 new tests (167 → 230 in the movos-api suite), 4 new engineering guides, 6 existing docs updated.

## What the validation gate (WO-ARGOS-009A) found

ARGOS froze the PR post-implementation and required evidence, not assertions, on five specific architectural concerns before authorizing merge. All five came back **confirmed correct, zero defects found**:

1. `protocolTransactionId` uniqueness is the composite `[chargingStationId, protocolTransactionId]` ARGOS expected, not a bare global-unique column.
2. `MeterValue`'s `[sessionId, timestamp]` index is real and delivers a genuinely measured ~126×–554× speedup at 100K/1M/10M synthetic rows (built and torn down in an isolated schema — the real table was never touched).
3. `AuthorizationAttempt`/`ChargingSession`'s two FK relationships to `AuthorizationCredential` use different, individually-correct strategies (`SET NULL` for the append-only audit trail, `RESTRICT` for the session's non-optional reference) — history cannot be lost either way.
4. Telemetry independence — a session with `meterStart=1000`, `meterStop=1450`, zero `MeterValue` rows — was proven live against a real database and WebSocket connection, including a negative-energy write rejected directly by the database's own `CHECK` constraint.
5. Two forward-looking decisions (`DEC-017` offline policy, `DEC-018` billing boundary) were produced as recommendations, not implemented.

**This is a genuinely good outcome, worth naming as one:** a dedicated adversarial review pass found no defects, only one real gap (below) that the implementation had already disclosed in its own final report rather than one discovered by surprise.

## What's explicitly deferred (by design, not oversight)

Every item below has a registered Architecture Backlog entry, a documented relationship to `ChargingSession`/`AuthorizationCredential`, and was excluded from CAP-004's scope on purpose:

- Billing, tariffs, payments, reservations, OCPI, Smart Charging, ISO 15118/Plug & Charge.
- `Driver`/`Vehicle`/`Fleet` models (referenced only conceptually via `AuthorizationCredential.ownerRef`, which doesn't exist as a column).
- RFID-specific behavior — UID normalization, Local Authorization List sync. Generic credential CRUD covers all 8 `AuthCredentialType` values equally; nothing RFID-specific was built.
- Functional OCPP 2.0.1 — the boundary-only stub from CAP-003 is unchanged.
- **The `ACTIVE→OFFLINE` auto-trigger.** `SessionLifecycleService.suspendSession(id, 'OFFLINE')` is a real, correct, callable method — nothing calls it automatically. `ConnectionRegistryService` (CAP-003) and `SessionLifecycleService` (CAP-004) have zero wiring between them. This was surfaced by CAP-004's own final report before the validation gate ran, and confirmed (not newly discovered) by DEC-017's analysis. It is the one concrete piece of unfinished work this post-mortem flags for a future work order.

## What we'd do differently

- **The reserved-but-unimplemented normalized event shapes (`TransactionStart`/`TransactionUpdate`/`TransactionEnd`) were missing fields CAP-004 needed** (`protocolVersion` on `TransactionStart`, `timestamp` on `TransactionUpdate`) — CAP-003 reserved the shapes without fully anticipating what a real implementation would need from them. Not a defect (the shapes were explicitly marked reserved, not final), but a reminder that "reserve the shape for later" is only as good as the foresight behind it — minor, cheaply fixed here, but worth designing reserved shapes a notch more conservatively next time (include fields that are _obviously_ going to be needed, like protocol version and timestamp, even before the consuming code exists).
- **`AuthorizationDecision`, a distinct entity in the CAP-003-era architecture doc, was retired and folded into `AuthorizationAttempt.result` during implementation.** The right call in hindsight (confirmed nothing was lost — every attempt still records what was presented, when, and what happened, in one row instead of two joined ones), but it's a real divergence from an earlier-approved design that should have been flagged as its own explicit decision point rather than folded in as an implementation detail of DEC-013.
- **The OFFLINE-transition gap could have been caught earlier if DEC-017-style analysis (checking the new state against the existing `ConnectionRegistryService` stale-sweep) had been done during initial design, not after merge-review.** The state machine was internally consistent and fully tested on its own terms; the gap was only visible by looking _outward_ at CAP-003's existing transport-layer timing, which nothing in CAP-004's own design review prompted anyone to do until ARGOS's validation gate asked the question directly.

## Metrics

|                                                                                                                                                       |                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Commits merged                                                                                                                                        | 11                                                                                                                                                                                                                             |
| Tests added (`apps/movos-api` suite only — `pnpm --filter @mediafox/movos-api test`; excludes `apps/movos-web` and every other workspace's own suite) | 63 (167 → 230 total in that suite; reproduced 2026-08-01 under WO-ARGOS-010, still 230/230)                                                                                                                                    |
| New models                                                                                                                                            | 4                                                                                                                                                                                                                              |
| New enums                                                                                                                                             | 5                                                                                                                                                                                                                              |
| New HTTP endpoints                                                                                                                                    | 7                                                                                                                                                                                                                              |
| New engineering guides                                                                                                                                | 4                                                                                                                                                                                                                              |
| Live validation scenarios (WO-ARGOS-009 + 009A combined)                                                                                              | Authorize (valid/unknown), StartTransaction (valid/unknown, idempotent retransmit), MeterValues (progression), StopTransaction (normal + idempotent retransmit), zero-telemetry completion, DB-level negative-energy rejection |
| Defects found by the validation gate                                                                                                                  | 0                                                                                                                                                                                                                              |
| Real gaps found by the validation gate                                                                                                                | 1 (OFFLINE auto-trigger wiring — already disclosed pre-gate)                                                                                                                                                                   |

## Next

`CAP-005_AUTHORIZATION_AND_CONNECTIVITY` opened in the Architecture Backlog to carry forward: the `ConnectionRegistryService`↔`SessionLifecycleService` OFFLINE wiring (per DEC-017's recommendation), and RFID-specific credential behavior (UID normalization, Local Authorization List sync).

## 2026-08-02 follow-up (WO-ARGOS-010): the OFFLINE-wiring gap is closed

The single real gap this post-mortem flagged — `SessionLifecycleService.suspendSession(id, 'OFFLINE')` having no automatic caller — is resolved. DEC-017 was approved (RECOMMENDATION → ACCEPTED) and implemented as CAP-005's `ConnectivityCoordinator`, wired to `ConnectionRegistryService`'s existing stale-sweep exactly as DEC-017 required (no independent competing timer). Real-boot/real-Postgres/real-WebSocket validated: a session left `ACTIVE` through a verified-stale disconnect is now moved to `OFFLINE` automatically, and recovered automatically on a reconnect within the recovery window. See [CAP-005 Connectivity Engine](../domain/CAP-005_CONNECTIVITY_ENGINE.md). The RFID half of the original `CAP-005_AUTHORIZATION_AND_CONNECTIVITY` backlog entry was explicitly out of scope for WO-ARGOS-010 ("connectivity only") and remains open.
