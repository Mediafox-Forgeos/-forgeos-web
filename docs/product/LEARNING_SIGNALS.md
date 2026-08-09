# Learning Signals

**Work order:** WO-ARGOS-027 (Operational Learning Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change. Nothing below is an implementation — it is an inventory of what MOVOS could learn from, and an honest accounting of what it can already learn from **today**, using only the `Action`/`Recommendation` surface [WO-ARGOS-025](../implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md) and [WO-ARGOS-026](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md) already shipped.
**Mission:** every signal MOVOS can learn from, given what an operator's interaction with a recommendation actually leaves behind in the database right now.

## A finding that shapes every signal below

`Action` (WO-ARGOS-026) is a single mutable row per station/recommendation-type occurrence, not a history log. `status`, `assignedToUserId`, and `snoozedUntil` each hold only their **current** value — every prior value a transition overwrote is gone. `notes` is written exactly once, only on the terminal transition (`resolve`/`dismiss`); the four non-terminal transitions (`acknowledge`, `assign`, `snooze`) leave no note at all. No transition writes an `AuditEvent` row either (confirmed: `ActionService` never calls `audit.service.ts`), so there is no independent log to reconstruct what got overwritten.

This is the same shape of gap [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) found across the connectivity/status tables it surveyed: some data is already event-sourced by construction (`ChargingSession`, `AuthorizationAttempt`, `MeterValue`, and now — usefully — every terminal `Action`, since `createdAt`/`resolvedAt`/`status`/`notes` on a _finished_ row are permanent, immutable facts once written). Other data is current-state-only and silently loses history the moment it's overwritten (`Action.assignedToUserId`, `Action.snoozedUntil` mid-lifecycle).

Each signal below is tagged **[Available today]** or **[Needs interaction-history log]** on that basis. This tag is load-bearing for [LEARNING_METRICS.md](./LEARNING_METRICS.md), [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md), and [LEARNING_STRATEGY.md](./LEARNING_STRATEGY.md) — a strategy that assumes reassignment history exists today would be planning against data that isn't there.

## The signals

### 1. Resolution time — _[Available today]_

- **What it is:** how long a real problem sat between an operator first touching it and it being closed.
- **Data source:** `Action.resolvedAt - Action.createdAt`, for every row where `status` is `RESOLVED` or `DISMISSED`.
- **Honest caveat:** `createdAt` is the moment of the operator's **first interaction**, not the moment the underlying condition first appeared — `RecommendationService` is stateless and never records when a recommendation first became true (see [OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md)). This signal measures **operator responsiveness once alerted**, not total problem duration. Measuring the latter would require `RecommendationService` to persist a first-observed timestamp per condition — out of scope here, named as a gap in [LEARNING_METRICS.md](./LEARNING_METRICS.md).
- **What it would tell MOVOS:** which recommendation types operators act on quickly vs. let sit; whether resolution time is trending up (a growing backlog) or down (the team is keeping pace).

### 2. Dismissed recommendations — _[Available today]_

- **What it is:** every `Action` an operator judged not worth acting on.
- **Data source:** `Action.status = 'DISMISSED'`, with `Action.notes` (required on dismiss) as the stated reason, grouped by `Action.recommendationType`.
- **What it would tell MOVOS:** a recommendation type with a high dismiss rate relative to its resolve rate is either miscalibrated (its trigger threshold is too sensitive — see the tunable thresholds named in [OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md), e.g. `ratio >= 0.5` for `ENERGY_ANOMALY`) or is flagging something real that operators have already decided isn't actionable at this org. Distinguishing those two cases needs signal 4 (operator notes), not just the count.

### 3. Recurring failures — _[Available today]_

- **What it is:** the same station reproducing the same underlying condition after it was already closed once.
- **Data source:** multiple `Action` rows sharing `(chargingStationId, recommendationType)`, ordered by `createdAt`. This is directly queryable because `ActionService.findRelevant()` already treats a fresh occurrence — one outside the 60-minute cooldown — as eligible for a brand-new row (see [OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md)'s cooldown-window section) rather than reusing the old one; each recurrence is a genuinely separate row, not a state mutation of the first.
- **What it would tell MOVOS:** a station whose `IDLE_CONNECTOR` action gets resolved every week is not "resolved" in any durable sense — it's a chronic condition being repeatedly patched. This is the raw material for [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md)'s "chronic stations" question.

### 4. Operator notes — _[Available today, terminal transitions only]_

- **What it is:** the free-text explanation an operator gives when closing an `Action`.
- **Data source:** `Action.notes`, required on `resolve` and `dismiss`, absent on `acknowledge`/`assign`/`snooze` (those transitions carry no text field at all today).
- **Honest caveat:** this is unstructured natural language with no taxonomy — "reader firmware needed reset" and "cable was loose, reseated" both land in the same free-text column with no shared vocabulary between them. Extracting a pattern across notes (see [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md)) means reading text, not querying a field.
- **What it would tell MOVOS:** the _why_ behind a resolution or dismissal that no structured field captures — the actual root cause an operator found, which is exactly the knowledge [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md) is built to not let evaporate.

### 5. Reassignment frequency — _[Needs interaction-history log]_

- **What it is:** how often an `Action` gets handed from one operator to another before it's resolved.
- **Data source today:** none. `Action.assignedToUserId` holds only the current assignee; a second `assign` transition silently overwrites the first with no record either row ever existed. `updatedAt` moves, but it moves on every transition (acknowledge, snooze, assign alike), so it cannot distinguish "reassigned" from "snoozed again."
- **What it would take:** a lightweight transition-history table — one row per transition instead of one row per `Action` — the same category of gap [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) already named as "Needs status-history log" for `Connector`/`Evse` status. This document does not propose that schema (out of scope per WO-ARGOS-027's own restrictions); it names the gap so [LEARNING_STRATEGY.md](./LEARNING_STRATEGY.md) evaluates it with eyes open rather than assuming the data is already there.
- **What it would tell MOVOS, once available:** an `Action` type that gets reassigned often is either being routed to the wrong first responder, or nobody actually owns that class of problem — both are process signals, not technical ones.

### 6. Repeated actions — _[Available today, partially]_

- **What it is:** an operator's own behavioral pattern — does the same person always resolve `AUTH_FAILURE_SPIKE` the same way, always dismiss `COMPARATIVE_UNDERPERFORMANCE` without acting, always self-assign a given recommendation type?
- **Data source:** `Action.assignedToUserId` (only the final assignee is known, per signal 5's caveat) joined against `Action.recommendationType` and `Action.status`, across all of an org's closed `Action` rows.
- **Honest caveat:** this reads _closed_ rows' final state only — it cannot see how many times a given operator touched an `Action` before someone else closed it (that's signal 5's gap again). What's available is coarser: "of the actions User X ultimately resolved, N were `AUTH_FAILURE_SPIKE`" — attribution of outcomes, not full behavioral sequence.
- **What it would tell MOVOS:** the basis for "best operators" in [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md) — who reliably closes which kind of problem, which is also the basis for smarter default routing if MOVOS ever auto-suggests an assignee.

### 7. Station behavior — _[Available today]_

- **What it is:** a station's aggregate `Action` history as a behavioral fingerprint, not just individual recurring incidents (signal 3).
- **Data source:** all `Action` rows for one `chargingStationId`, across every `recommendationType`, over the station's lifetime — count, severity mix (`HIGH` vs `MEDIUM`), average resolution time (signal 1) relative to fleet average, dismiss rate (signal 2) relative to fleet average.
- **What it would tell MOVOS:** a station with a high count of `HIGH`-severity, slow-to-resolve actions across _multiple_ recommendation types is a structurally different problem than a station with one recurring `MEDIUM` issue — the former is a candidate for replacement ([RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) #10, "station approaching end-of-life"), the latter for a targeted fix. This is the station-level rollup [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md) needs to answer "chronic stations" with a ranked list rather than an anecdote.

## Summary table

| Signal                    | Availability                    | Primary source field(s)                                     |
| ------------------------- | ------------------------------- | ----------------------------------------------------------- |
| Resolution time           | Available today                 | `Action.createdAt`, `Action.resolvedAt`                     |
| Dismissed recommendations | Available today                 | `Action.status = DISMISSED`, `Action.notes`                 |
| Recurring failures        | Available today                 | `Action.chargingStationId` + `.recommendationType`, grouped |
| Operator notes            | Available today (terminal only) | `Action.notes`                                              |
| Reassignment frequency    | Needs interaction-history log   | none today                                                  |
| Repeated actions          | Available today, partial        | `Action.assignedToUserId` (final value only)                |
| Station behavior          | Available today                 | all `Action` rows per station, aggregated                   |
