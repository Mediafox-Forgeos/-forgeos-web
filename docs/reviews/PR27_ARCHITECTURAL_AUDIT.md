# PR #27 — Architectural Audit (WO-ARGOS-011A)

**Reviewer:** VULCAN (self-review, adversarial mode — no feature work authorized)
**Scope:** `feat/cap-005-connectivity-engine` → `main`, PR #27, HEAD `1666a7e98f6988029a752f525f239994f63bbce7`
**Method:** static code review of the actual merged diff (`ConnectionRegistryService`, `ConnectivityCoordinator`, `SessionLifecycleService`, `OcppWebSocketServer`, `TransactionEndHandler`, the Prisma schema/migration) plus reasoning about concurrent/interleaved execution the existing test suite does not exercise (all 251 tests in this PR's two workspaces run sequentially against mocked or single-threaded fakes — none inject real concurrency). No source code, migration, or API was modified to produce this document. This document assumes an eventual fleet of tens of thousands of stations across multiple countries, per the work order's mandate.
**Verdict key:** PASS ✅ · RISK ⚠️ · FAIL ❌

---

## 1. Session uniqueness

**Can any reconnect scenario create more than one `ChargingSession` for the same transaction?**

**RISK ⚠️ — not for the _same_ transaction id, but for the same connector, under concurrency the code does not actually prevent.**

Two independent code paths each perform a **read-then-write** existence check with no locking or transaction wrapping:

- `SessionLifecycleService.createSession` (`session-lifecycle.service.ts:132-169`): `findFirst` for a non-terminal session on `connectorId`, then `create` if none is found.
- `ConnectivityCoordinator.attemptRecovery` (`connectivity-coordinator.service.ts:179-224`): `findFirst` for a conflicting non-terminal session on the same `connectorId` (excluding the `OFFLINE` session itself), then `resumeSession` if none is found.

Both checks run against the _current_ database state at read time, with no `SELECT ... FOR UPDATE`, no Prisma `$transaction`, and — critically — **no database constraint that would catch the race**. The schema's only relevant unique constraint is `@@unique([chargingStationId, protocolTransactionId])` (`schema.prisma:665`), and `protocolTransactionId` is minted fresh, in-memory, per call by `TransactionIdGeneratorService` (never device-supplied for 1.6J) — so two concurrent inserts always get two _different_ transaction ids and the unique constraint never fires. The code comment at `schema.prisma:660-664` ("a retransmitted StartTransaction ... must be detectable as a duplicate via this exact constraint, not a race-prone read-then-write check") is accurate for a _retransmitted_ StartTransaction, but does not — and cannot — protect against two _independent_ concurrent StartTransactions, or a StartTransaction racing a reconnect-recovery, on the same connector.

**Concrete interleaving that produces two live sessions on one connector:**

1. Station's connection goes stale → session A is `OFFLINE`.
2. Device reconnects. `handleConnectionEstablished` reads: an `OFFLINE` session exists → begins `attemptRecovery` → reads: no conflicting session on the connector → about to call `resumeSession(A)`.
3. Before step 2's `resumeSession` write lands, a fresh `StartTransaction` arrives on the same connector (plausible: the device reconnects and, not realizing MOVOS considers its old session recoverable, immediately starts a new one). `createSession` reads: no non-terminal session on the connector (A is still `OFFLINE` in the DB at this read) → creates session B, `ACTIVE`.
4. Step 2's `resumeSession(A)` now completes → A is also `ACTIVE`.

Result: two `ACTIVE` sessions on one connector, both with distinct valid `protocolTransactionId`s, no constraint violated. This is a genuine gap between the invariant the code's own comments assert and what is actually enforced. It is **not new to this PR** on the `createSession`-vs-`createSession` side (that race pre-dates CAP-005), but CAP-005 **adds a second, structurally identical race** (recovery-vs-new-session) without closing the first.

**Likelihood at scale:** low per individual station, but non-trivial in aggregate — flaky-network reconnect storms are exactly the profile a large, geographically distributed fleet will produce constantly, and this is precisely the condition under which the race window opens.

---

## 2. Orphan sessions

**Can an `ACTIVE` session remain `ACTIVE` forever after station loss?**

**RISK ⚠️ — yes, by explicit design, for exactly one path: a clean disconnect that never reconnects.**

- **Stale timeout:** correctly closes the loop — `sweepStale()` → `handleConnectionClosed(reason: 'stale')` → any `ACTIVE`/`SUSPENDED` session is moved to `OFFLINE`. Not orphaned.
- **Clean disconnect:** `unregister()` → `handleConnectionClosed(reason: 'clean')` updates only the station's `connectivityStatus`/`lastDisconnectedAt` — **the session is never touched** (`connectivity-coordinator.service.ts:124-131`, guarded by `if (input.reason !== 'stale') return;` at line 143). This is documented as a deliberate, literal reading of the work order's Phase 5 spec (CAP-005 §4), not an oversight — but the practical consequence stands: a device that sends a graceful WebSocket close (e.g., a firmware-initiated reboot, a network stack that closes cleanly before the link actually drops) and **never reconnects** leaves its session `ACTIVE` indefinitely. Nothing re-sweeps a de-registered connection — once removed from `ConnectionRegistryService`'s map, it can never again be evaluated for staleness.
- **Server restart:** does not orphan a session further than it already was — see §6.
- **Simulator/real disconnect:** validated live under WO-ARGOS-010 only for the _stale_ path; the clean-disconnect-then-silence path was not exercised end-to-end (there is no automated or live-validated proof either way, only static confirmation that the code takes no action).

There is currently **no backstop** for this case: no periodic sweep of "sessions whose station has been non-`ONLINE` for longer than the recovery window," which CAP-005's own documentation names as a known limitation but does not close. At fleet scale, this is not a rare edge case — clean application-level disconnects (firmware updates, scheduled reboots, graceful network handoffs) are a normal, frequent event class, not a failure mode.

---

## 3. Lifecycle idempotency

**Walk: `ACTIVE → OFFLINE → ACTIVE → OFFLINE → COMPLETED`**

**RISK ⚠️**

- **Deterministic:** yes. `ALLOWED_TRANSITIONS` is a pure lookup table; given a `(from, to)` pair the result is always the same.
- **Idempotent in the sense of "same event delivered twice produces the same end state":** **no, by construction.** `OFFLINE` does not appear in its own allowed-target list (`session-lifecycle.service.ts:73-79`: `[OFFLINE]: [ACTIVE, SUSPENDED, FAILED, STOPPING, CANCELLED]` — `OFFLINE` itself is absent). If `suspendSession(id, 'OFFLINE')` were ever invoked twice for the same already-`OFFLINE` session, the second call's fresh `requireSession` read would see `status: 'OFFLINE'`, and `assertTransitionAllowed('OFFLINE', 'OFFLINE')` would **throw** `InvalidSessionTransitionError`. Today there is exactly one call site (`ConnectivityCoordinator.handleConnectionClosed`'s stale branch), and the transport layer's single-registered-connection-per-identity invariant makes a literal double-fire hard to trigger _today_ — but the lifecycle service itself provides no defensive no-op guard, so this safety currently rests entirely on "only one caller exists," not on the state machine being self-protecting. That is a fragile invariant to depend on as more call sites are added (e.g., a future secondary connectivity-loss signal).
- **Can duplicate events corrupt state?** Not silently — a duplicate `OFFLINE`-directed call throws rather than corrupting data, and that throw is swallowed by `ConnectionRegistryService`'s `.catch()` (logged, not re-thrown further). So the failure mode is "the second event is dropped and logged," not "the row is corrupted." Acceptable as a failure mode, but it does mean a duplicate-delivery scenario silently loses an audit trail entry with no alert.
- **Interaction with `StopTransaction` arriving mid-recovery:** a genuine race exists here too (see the risk matrix, entry R-06) — a `StopTransaction` landing between `attemptRecovery`'s conflict check and its `resumeSession` write causes `resumeSession`'s own fresh read to see `COMPLETED`, and `assertTransitionAllowed('COMPLETED', 'ACTIVE')` throws (`COMPLETED` has no outgoing transitions). The **final state is correct** (the session correctly ends up `COMPLETED`, not corrupted) purely because the transition table happens to reject the stale resume — but the `SESSION_RECOVERED` audit event is silently never written, and the failure surfaces only as an error-level log line, not a structured audit event. Correctness survives by the transition table's incidental strictness, not by any explicit ordering guarantee in the coordinator.

---

## 4. Presence consistency

**Can `connectivityStatus`/`lastSeenAt` become inconsistent? Document only.**

**RISK ⚠️ — yes, in at least three distinct ways, one of them structural rather than transient.**

1. **`connectivityStatus = ONLINE` with a stale `lastSeenAt` — structural, not transient, and will occur on every long-lived connection.** `lastSeenAt` is set only at connect/reconnect time (`connectivity-coordinator.service.ts:88-97`), never on ongoing heartbeats — this is a documented, deliberate simplification to avoid per-message write amplification, but its consequence is real: a station connected continuously for hours will show `connectivityStatus: ONLINE` while `lastSeenAt` reads however long ago the _original_ connect happened, not "just now." Any future dashboard, alert, or SLA computation that naively reads `lastSeenAt` as "last confirmed alive" rather than "last (re)connected" will misreport every long-lived healthy connection as increasingly stale. This is the single most likely field-level footgun in the schema as shipped.
2. **Multi-step, non-atomic writes across `ChargingStation` and `ChargingSession` on the stale path.** `handleConnectionClosed`'s stale branch performs, sequentially and unwrapped by any `$transaction`: (a) update the station to `OFFLINE`, (b) record a `STATION_CONNECTIVITY_STALE` audit event, (c) `findMany` affected sessions, (d) for each, `suspendSession` (its own read+write) then a `SESSION_MOVED_OFFLINE` audit event. A crash, connection-pool exhaustion, or unhandled rejection between any two of these steps leaves a state Postgres itself will never flag as inconsistent — e.g., `connectivityStatus: OFFLINE` on the station while its session is still `ACTIVE`, or the station audit event recorded but the session-level one missing. Nothing currently reconciles this after the fact; the only self-healing mechanism (startup reconciliation) only touches the `ChargingStation.connectivityStatus` field, never cross-checks it against session state.
3. **Startup reconciliation is one-directional and coarse.** It forces every `ONLINE` station to `UNKNOWN` on boot, which is correct as far as it goes, but it does not (and structurally cannot, from `ChargingStation` state alone) detect or repair the `ChargingSession`-level fallout of #2 above — a session left `ACTIVE` under a station that reconciliation just marked `UNKNOWN` is not itself re-examined.

`connectivityStatus = OFFLINE` with `lastSeenAt = now` was evaluated and found **not realistically reachable** — `lastSeenAt` is only ever written at connect time, and no code path sets it as part of a close, so the two fields cannot disagree in that specific direction outside of a sub-millisecond race with no observable consequence.

---

## 5. ConnectionRegistry races

```
ConnectionRegistryService  →  ConnectivityCoordinator  →  SessionLifecycleService
      (in-memory, sync)          (async, unserialized)         (async, read-then-write)
```

**RISK ⚠️** — see the dedicated risk matrix (`PR27_RISK_MATRIX.md`) for the full enumeration. Summary answers:

- **Can concurrent reconnects corrupt state?** Not "corrupt" in the sense of an invalid row, but yes to duplicated/lost side effects — see §1 and §3. The in-memory `Map` mutation inside `register()`/`unregister()` is synchronous and race-free by virtue of Node's single-threaded event loop; the problem is entirely on the _async_ side (`notifyConnected`/`notifyClosed` are fired without awaiting or serializing against each other), where nothing prevents two notifications for the same `ocppIdentity` from having their DB round-trips interleave in an order different from the order the events actually happened in.
- **Can stale sweep collide with reconnect?** Structurally difficult today (a swept connection is deleted from the map in the same synchronous step, so it cannot be swept twice, and a genuinely fresh reconnect registers as a new map entry) — but the _notification_ for an old sweep and a _new_ connect can still race on the DB side if a device reconnects within the same event-loop tick the sweep's async write is still in flight, since neither awaits the other.
- **Can duplicate sockets create inconsistent sessions?** Not via the socket-replacement path itself (well-guarded, covered by existing tests: the replaced socket's own late `close` cannot evict the newer record). The inconsistent-session risk instead comes from §1's connector-level race, which duplicate/rapid _reconnects_ are a natural trigger for.
- **Can fire-and-forget hide failures?** Yes, explicitly and intentionally (`AuditService.record` and both `notifyConnected`/`notifyClosed` catch-and-log rather than propagate) — a deliberate design choice to protect the transport layer, but it also means a sustained DB outage affecting only the connectivity path, or a systematic bug causing every recovery to fail, would surface only as a log line with no automated alert. No metric or health check currently observes the failure rate of this pipeline.

---

## 6. Server restart behavior

**PASS ✅** for the specific mechanics tested; **RISK ⚠️** for the operational interaction with recovery windows during a slow restart.

- **What survives:** every persisted field (`ChargingStation.connectivityStatus` and siblings, all `ChargingSession` rows and their status/timestamps) — Postgres is authoritative and untouched by a process restart.
- **What is lost:** the entire in-memory `ConnectionRegistryService.connections` map — every live socket reference, unconditionally.
- **What becomes `UNKNOWN`:** only stations whose persisted `connectivityStatus` was `ONLINE` at boot (`onModuleInit`, `connectivity-coordinator.service.ts:64-74`). `OFFLINE` and pre-existing `UNKNOWN` stations are left as-is — correct, verified by direct code reading (not merely the doc's claim).
- **Is recovery deterministic across a restart?** Yes — the recovery window is computed from the session's persisted `updatedAt`, not from any in-memory state, so a session that went `OFFLINE` before a restart and reconnects after one is evaluated identically to a same-process case. This is a genuine strength worth crediting.
- **Real operational risk not previously flagged:** a restart that takes longer than a session's remaining recovery-window budget (e.g., a rolling deploy holding the process down for several minutes) will cause every session whose window expires during that downtime to fail recovery on the device's next reconnect — indistinguishable from an ordinary window-expiry rejection, but _correlated across every station reconnecting around the same deploy_, not independently random. This interacts directly with §7 and §8's scalability findings below.

---

## 7. Recovery window audit (15 minutes) — document only, no change proposed

- **Residential:** likely adequate for ordinary router reboots; genuinely at risk against longer ISP maintenance windows, which are common and can exceed 15 minutes. No automatic resolution exists once the window lapses (§2) — the session sits `OFFLINE` until a human intervenes.
- **Public charging:** the segment most likely to run on cellular/LTE modems — the connectivity profile most prone to exactly the kind of multi-minute, weak-signal outage the window is not generous for. A stuck-`OFFLINE` session here has direct customer-facing impact (a driver unable to see their session resolve cleanly).
- **Fleets:** depot-style mass plug-in/unplug events concentrate reconnects and disconnects in time, which is exactly the condition that makes §1's and §5's concurrency findings most likely to actually trigger, and also the segment where a single shared-network outage would desynchronize many sessions simultaneously.
- **Commercial parking:** long low-priority sessions (workplace charging) make the _fixed_ 15-minute window arbitrary relative to session duration; a building-network maintenance window exceeding it would strand many sessions from unrelated vehicles at once — a correlated-failure pattern the current per-session, independently-computed window does not model or protect against.
- **Structural point applying to all four segments:** the window is a single hardcoded global value, not tunable per station, per site, or per network profile — already a documented limitation, reaffirmed here specifically because the four segments above have genuinely different appropriate values, not just different edge-case frequencies.

No change to the rule is proposed or implied by this section — informational only, per the work order's instruction.

---

## 8. CAP-005 architecture verdict

| Axis               | Verdict                 | Basis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture       | PASS ✅                 | The four/five-concept separation (WebSocket state / administrative status / operational status / session status / connectivity status) is clean, correctly enforced in code, and matches the documentation exactly. The registry → coordinator → lifecycle seam is a sound, minimal design.                                                                                                                                                                                                                                                   |
| Persistence        | RISK ⚠️                 | Fields and migration are correct and minimal, but no cross-entity atomicity exists across the station+session writes described in §4 — a partial write is possible and currently unrecoverable except by chance.                                                                                                                                                                                                                                                                                                                              |
| Domain model       | RISK ⚠️                 | The five-state connectivity model itself is sound; the gap is at the boundary with `ChargingSessionStatus`, where `OFFLINE` is reachable but not self-idempotent (§3), and the connector-level "at most one non-terminal session" invariant the domain relies on is not actually enforced anywhere (§1).                                                                                                                                                                                                                                      |
| Recovery semantics | RISK ⚠️ leaning FAIL ❌ | The recovery _logic_ (window, conflict check) is correct in isolation and was validated live for the happy path. Under concurrency it is not race-free (§1), and it has no backstop for the clean-disconnect orphan case (§2) that the work order's own literal spec created.                                                                                                                                                                                                                                                                 |
| Observability      | RISK ⚠️                 | Audit events are well-named and correctly scoped when they fire, but fire-and-forget error handling means failures and lost events are silent by design (§5), with no metric or alert surfacing a degraded connectivity pipeline.                                                                                                                                                                                                                                                                                                             |
| Scalability        | RISK ⚠️ leaning FAIL ❌ | Single-instance-only is an accepted, documented constraint, not a new finding. The new finding is `sweepStale()`'s unbounded fan-out: a correlated mass-disconnect event (an upstream network incident affecting many stations behind the same infrastructure) fires an unthrottled burst of concurrent, unawaited DB writes with no batching, concurrency cap, or backpressure — exactly the failure mode most likely at "tens of thousands of stations," and most likely to occur at the worst possible moment (during an actual incident). |

### Overall recommendation

**BLOCK MERGE — pending an explicit ARGOS risk-acceptance decision, not a rewrite.**

Justification: the happy-path implementation is correct and was honestly, rigorously validated live in WO-ARGOS-010 (real boot, real Postgres, real WebSocket, real stale-sweep timing). Nothing in this audit contradicts that validation. But this audit surfaces one finding severe enough to withhold an unconditional APPROVE: **§1's connector-level race can produce two concurrently live `ChargingSession` rows on one connector**, directly contradicting an invariant the code's own comments assert is protected — and that invariant is exactly the kind of thing that degrades from "theoretical" to "occasionally real" once the system operates at the scale this work order explicitly asks the review to assume. The clean-disconnect orphan gap (§2) and the unthrottled mass-disconnect fan-out (§8/Scalability) are the next most significant, both already partially self-disclosed by CAP-005's own documentation as known limitations, but not previously framed in terms of concurrency or fleet-scale correlated failure.

None of these findings require reopening CAP-005's design — they are hardening gaps in an otherwise sound architecture, not evidence the architecture itself is wrong. No fix is proposed or implemented here, per this work order's explicit "review only" mandate. ARGOS's decision is between: (a) accept these as known, documented risks acceptable at current MVP/single-instance scale and approve merge, or (b) require a scoped hardening follow-up (row-level locking or a `$transaction` around the connector-existence check; a backstop sweep for the clean-disconnect orphan case; a concurrency cap on `sweepStale()`'s fan-out) before merge. This document does not recommend which — that is ARGOS's call to make with full information, which is this document's purpose.
