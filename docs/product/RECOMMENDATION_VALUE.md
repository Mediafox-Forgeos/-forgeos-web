# Recommendation Value — "I Cannot Operate My Network Without MOVOS"

**Work order:** WO-ARGOS-024 (Operational Recommendation Discovery)
**Status:** PRODUCT DISCOVERY.
**Built from:** [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md), [RECOMMENDATION_PRIORITY.md](./RECOMMENDATION_PRIORITY.md).

## The question, sharpened

Not "which recommendations are useful" — most of the catalog clears that bar. The question is which ones an operator, once they'd had them for a month, would genuinely miss if MOVOS took them away — not "that was nice" but "I would not have caught this myself." Those two reactions come from different sources of value, and conflating them overstates the case for the weaker half of the catalog.

## The distinction: invisible facts vs. faster access to visible facts

Most of what a dashboard does — even a very good one, like Sprint 1's — makes something an operator _could_ already find, faster to find. Knowing "1 station is offline" a few seconds sooner than clicking through three screens (per [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md)'s own Task 2) is real value, but it's a speed improvement on a fact the operator already had access to. An operator without that dashboard is slower, not blind.

A smaller set of recommendations in the catalog do something categorically different: they surface a fact **that was never visible to a human at all**, either because the underlying data was never displayed anywhere (nothing in MOVOS today shows `AuthorizationAttempt` in aggregate, ever — it has existed since CAP-004 and no screen has ever summarized it), or because the pattern only exists across a span of time or a number of entities wider than a person holds in working memory while doing something else. Those are the ones this document argues actually earn the sentence in the title.

## The recommendations that clear that bar

### #20 — Efficiency drift (predictive maintenance)

An 18% power decline across six weeks, hidden inside per-session telemetry nobody reviews individually, is not a fact any operator is going to notice by looking at a dashboard — noticing it requires remembering last month's numbers precisely enough to compare them against this month's, for every station, continuously. That's not a task a busy person does; it's a task a system does. This is the single strongest candidate in the catalog: it converts an entire category of maintenance spend from reactive (wait for the fault, then an emergency truck roll) to planned (a scheduled visit before the fault), and no manual process at any real fleet size makes that conversion reliably.

### #9 — Authorization failure spike

Nothing in this product, or in the operator's own mental model of their business, currently treats `AuthorizationAttempt` as something worth looking at in aggregate — every rejected tap is logged (CAP-004's own design intent) and then never seen again by anyone. A station quietly turning away a growing share of legitimate drivers because of a failing reader is, today, completely invisible — not slow to find, invisible. Surfacing it is not a speed improvement on an existing workflow; it's a new fact entering the operator's world that wasn't there before.

### #7 — Energy delivery anomaly within a session

Catching a connector delivering well under its rated power _while a session is still running_ requires watching live telemetry per connector, at a resolution and continuity no operator does manually across more than a handful of chargers. A connector that "sort of works" — starts sessions, delivers _some_ power, never trips a hard fault — is exactly the failure mode most likely to go unnoticed for months under manual operation, quietly costing revenue and driver trust the whole time.

### #11 — Comparative underperformance vs. peers

An operator with three stations at one site could plausibly notice one underperforming by eye. An operator with forty sites cannot hold forty stations' relative throughput in their head simultaneously — this is precisely the kind of cross-entity comparison that scales badly for a human and trivially for a query. The value compounds with fleet size, which is also exactly the direction a growing, paying customer moves.

### #12 — Congestion redistribution

Same shape as #11, applied to real-time load instead of trailing throughput: knowing that one station at a site is saturated while its sibling sits idle, continuously, across every site an operator runs, is a fleet-wide simultaneous-attention problem no person performs unprompted.

## The recommendations that don't quite clear it, and why that's fine

Not a criticism of the catalog — these remain genuinely useful, just via the other kind of value (faster access, not new visibility):

- **#4 (low utilization), #17 (credential expiry), #19 (idle fleet-wide window)** are all facts a sufficiently diligent operator with a spreadsheet and enough spare time _could_ reconstruct manually. MOVOS doing it automatically is a real convenience and a real time-saver, not a new category of insight.
- **#8 (idle connector after completion)** is a genuinely important P0 catch, but it's closer to "the dashboard should have shown this and currently doesn't" than "no human process could ever find this" — it's a gap-closing fix (in the same spirit as WO-ARGOS-023's session-link fix) more than a differentiator.

This isn't a demotion — [RECOMMENDATION_PRIORITY.md](./RECOMMENDATION_PRIORITY.md) still rates several of these P0/P1 on urgency. It's a separate claim: urgency and existential-dependency are not the same axis, the same way urgency and buildability aren't (per [RECOMMENDATION_PRIORITY.md](./RECOMMENDATION_PRIORITY.md)'s own opening section).

## The pattern across the five that qualify

Every one of the five — #7, #9, #11, #12, #20 — shares two properties, not by coincidence:

1. **They read data nobody currently looks at, or compare entities nobody currently compares.** `AuthorizationAttempt` aggregates, in-session telemetry trends, and cross-station comparisons are not things any existing MOVOS screen shows, let alone something an operator tracks by hand.
2. **Their value grows with fleet size**, which means they get _more_ indispensable exactly as a customer becomes more valuable to retain — a one-station pilot barely needs comparative-underperformance detection; a forty-site network operator cannot function without something like it.

Neither property is true of a basic status dashboard, which is precisely why "is anything offline" (real, useful, already shipped in Sprint 1) doesn't produce the sentence in this document's title, and #20/#9/#7/#11/#12 plausibly do.

## What this means for Sprint 2

Three of these five (#7, #9, #20 — see [RECOMMENDATION_EXPLAINABILITY.md](./RECOMMENDATION_EXPLAINABILITY.md)) are HIGH or MEDIUM confidence and buildable today with zero new schema, per [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s own tagging. That combination — genuinely hard to replicate manually, and cheap to build right now — is the strongest possible case for where Sprint 2's differentiated value actually lives, addressed directly in [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md).
