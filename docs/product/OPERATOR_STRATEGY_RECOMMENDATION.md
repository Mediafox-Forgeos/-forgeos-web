# Strategic Recommendation: CAP-010 vs. CAP-X

**Work order:** WO-ARGOS-018 (CAP-X Discovery — Operator Control Center)
**Status:** PRODUCT DISCOVERY. This document makes a recommendation, not a decision — CAP-X is not authorized to start by this document, and CAP-010 remains registered but not started, exactly as it was left after PR #35 (tag `CAP-009_DOCUMENTATION_COMPLETE`). ARGOS's review is the decision point.
**Question posed by the work order:** should MOVOS build (A) CAP-010 — Invoice & Ledger Architecture, or (B) CAP-X — Operator Control Center, next?

## Recommendation

**Build CAP-X — Operator Control Center next, scoped to its P0 modules only** (charger-monitoring rollup, the attention queue, and the real-time map — see [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md)). Defer CAP-010 — not indefinitely, but past this capability, and past one additional prerequisite named below that CAP-010 needs regardless of this recommendation.

This is not a close call on three of the four evaluation dimensions below; it is close only on commercial value, and even there the deciding factor is a dependency CAP-010 has on work that hasn't started, independent of CAP-X entirely.

## Evaluation

### Commercial value

Both capabilities ultimately serve revenue, but by different mechanisms and on different timelines:

- **CAP-010's commercial value is currently unrealizable.** Invoice & Ledger architecture would design how a priced `ChargingSession` becomes an invoice — but no `ChargingSession` is priced today. `TariffSnapshot` is real schema (CAP-009), but nothing populates it: no `Tariff` (rate-setting) model exists, no pricing service exists, and Architecture Backlog entry #24 (Tariffs) itself lists "the exact snapshot-triggering rule," "the energy-attribution rule," and "which clock governs pricing" as still-open decisions no capability has resolved yet. Designing an invoice/ledger architecture against sessions that have no price is designing the back half of a pipeline whose front half doesn't exist — the same category of sequencing risk this engagement already corrected once, in WO-ARGOS-017A, when `ChargingSession.billingAccountId`'s nullability was found to not match its own approved invariant. Commercial value realized by CAP-010 is bounded above by zero until pricing exists, regardless of which capability MOVOS builds next.
- **CAP-X's commercial value is immediate and already quantifiable from real gaps.** [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 8 (stuck/offline sessions) describes a state — a session in `OFFLINE` past the 15-minute reconnect window — that is, in the plainest commercial terms, a charger an operator cannot bill, cannot free up for the next customer, and cannot explain to the driver standing next to it, for however long it goes unnoticed. Every day this is invisible is lost throughput on infrastructure that has already been paid for. That value is realized the day the attention queue ships, not after a future pricing capability also ships.

**On this dimension: CAP-X wins outright**, and CAP-010's own commercial case is weaker than its name suggests until Tariffs (Architecture Backlog #24) is separately built — a dependency this recommendation did not need to invent; it was already documented as open in the backlog entry itself.

### Operational value

[OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) is the direct evidence here: across all five named customer shapes (network operator, electrolinera, condominium, mall, fleet, construction), not one names "review today's invoices" as a first-screen daily action. Every one of them names some variant of "is my equipment working" and "does anything need me right now." Billing/invoicing is a periodic (weekly/monthly) operational rhythm; the Control Center's P0 modules are a daily, sometimes hourly, rhythm.

CAP-X also directly closes the two sharpest anxieties this discovery surfaced — the `ONLINE`/`OFFLINE`/`UNKNOWN` ambiguity and the stuck-`OFFLINE`-session state — both of which are structural products of CAP-005's own design (a deliberate, correct design; the gap is that nothing surfaces its output to a human yet). CAP-010 has no analogous "we already built the hard part, we just haven't surfaced it" story — its hard part (pricing logic) has not been built at all.

**On this dimension: CAP-X wins outright.**

### Implementation complexity

- **CAP-X's P0 scope is aggregation and presentation over already-hardened data.** Every real-time signal named in [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) and priced into a widget in [OPERATOR_DASHBOARD.md](./OPERATOR_DASHBOARD.md) already exists as a schema field that has been through ARGOS review at least once (CAP-002 through CAP-005). No new domain entity is required for the P0 tier specifically — charger monitoring, the attention queue, and the map read `ChargingStation`/`Evse`/`Connector`/`ChargingSession` state that already exists; they do not need a new migration to ship a first version. (The status-history log gap named in [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) affects three _P1_ KPIs — Uptime, Utilization, Maintenance recurrence — not the P0 dashboard tier this recommendation scopes CAP-X to.)
- **CAP-010 is comparatively high-complexity and high-blast-radius by nature.** It is financial-ledger design — correctness failures here mean wrong money, not a missing widget. CAP-008's own threat model (7 financial-integrity threats) and CAP-009's hardening cycle (three real invariant gaps found and closed by ARGOS's own review) are direct evidence from this engagement's own history that billing-adjacent work requires more scrutiny per unit of scope than infrastructure-visibility work does. Building CAP-010 before Tariffs exists compounds this: it would either have to invent placeholder pricing assumptions (a known anti-pattern per this engagement's own "do not over-engineer, do not invent unneeded fields" discipline) or leave its own deliverables partially theoretical, the way CAP-008 initially did before CAP-009 materialized it — except CAP-010 would have no CAP-009-equivalent scheduled next to materialize it, because Tariffs (#24) still isn't built.

**On this dimension: CAP-X wins outright** — lower risk, no new financial surface, and it ships against data that has already survived ARGOS review once.

### Customer urgency

All five customer shapes named in the work order (network operator, electrolinera, condominium, mall, fleet, construction) are described as needing to know, every day, whether their infrastructure is working — none are described as needing daily invoicing. Billing matters to all of them, but as a monthly reconciliation concern, not a daily trust concern. A customer who cannot trust that MOVOS will tell them when a charger is stuck will not trust an invoice MOVOS generates from the same system, regardless of how well-architected that invoice is — trust in operational visibility is a prerequisite for trust in billing accuracy, not a parallel, independent track.

**On this dimension: CAP-X wins outright.**

## Summary

| Dimension                 | Favors                                                                          |
| ------------------------- | ------------------------------------------------------------------------------- |
| Commercial value          | CAP-X (CAP-010's value is currently unrealizable — blocked on unbuilt Tariffs)  |
| Operational value         | CAP-X (directly named in every customer shape's daily workflow; CAP-010 is not) |
| Implementation complexity | CAP-X (presentation over hardened data vs. new financial-ledger design)         |
| Customer urgency          | CAP-X (daily need vs. periodic need)                                            |

**Recommendation: B — CAP-X, Operator Control Center, scoped to its P0 modules (charger monitoring, alerts, map).**

## What this recommendation does not say

- It does not say CAP-010 is unnecessary — Invoice & Ledger architecture remains real, registered work (Architecture Backlog #53). It says the sequencing that put it immediately after CAP-009 was set before this discovery existed, and this discovery's evidence changes that sequencing.
- It does not recommend building CAP-X's P1/P2 modules (occupancy, analytics, tariff visibility, billing/invoices UI, maintenance, customer support, reservations) now — only the P0 tier, per [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md)'s own priority ordering.
- It does not resolve what should come after CAP-X's P0 tier. The likely next candidate, on this discovery's own evidence, is **Tariffs** (Architecture Backlog #24 — a `Tariff` rate-setting model and the pricing service that populates `TariffSnapshot`) — not CAP-010 directly, since CAP-010 depends on it. That sequencing question is for a future work order, not this one.
- It does not authorize any implementation. Per WO-ARGOS-018's explicit constraints, no code, schema, migration, API, or UI has been written as part of this discovery, and CAP-X does not start without separate, explicit ARGOS authorization.
