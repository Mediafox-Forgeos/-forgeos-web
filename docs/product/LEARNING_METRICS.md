# Learning Metrics

**Work order:** WO-ARGOS-027 (Operational Learning Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change. Every metric below is defined against [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md)'s signal inventory — a metric that needs a signal tagged `[Needs interaction-history log]` there is named honestly as not-yet-computable, not quietly assumed.
**Mission:** how MOVOS measures whether a recommendation was actually useful — per recommendation type (`ENERGY_ANOMALY`, `AUTH_FAILURE_SPIKE`, `IDLE_CONNECTOR`, `COMPARATIVE_UNDERPERFORMANCE`, `EFFICIENCY_DRIFT`), not just in aggregate, since a threshold that's well-tuned for one type says nothing about another.

## Why per-type, not aggregate

`RecommendationService`'s five methods each have independently-chosen thresholds (`ratio >= 0.5` for `ENERGY_ANOMALY`, `share <= 0.4` for `AUTH_FAILURE_SPIKE`, `minutesSince < 15` for `IDLE_CONNECTOR`, and so on — see [OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md)). A single fleet-wide "acceptance rate" would hide the case where one type is well-calibrated and another is noise — exactly the blend [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 2 warned against. Every metric below is defined as a query grouped by `Action.recommendationType`, with a fleet-wide figure only as a secondary rollup.

## The metrics

### 1. Time to resolution

- **Definition:** median and p90 of `Action.resolvedAt - Action.createdAt`, per `recommendationType`, for `status = RESOLVED` rows only (excludes `DISMISSED` — a dismissal was never "resolved," conflating the two would understate how long real fixes take).
- **Availability:** computable today, from [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 1 — with the same caveat: this measures time from first operator interaction, not from true onset.
- **Reads as useful when:** trending down over time for a given type, or consistently short relative to the recommendation's own stated urgency (a `HIGH`-severity `IDLE_CONNECTOR` sitting unresolved for days is the metric doing its job by surfacing a process failure, not a sign the recommendation itself is bad).

### 2. Recurrence rate

- **Definition:** for a given `(chargingStationId, recommendationType)` pair, the count of `Action` rows created after an earlier one in the same pair was already `RESOLVED`, divided by total resolved actions for that pair — "of the times this was marked fixed, what share of the time did it come back?"
- **Availability:** computable today, from [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 3.
- **Reads as useful when:** low. A high recurrence rate for a given type doesn't necessarily mean the recommendation is wrong — it may mean the _recommended action_ (`Action.recommendedAction`, snapshotted verbatim from `ApiRecommendation`) isn't actually fixing the root cause, e.g. `IDLE_CONNECTOR`'s suggested "contact the driver or dispatch someone" not preventing the next occurrence. This is the clearest signal that a recommendation is correctly detecting a symptom but not yet pointing at a cure.

### 3. Operator acceptance rate

- **Definition:** of every `Action` that reached a terminal state, the share that ended `RESOLVED` rather than `DISMISSED`, per `recommendationType`.
- **Availability:** computable today, from [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 2.
- **Reads as useful when:** high. This is the closest thing MOVOS has today to "was this recommendation worth showing." A type sitting persistently below, say, 50% acceptance is a strong candidate for threshold retuning or removal — the same judgment call [RECOMMENDATION_PRIORITY.md](./RECOMMENDATION_PRIORITY.md) made about which of 20 catalog entries were worth building at all, now made continuously instead of once at launch.

### 4. False-positive rate

- **Definition:** narrower than acceptance rate — the share of `DISMISSED` actions whose `notes` indicate the underlying condition was never actually a problem (as opposed to "real, but not worth fixing right now" or "real, but a duplicate of an existing action").
- **Availability:** **not reliably computable today.** `Action.notes` is free text (see [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 4) — distinguishing "this was never real" from "this was real but I chose not to act" requires reading and classifying the note, not a query. A dismiss reason code (a small fixed enum an operator picks alongside the free-text note — e.g. `NOT_A_PROBLEM` / `ALREADY_KNOWN` / `LOW_PRIORITY` / `OTHER`) would make this directly queryable; that is a schema change and out of scope for this discovery, named here as the concrete gap between "dismissed" (measurable now) and "false positive" (not, without that field).
- **Reads as useful when:** N/A until the reason-code gap above is closed. Until then, acceptance rate (metric 3) is the honest proxy MOVOS actually has.

### 5. Avoided downtime

- **Definition:** the connector-time or station-time that would have been lost had a recommendation not led to a resolution — the clearest "business value" metric and the hardest to compute honestly.
- **Availability:** **not computable, even in principle, without a counterfactual.** MOVOS has no way to observe what _would have happened_ to a station if the operator hadn't acted — there is no control group, no A/B, no parallel timeline. Any number here is an estimate built on an assumption (e.g., "an unresolved `IDLE_CONNECTOR` would have stayed unavailable until the next scheduled site visit"), not a measured fact.
- **Honest proxy:** the closest defensible substitute is **connector-unavailable-time actually observed before resolution** — `Connector.status != AVAILABLE` duration ending at `Action.resolvedAt` — combined with that connector's own historical utilization rate to estimate revenue at risk per hour. This reframes "avoided downtime" as "downtime that was ended sooner than it otherwise would have drifted," which is defensible; claiming a specific dollar figure "saved" is not, and this document does not recommend MOVOS present one as fact.

## Summary table

| Metric                   | Computable today          | Primary gap if not                                                                    |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------------- |
| Time to resolution       | Yes                       | —                                                                                     |
| Recurrence rate          | Yes                       | —                                                                                     |
| Operator acceptance rate | Yes                       | —                                                                                     |
| False-positive rate      | No                        | needs a structured dismiss-reason field, not just free-text `notes`                   |
| Avoided downtime         | No, not even in principle | no counterfactual exists; only a proxy (observed downtime ended sooner) is defensible |

## What this means for the next capability

Three of five metrics are real today, computable from data already in production. The other two are honestly out of reach without either a small, additive schema change (a dismiss-reason enum) or an acknowledged proxy rather than a true measurement. [LEARNING_STRATEGY.md](./LEARNING_STRATEGY.md) weighs this maturity — three real, working metrics against zero-schema Operational Learning work — directly against the alternatives.
