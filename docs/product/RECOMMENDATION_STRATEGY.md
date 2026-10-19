# Strategic Recommendation: Alert/Incident/Maintenance vs. Recommendation Engine

**Work order:** WO-ARGOS-024 (Operational Recommendation Discovery)
**Status:** PRODUCT DISCOVERY. This document makes a recommendation, not a decision — neither path is authorized to start by this document. `Alert`/`Incident`/`MaintenanceTicket` remain unbuilt, as does any recommendation-engine code.
**Question posed:** should Sprint 2 start with (A) Alert/Incident/Maintenance — the path already architected across [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) and scoped in [CAPX_SPRINT_PLAN.md](../implementation/CAPX_SPRINT_PLAN.md) — or (B) a Recommendation Engine, per this work order's discovery?

## Recommendation

**Start with (B), scoped narrowly to the catalog's _Available today_ subset with the highest explainability confidence — specifically #7, #8, #9, and #20 from [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) — shipped with the smallest possible action surface (acknowledge/dismiss, not a full case-management lifecycle).** This is not an unqualified "B over A" — it is a specific, bounded slice of B, chosen because it is simultaneously the cheapest thing to build, the hardest thing for a competitor or a manual process to replicate, and the thing this discovery can state with the most confidence actually works, all three at once. Full Alert/Incident/Maintenance work — and the harder half of the Recommendation catalog — both remain real, both still need the same missing status-history log first, and neither is displaced by this recommendation, only sequenced after it.

## Customer value

- **Option A's value is closing a gap this engagement already found and named.** [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) Task 5 demonstrated, with a lived example, that today's product can say something is wrong and, after digging, what — but offers no in-app way to act. Alert/Incident closes exactly that gap. Real value, already evidenced.
- **Option B's value is a different, additive kind: surfacing facts that were never visible at all**, not just making a known fact actionable. [RECOMMENDATION_VALUE.md](./RECOMMENDATION_VALUE.md) identifies five recommendations (#7, #9, #11, #12, #20) that meet a materially higher bar — an operator literally could not have found them manually, not merely found them slower.
- **These are not competing claims on the same value** — Option A makes existing visibility actionable; Option B creates visibility that didn't exist. A network operator ultimately needs both. The question is only which one a resource-constrained Sprint 2 builds first.

## Technical complexity

This is where the two options diverge sharply, and where [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s central finding does real work:

- **Option A's very first step is a migration.** Even the smallest defensible `Alert`/`Incident`/`MaintenanceTicket` slice ([CAPX_SPRINT_PLAN.md](../implementation/CAPX_SPRINT_PLAN.md) Sprint 2) requires new schema before any of it can run — and [CAPX_RISK_MATRIX.md](../implementation/CAPX_RISK_MATRIX.md) already flagged that slice as this whole program's highest-risk, tightest-margin work (11–15 days of estimated effort against a 10-day allocation, precisely because of the tenant-isolation and event-wiring risk a new domain module carries).
- **Option B's four-item recommended slice (#7, #8, #9, #20) needs zero new schema.** Every one of them is an aggregation query over `ChargingSession`, `AuthorizationAttempt`, or `MeterValue` — tables that are already real, already populated, and already event-sourced by construction. This is the same category of work Sprint 1's own operator module already proved out (new read-only aggregation over existing tables, no migration) — not a hypothetical estimate, a repeated pattern.
- **Neither option's _hardest_ half is cheap.** The `FLAPPING_CONNECTOR`/`HIGH_FAILURE_RATE` triggers Option A deferred out of Sprint 1, and the seven _[Needs status-history log]_ recommendations in Option B's own catalog, are blocked on the exact same missing piece — a connector/connectivity status-transition log neither path has built yet. This document does not pretend Option B is cheap everywhere; it is cheap specifically in the four-item slice being recommended.

**On this dimension: Option B's recommended slice wins decisively — lower risk, no schema change, a proven build pattern.**

## Commercial differentiation

- **Option A (a working ticket list) is not hard for a competitor to copy.** Detection-plus-case-tracking is a well-understood pattern; any charging-network software with basic device telemetry can build something that looks like it.
- **Option B's strongest items are harder to copy, structurally, not just by effort.** #20 (efficiency drift) and #11 (comparative underperformance) require real historical operating data at fleet scale to even be _possible_ — a competitor entering the market today has no six-week telemetry history to trend against, no matter how good their engineering is. This is the one form of moat available to an operations platform that isn't purely a function of engineering speed: accumulated real usage data. [CAPX_INVESTOR_DEMO.md](./CAPX_INVESTOR_DEMO.md) already made a version of this argument about MOVOS's hardened data foundation being a strong "tomorrow" story for an investor; the Recommendation Engine is the first capability that turns that foundation into a customer-facing differentiator rather than only an infrastructure claim.

**On this dimension: Option B wins, and for a structural reason (data accumulation), not just a product-design one.**

## Operational urgency

- **This is the one dimension where Option A has a real, undiminished claim.** The usability review's sharpest single finding was "no in-app way to act" — and a recommendation engine without any action surface at all reproduces exactly that complaint in a new form: a system that tells an operator something is wrong and still offers nothing to click. This is not a hypothetical risk — it is the same failure mode the existing, non-functional `/alerts` mock page already demonstrates today (real-looking buttons, [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) confusion finding #3), and shipping a second version of that failure under a different name would be a regression in trust, not an improvement.
- **This is why the recommendation above is not "B, unconditionally."** It is "B, with a minimal acknowledge/dismiss action" — deliberately smaller than `Incident`'s four-stage lifecycle (no assignment, no resolution notes, no formal closure), but not nothing. An operator needs to be able to say "seen, handled" and have that stick, even if the underlying work of dispatching a technician still happens outside the product for now, exactly as it does today per the usability review's own Task 5.

**On this dimension: genuinely mixed** — urgency favors having _some_ action surface immediately, which is why the recommended scope includes one, but does not favor building the full case-management system first.

## Summary

| Dimension                  | Favors                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Customer value             | Both, differently — A closes a known gap, B creates new visibility                       |
| Technical complexity       | B's recommended slice (zero migration vs. A's required one)                              |
| Commercial differentiation | B (harder to copy; depends on accumulated real data)                                     |
| Operational urgency        | Mixed — resolved by giving B's slice a minimal action surface, not by choosing A instead |

**Recommendation: B, scoped to #7 (energy anomaly), #8 (idle connector), #9 (authorization failure spike), and #20 (efficiency drift), each shipped with a minimal acknowledge/dismiss action — not the full catalog, and not a substitute for Alert/Incident/Maintenance, which remains real, still-needed work.**

## What this recommendation does not say

- It does not say Alert/Incident/Maintenance is wrong or should be abandoned — [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) remains a correct architecture for the case-management need this document agrees is real. It says a specific, narrower, cheaper, more differentiated slice of the Recommendation Engine should be built first.
- It does not recommend building all 20 catalog entries, or even all 12 _Available today_ ones — only the four with the strongest combination of confidence (HIGH or high-MEDIUM), urgency (P0), and existential value ([RECOMMENDATION_VALUE.md](./RECOMMENDATION_VALUE.md)'s five, minus #11/#12 which are P1, not P0).
- It does not resolve what comes after this slice. The natural next candidates, on this discovery's own evidence, are: (1) the status-history log itself, which unblocks both the remaining _[Needs status-history log]_ recommendations _and_ Option A's `FLAPPING_CONNECTOR`/`HIGH_FAILURE_RATE` triggers simultaneously — the single highest-leverage piece of infrastructure named across this entire discovery — and (2) `Alert`/`Incident`/`MaintenanceTicket` itself, once that log exists to feed its sharpest triggers. That sequencing question is for a future work order.
- It does not authorize any implementation. Per WO-ARGOS-024's explicit constraints, no code, API, migration, or `schema.prisma` change has been made, and no `Alert`, `Incident`, or `MaintenanceTicket` work has started. Neither does the Recommendation Engine start without separate, explicit ARGOS authorization.
