# Work Order Automations

**Work order:** WO-ARGOS-033 (Operational Work Orders)
**Status:** RULES DEFINED, NOT IMPLEMENTED — per this work order's own explicit instruction. No code, API, migration, or scheduled job exists or is proposed to be created by this document. Every rule below is a specification for a future implementation work order to build against, in the same way [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md) is a specification, not a migration.
**Mission:** the three automation rules that create and escalate `WorkOrder`s without a human having to notice a problem first.

## Why these rules matter more than they might look

Every rule below exists to close a gap this engagement already found and named with real evidence, not a hypothetical one:

- Rule 1 closes [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md)'s sharpest finding — "a station going offline never becomes a tracked case at all."
- Rule 2 closes part of [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #1 (technician dispatch) — a critical problem sitting unassigned is itself a failure mode worth naming automatically.
- Rule 3 is the automation layer's own answer to [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6 (notification delivery) — with an honest ceiling on what "escalate" can mean until that gap is actually closed.

## Rule 1 — Connectivity loss > 15 minutes → create work order

**Trigger:** a `ChargingStation`'s `connectivityStatus` has been `OFFLINE` continuously for more than 15 minutes, and no open (`OPEN`/`ASSIGNED`/`IN_PROGRESS`/`BLOCKED`) `WorkOrder` with `source = CONNECTIVITY_LOSS` already exists for that station.

**Why 15 minutes, specifically:** this is not an arbitrary new threshold — it's the exact window `ConnectivityCoordinatorService` already uses for a related purpose. CAP-005's own reconnect-recovery logic gives a station 15 minutes to reconnect before treating a disconnection as consequential (`docs/domain/CAP-005_CONNECTIVITY_ENGINE.md` — "a verified reconnect within a 15-minute window recovers it"). Reusing the same number here means a `WorkOrder` is only created for exactly the disconnections CAP-005 already treats as real, not a second, uncoordinated threshold that could disagree with the first.

**Where this would hook in:** the natural implementation point is `ConnectivityCoordinatorService` itself, or a scheduled check reading `ChargingStation.connectivityStatus`/`lastDisconnectedAt` directly — either is a legitimate implementation choice for a future work order to make; this document specifies the trigger condition, not the mechanism.

**What the created `WorkOrder` looks like:**

- `source`: `CONNECTIVITY_LOSS`
- `priority`: `HIGH` by default (see the open question below on whether this should ever be `CRITICAL`)
- `title`/`description`: template-generated (e.g., "Estación {name} sin conexión desde {lastConnectedAt}")
- `stationId`: the offline station; `connectorId`: null (a connectivity loss is station-scoped, not connector-scoped)
- `incidentId`: null — a connectivity loss has no upstream `Action`/recommendation, since none of `RecommendationService`'s five detectors trigger on connectivity loss alone
- `createdBy`: a system/automation identity, not a real operator — see "the createdBy question" below

**Guard against duplicate creation:** the "no open `WorkOrder` already exists for this station+source" check is load-bearing — without it, a station that stays offline across multiple automation check cycles would spawn a new `WorkOrder` every cycle. This mirrors `ActionService.findRelevant()`'s own duplicate-prevention discipline (reuse an existing non-terminal row instead of creating a second one for the same live problem).

## Rule 2 — Critical recommendation → require assignment

**Trigger, as literally stated:** a "critical recommendation" produces a `WorkOrder` that must be assigned. **The open question this document has to surface rather than silently resolve:** `RecommendationSeverity` today has exactly two values, `HIGH` and `MEDIUM` — there is no `CRITICAL` tier in the Recommendation Engine, only in `WorkOrder.priority`. Before this rule can be implemented as literally stated, one of two decisions has to be made, and this document does not make it unilaterally:

- **Option A:** `RecommendationSeverity` gains a third value, `CRITICAL`, and `RecommendationService`'s detectors are revisited to decide which conditions (if any) warrant it over `HIGH` — a real change to a component WO-ARGOS-025 built and this work order's constraints don't authorize touching.
- **Option B:** "critical recommendation" is read as "a `HIGH`-severity recommendation of a specific type judged safety- or revenue-critical" (e.g., `ENERGY_ANOMALY` above a steep threshold), and the resulting `WorkOrder` is created with `priority: CRITICAL` even though the source `Action`'s own `severity` stays `HIGH` — i.e., `WorkOrder.priority` and `Action.severity` are related but not required to be equal.

This document recommends **Option B** — it requires no change to the Recommendation Engine, and it matches [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)'s own framing that `WorkOrder` is a new layer downstream of `Action`, not a passthrough of its fields — but names Option A explicitly so ARGOS can overrule that recommendation before an implementation work order builds against it.

**"Require assignment," concretely:** a `CRITICAL`-priority `WorkOrder` that has been in `OPEN` status for longer than a short grace period (proposed: 15 minutes, matching Rule 1's window for consistency) triggers the same escalation behavior as Rule 3 below — being unassigned is treated as its own kind of SLA breach, on the assignment clock rather than the resolution clock. This is why [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md) computes `dueAt` only from `assignedAt`, not `createdAt` — a `CRITICAL` order sitting unassigned needs its own, shorter-fused alarm, separate from the resolution SLA that hasn't started yet.

## Rule 3 — SLA exceeded → escalate

**Trigger:** `now() > dueAt` for any `WorkOrder` whose `status` is not `RESOLVED` or `CANCELLED`.

**What "escalate" honestly means today, given [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6:** no outbound notification channel exists anywhere in MOVOS — the console's own notification bell (WO-ARGOS-031) is in-app only. This document defines escalation at the ceiling of what's actually achievable without that gap closing first:

1. **A `WorkOrderEvent{type: SLA_BREACHED}` is written** the moment the breach is detected, once, not repeated on every check cycle — a permanent record that the SLA was missed, independent of whatever happens afterward.
2. **The `WorkOrder` is visually flagged as overdue** wherever it's displayed — the `/work-orders` list's "overdue" filter ([WORK_ORDER_UI.md](./WORK_ORDER_UI.md)) already depends on exactly this computed fact (`dueAt` in the past, status non-terminal).
3. **Nothing is sent to anyone.** A real escalation — paging a supervisor, auto-reassigning to a different technician, notifying the customer — all depend on gap #6 (notification delivery) being closed first. Defining Rule 3 to promise more than this would describe a capability that doesn't exist.

**The honest conclusion:** Rule 3, as buildable today, is closer to "surface the breach clearly" than "escalate" in the fuller sense the word implies. This isn't a failure of the rule's design — it's the same discipline this whole document applies throughout: define what's real, name what depends on something else being built first, and don't blur the two.

## The `createdBy` question for automated `WorkOrder`s

`WorkOrder.createdBy` is a required `User` reference ([WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)) — but Rule 1 and the escalation half of Rule 2 create/flag `WorkOrder`s with no human operator initiating the action. Two honest options, again left open rather than resolved unilaterally: a real system/service-account `User` row dedicated to automation (traceable, but adds a synthetic identity to a table that's otherwise entirely real people), or making `createdBy` nullable specifically for automated creation (simpler, but weakens the "every `WorkOrder` has a real accountable creator" invariant [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md) otherwise holds). This document flags the question rather than picking an answer, the same way it flagged the `CRITICAL`-severity question in Rule 2 — both are real design decisions an implementation work order needs a clear answer to, not something this design pass should quietly decide on ARGOS's behalf.

## Summary table

| Rule                       | Trigger                                                             | Creates or affects                                                                                   | Open question                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Connectivity loss       | Station `OFFLINE` > 15 min (matches CAP-005's own reconnect window) | Creates a `WorkOrder`, `source: CONNECTIVITY_LOSS`                                                   | Mechanism (hook vs. scheduled check) left to implementation                                                                                   |
| 2. Critical recommendation | A `HIGH`-severity recommendation judged critical                    | Creates a `WorkOrder`, `priority: CRITICAL`; unassigned past 15 min triggers Rule-3-style escalation | Whether `RecommendationSeverity` needs a real `CRITICAL` tier, or `WorkOrder.priority` diverges from it (this document recommends the latter) |
| 3. SLA exceeded            | `now() > dueAt`, non-terminal status                                | Logs a `WorkOrderEvent`, flags the order overdue                                                     | "Escalate" is capped at in-product visibility until notification delivery ([PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6) exists       |
