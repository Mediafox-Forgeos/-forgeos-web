# CAP-006A — Validation Report

**Generated:** 2026-08-02 (WO-ARGOS-012)
**Companion to:** [CAP-006A_INVARIANTS.md](../domain/CAP-006A_INVARIANTS.md), [CAP-006A_FAILURE_MATRIX.md](../reviews/CAP-006A_FAILURE_MATRIX.md)

Three independent layers of evidence, each proving something the others can't:

1. **Mocked unit tests** (256/256 passing, `apps/movos-api`) — prove application logic correctness in isolation, including every branch of `recoverOfflineSession`'s outcome handling and `OrphanSessionSweepService`'s error/skip paths. Cannot prove real Postgres locking actually serializes concurrent transactions — a mocked `$transaction` callback always runs synchronously.
2. **Real-Postgres e2e concurrency proof** (`test/connector-concurrency.e2e-spec.ts`, 5/5 passing against a real `movos_test` database) — genuinely concurrent `Promise.all`/`Promise.allSettled` calls through the real `SessionLifecycleService` + real `PrismaService`, no mocks. This is the layer that actually exercises the advisory lock and the partial unique index against a live Postgres instance.
3. **Real-boot/real-WebSocket runtime validation** (this document) — a compiled `apps/movos-api` instance, real local `movos_dev` PostgreSQL, and the repository's real `OcppSimulator`, exercising the full transport → coordinator → lifecycle path exactly as a real device would.

None of the three alone would be sufficient evidence; together they cover logic correctness, real-database concurrency, and real-transport behavior.

---

## Layer 2 — real-Postgres concurrency proof (summary; full detail in the spec file itself)

Run: `TEST_DATABASE_URL=postgresql://movos:movos@localhost:5432/movos_test npx jest --config test/jest-e2e.json connector-concurrency`

| Test                                                                                     | Proves                                                                                      | Result                                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Simultaneous StartTransaction (10 concurrent calls, same connector)                      | Invariant 1 — exactly one non-terminal session survives, every caller receives the same row | ✅ Pass                                                                |
| Connector contention (recovery racing a fresh StartTransaction)                          | Invariant 1 under the exact interleaving PR27_ARCHITECTURAL_AUDIT.md §1 identified          | ✅ Pass                                                                |
| Recovery replay (3 concurrent `recoverOfflineSession` calls, same session)               | Invariant 3 — exactly one `recovered`, the rest `already-resolved`, no duplicate mutation   | ✅ Pass                                                                |
| Orphan cleanup (fail then re-create on the same connector)                               | The connector is genuinely free after a terminal transition — no leftover non-terminal row  | ✅ Pass                                                                |
| Partial unique index alone (advisory lock bypassed entirely, two raw concurrent inserts) | Invariant 1 holds at the database level independent of any application code's discipline    | ✅ Pass — second insert rejected with a real Postgres unique-violation |

`movos_test` was created locally for this work order (migrations applied, schema in sync) — a dedicated, disposable test database, never `movos_dev`.

## Layer 3 — real-boot runtime validation

Performed against a compiled `apps/movos-api` instance (`node dist/main.js`), real local PostgreSQL (`movos_dev`), and the real `OcppSimulator` class — no code path under test was stubbed or mocked.

### Scenario A — duplicate (near-simultaneous) connections

Two `OcppSimulator` instances connected with the same `ocppIdentity`/secret via `Promise.allSettled`, fired essentially simultaneously (not sequentially awaited). Result: both `connect()` calls resolved successfully at the WebSocket handshake level (both were accepted), but `ConnectionRegistryService.register()`'s replace-on-conflict rule closed the first as soon as the second registered — after settling, exactly one simulator instance remained connected, confirmed via `isConnected()` on both. No crash, no duplicate session created on the subsequent StartTransaction. Two `STATION_CONNECTIVITY_CONNECTED` audit events were correctly recorded (one per genuine `register()` call — this is expected, documented behavior, not a defect; see CAP-005 §3.1).

### Scenario B — regional/clean disconnect

The surviving connection booted, authorized, and started a session (`protocolTransactionId=14563`, session id `cmsbepnxr000nrckdaszw064b`, status `ACTIVE`), then was cleanly disconnected (`simulator.disconnect()` — a graceful WebSocket close, not an idle timeout). Verified via `psql`: `ChargingStation.connectivityStatus = 'OFFLINE'`, `lastDisconnectedAt` set — but the session remained `ACTIVE`, exactly matching CAP-005 §4's documented asymmetry (a clean disconnect never touches session state, only a verified-stale one does). This is the precise gap Objective 2's orphan sweep exists to close.

### Scenario C — orphan expiry (the real, running backstop)

`ChargingStation.lastDisconnectedAt` was directly backdated via `psql` to 16 minutes in the past — an explicit, disclosed acceleration of elapsed wall-clock time (the disconnect itself was real; only how long ago it happened was simulated, a standard technique for validating time-threshold logic without a literal 16-minute wait). Everything downstream of that timestamp — the sweep's own 60-second timer, its query, its `failSession` call, its audit write — is the real, unmodified, already-running `OrphanSessionSweepService` in the booted process, observed via its own log output:

```
[OrphanSessionSweepService] Session cmsbepnxr000nrckdaszw064b on station cms8i4t3c0009rc5a9v9nfgmv
expired as an orphan — no connectivity evidence for longer than the recovery window
```

Verified via `psql`: session `status = 'FAILED'`, `terminationReason = 'NETWORK_FAILURE'`, `meterStop` left `NULL` (the honest, documented consequence of Invariant 5 — no device ever reported a final meter reading for this session). Audit event `SESSION_ORPHAN_EXPIRED` recorded with the correct `chargingStationId`/`protocolTransactionId` metadata, no credentials logged.

### Scenario D — delayed reconnect

A fresh `OcppSimulator` reconnected with the same `ocppIdentity` (real device-reconnect semantics, not a resumed socket) after the orphan expiry above, and sent a genuine new `StartTransaction` on the same connector (`protocolTransactionId=14564`). Verified via `psql`: a new session was created (`cmsberpph0011rckd7esiquh3`) — distinct from the orphan-expired one — and the connector correctly allowed it (no stale non-terminal row blocking it). The session was then cleanly stopped (`meterStart=2000`, `meterStop=2300`, `energyWh=300`, correctly finalized). Final state query — non-terminal sessions on this station: **0**. Across the entire scenario (duplicate connect → session start → clean disconnect → orphan expiry → reconnect → new session → clean stop), the connector never held more than one non-terminal `ChargingSession` at any point, verified by direct query, not inferred.

### Scenario not exercised at the transport layer: "concurrent recovery"

A literal two-simultaneous-WebSocket-connections recovery race is structurally impossible to reproduce through the real transport, by design — `ConnectionRegistryService` guarantees at most one live connection per `ocppIdentity`, so there is no way for two genuine device reconnects to race each other at the WebSocket layer. This scenario's real proof is Layer 2's "connector contention" and "recovery replay" e2e tests, which exercise the actual race (`recoverOfflineSession` called concurrently) directly against the real database — the layer where this race can actually be constructed and observed.

### Cleanup

The rotated OCPP secret used for this validation run was rotated again (invalidating it), all temporary validation scripts (`scratch-validation/`) were deleted, login tokens were deleted, and the booted server process was stopped after the run completed.

## What this validation does not cover

A literal tens-of-thousands-of-simultaneous-WebSocket-connections load test was not performed — impractical in this environment and not what CAP-006A_FAILURE_MATRIX.md's mass-disconnect row claims. The `ConcurrencyLimiter`'s bounded-fan-out behavior under real mass load is instead proven deterministically by the dedicated unit test (60 simulated stale connections, peak concurrency verified ≤25 while all 60 complete) — a stronger, more precise proof for that specific property than a real 60-socket test would have been, since the unit test can assert exact peak concurrency, which a real-network test cannot observe as cleanly.
