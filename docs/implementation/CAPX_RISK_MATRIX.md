# CAP-X — Risk Matrix

**Work order:** WO-ARGOS-021 (Operator Control Center Implementation Plan)
**Status:** PLANNING ONLY. Estimates below are relative and qualitative — complexity (S/M/L) and effort (day ranges) are planning inputs for a future authorized implementation, not commitments.
**Builds on:** [CAPX_SPRINT_PLAN.md](./CAPX_SPRINT_PLAN.md), [CAPX_COMPONENT_MAP.md](./CAPX_COMPONENT_MAP.md), [CAPX_DATA_DEPENDENCIES.md](./CAPX_DATA_DEPENDENCIES.md).

## Objective 4 — Complexity, risk, dependencies, relative effort

### Scale

- **Complexity:** S (a query/component following an existing, proven pattern in this codebase), M (new logic, but bounded and testable in isolation), L (new logic with cross-cutting correctness requirements — precedence rules, concurrency, or a schema decision).
- **Risk:** Low (failure mode is cosmetic or easily caught in review), Medium (failure mode could ship a subtly wrong number or state), High (failure mode touches tenant isolation, data correctness at the schema level, or has no existing precedent in this codebase to lean on).
- **Effort:** relative day ranges within the 30-day window, not absolute estimates independent of it — a number that would change under a different timeline.

### Sprint 1

| Item                                                      | Complexity | Risk       | Effort         | Key dependency                                                                                                                                                         |
| --------------------------------------------------------- | ---------- | ---------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `StationHealthService.computeHealth()` (single-station)   | **M**      | **Medium** | 2–3 days       | None — but see "Top risks" below; this function's correctness is load-bearing for nearly everything else                                                               |
| Fleet/connectivity aggregation queries                    | **S**      | **Low**    | 1–2 days       | `computeHealth()`'s field reads, not its output — these are separate `groupBy` queries, not calls to the function itself                                               |
| `FleetMap` (extending `SiteMap`)                          | **M**      | **Low**    | 2–3 days       | Existing `SiteMap`/`@vis.gl/react-google-maps` integration (proven, real) — the risk here is UI work (multi-marker, color-coding, click-through), not integration risk |
| Session-read query extensions (active/stuck/energy/table) | **S**      | **Low**    | 2–3 days       | None — straightforward `WHERE`/`GROUP BY` additions to an already-real, already-populated table                                                                        |
| Station detail view                                       | **S**      | **Low**    | 1–2 days       | `computeHealth()`                                                                                                                                                      |
| **Sprint 1 total**                                        |            |            | **~8–13 days** | fits inside the 10-day allocation with margin                                                                                                                          |

### Sprint 2

| Item                                                                                                   | Complexity | Risk       | Effort          | Key dependency                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------ | ---------- | ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration design (`Alert`/`Incident`/`MaintenanceTicket`)                                              | **M**      | **High**   | 2–3 days        | See "Top risks" — the tenant-isolation and FK-shape decisions this migration makes are exactly the category of decision CAP-009's own review found real gaps in on its first pass                             |
| `AlertDetectionService` event wiring                                                                   | **L**      | **High**   | 3–4 days        | Real integration points on `ConnectivityCoordinator`/`SessionLifecycleService` — no existing precedent in this codebase for one domain module reacting to another's internal transitions without modifying it |
| `AlertService`/`IncidentService`/`MaintenanceTicketService` (CRUD + lifecycle)                         | **M**      | **Medium** | 3–4 days        | Migration landed                                                                                                                                                                                              |
| `AttentionQueuePanel`, `IncidentListTable`, `IncidentDetailPanel`, `MaintenanceTicketTable` (frontend) | **M**      | **Low**    | 3–4 days        | Backend services above                                                                                                                                                                                        |
| **Sprint 2 total**                                                                                     |            |            | **~11–15 days** | tightest sprint against its 10-day allocation — see "Top risks"                                                                                                                                               |

### Sprint 3

| Item                                       | Complexity | Risk    | Effort        | Key dependency                                                                    |
| ------------------------------------------ | ---------- | ------- | ------------- | --------------------------------------------------------------------------------- |
| `TrendChart` (energy/session)              | **S**      | **Low** | 1–2 days      | Sprint 1's session-read extensions                                                |
| Failed-session breakdown, average duration | **S**      | **Low** | 1–2 days      | Same                                                                              |
| Instantaneous occupancy                    | **S**      | **Low** | 1 day         | Sprint 1's `FLEET_STATUS` aggregation, filtered differently                       |
| **Sprint 3 total**                         |            |         | **~3–5 days** | comfortable margin inside its 10-day allocation — the slack Sprint 2 doesn't have |

## Top risks, named specifically

### 1. `StationHealth` precedence correctness (Medium, Sprint 1)

[CAP-X_STATION_HEALTH.md](../domain/CAP-X_STATION_HEALTH.md) specifies an explicit precedence order (`maintenance` > `offline` > `unknown` > `degraded` > `healthy`) precisely because naive implementations tend to evaluate conditions independently and pick whichever matches last, silently producing wrong results under the exact "multiple conditions true at once" scenarios the spec calls out (e.g., offline _and_ under maintenance simultaneously). **Mitigation:** implement precedence as an explicit, ordered chain of guards (return on first match), not a set of independent boolean flags resolved by a switch statement — and write a test case for every row in the precedence table, not just the common cases. Nearly every downstream component depends on this function; a bug here propagates silently into the fleet widget, the map, and the station detail view simultaneously.

### 2. Fleet aggregation query performance at scale (Medium, Sprint 1)

The `groupBy`/`count` queries behind `FLEET_STATUS`/`CONNECTIVITY`/`MAP` have never been run against fleet-scale data — this codebase's own precedent (WO-ARGOS-009A's `MeterValue` indexing work, which found and fixed a real performance problem only after testing against synthetic 100K/1M/10M-row data) is a direct warning that a query which looks fine against a handful of dev-seeded stations can behave very differently at real pilot scale. **Mitigation:** before Sprint 1 is called done, run the same kind of synthetic-scale validation WO-ARGOS-009A already established as this codebase's standard — seed a scratch database with a realistic multi-hundred-station fleet and confirm the aggregation queries stay fast, not just correct.

### 3. The Sprint 2 migration's tenant-isolation shape (High, Sprint 2)

CAP-009's own history is the direct precedent here: its first schema pass (WO-ARGOS-017) shipped, was reviewed, and ARGOS's review found three real gaps — a nullable FK that should have been required, an unenforced cross-snapshot invariant, and a wrong `ON DELETE` default — none hidden, all requiring a second hardening pass (WO-ARGOS-017A) to close. `Alert`/`Incident`/`MaintenanceTicket` face the identical category of question (composite tenant-isolation FKs, `ON DELETE` semantics for each relation, whether any field should be required vs. nullable) and there is no reason to assume this migration gets those decisions right on the first pass just because the entities are individually simpler than `BillingAccount`/`TariffSnapshot` were. **Mitigation:** budget for the same two-pass discipline explicitly, rather than assuming Sprint 2 is a single clean migration — the effort estimate above (2–3 days for migration design) should be read as "first pass," with a second hardening pass a realistic, not exceptional, outcome, the same way CAP-009 needed one.

### 4. `AlertDetectionService` event wiring (High, Sprint 2)

This is the one piece of Sprint 2 with no direct precedent elsewhere in this codebase. Every existing cross-module interaction here follows a request/response or direct-call shape (a service calling another service's public method); `AlertDetectionService` needs to _react_ to state transitions happening inside `ConnectivityCoordinator` and `SessionLifecycleService` without those services being redesigned around emitting events for a consumer that didn't exist when they were built. Two failure modes are worth naming explicitly: (a) missing a transition entirely (an alert that should have fired never does — silent, and the worst kind of bug for exactly the anxiety this capability exists to close), and (b) double-firing (the same transition producing duplicate `Alert` rows). **Mitigation:** this is exactly the kind of integration this engagement has consistently insisted be validated against a real boot/real-database/real-simulator environment (CAP-005's own precedent), not unit tests with mocked transitions — Sprint 2's definition of done should require a real simulated fault → real `Alert` row, observed live, not merely a passing unit test asserting the handler was called.

### 5. Real-time refresh strategy is undecided (Medium, cross-cutting)

No sprint above resolves whether Home operacional's live widgets (status strip, attention queue) poll on an interval or use a push mechanism (WebSocket/SSE). This is deliberately left open by [CAPX_COMPONENT_MAP.md](./CAPX_COMPONENT_MAP.md) — it is a real technical decision with real tradeoffs (polling is simpler and matches this codebase's existing patterns everywhere else; push is more responsive but introduces new infrastructure this codebase doesn't have yet) that this planning document should surface, not silently resolve by omission. **Recommendation, not a decision:** start with polling (simplest, lowest-risk, consistent with every other read pattern already in `apps/movos-web`) for the 30-day MVP, and revisit push-based delivery only if polling proves visibly too slow in the actual demo — do not build push infrastructure speculatively inside this window.

### 6. Session table pagination (Low, Sprint 1)

Flagged for completeness, not because it's a real risk: a fleet with meaningful session volume will need `skip`/`take` pagination on the session table from day one, not as a later optimization. This is a Low-risk item only because it's a well-understood, standard pattern — but it must be in Sprint 1's scope from the start, not discovered as a bug when the table is demoed against real accumulated data in Sprint 3.

### 7. The 30-day timeline itself (organizational, not technical)

Named plainly because it is real: this plan has essentially zero slack in Sprint 2 (11–15 days of estimated work against a 10-day allocation) and comfortable slack in Sprint 1 and Sprint 3. If Sprint 2 runs long — the most likely place for slippage, given it carries this plan's only High-risk items — the correct response is to protect Sprint 2's timeline by trimming Sprint 3 (already identified in [CAPX_SPRINT_PLAN.md](./CAPX_SPRINT_PLAN.md) as the lowest-priority, most cuttable sprint), not by compressing Sprint 2's migration/integration work, which is exactly the kind of work this document's other risks argue should not be rushed.

## Summary

| Sprint | Total complexity | Total risk | Effort vs. allocation                      |
| ------ | ---------------- | ---------- | ------------------------------------------ |
| 1      | Low–Medium       | Low–Medium | Comfortable margin                         |
| 2      | Medium–High      | **High**   | Tightest — no slack                        |
| 3      | Low              | Low        | Comfortable margin, first to cut if needed |
