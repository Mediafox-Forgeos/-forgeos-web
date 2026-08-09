# Learning Strategy

**Work order:** WO-ARGOS-027 (Operational Learning Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change.
**Mission:** answer explicitly which capability MOVOS should build next — Operational Learning, Automation, or Alert/Incident/Maintenance — using [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md), [LEARNING_METRICS.md](./LEARNING_METRICS.md), [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md), and [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md) as evidence, not preference.

## The answer

**A. Operational Learning.**

Not because it's this work order's own subject, but because of one fact the four documents above establish concretely: Learning is the only one of the three options with a **prerequisite relationship** to the others. Automation cannot be trusted without knowing which recommendation types are reliable — and only Learning produces that number ([LEARNING_METRICS.md](./LEARNING_METRICS.md) metric 3, acceptance rate). Alert/Incident/Maintenance's own architecture ([CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)) has already been deferred twice specifically because it needs a schema investment ([RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s "needs status-history log" gap) that Learning does not.

## The three options, evaluated

### A. Operational Learning

- **Business value:** directly compounds the return on the two capabilities already shipped (`RecommendationService`, WO-ARGOS-025; `ActionService`, WO-ARGOS-026) instead of opening a new surface. Every `Action` created since WO-ARGOS-026 merged is already sitting in `movos_dev`, unread by anything except the live dashboard — Learning is the first thing that goes back and asks what that accumulating history means. [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md)'s five questions (chronic stations, best operators, failure patterns, seasonal demand, maintenance efficiency) are the kind of fleet-level insight an ops lead currently has to assemble from memory and gut feel; MOVOS answering them automatically is a visible, demoable step change in what the product does for that person specifically.
- **Customer urgency:** moderate, not critical — nothing is broken without it. But it is the natural next thing to show the pilot customer (Kylum Energy): "MOVOS is already getting smarter from your team's decisions" is a stronger renewal/expansion story than another static dashboard widget, and the underlying data to tell that story is already real, not hypothetical.
- **Technical complexity:** **lowest of the three.** [LEARNING_METRICS.md](./LEARNING_METRICS.md) shows three of five core metrics (time to resolution, recurrence rate, acceptance rate) are computable **today**, from data that already exists, with zero schema changes — aggregation queries over `Action` and `ChargingSession`, the same category of work [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) classified "available today" for 12 of its 20 catalog entries. The two gaps this discovery found honestly (a dismiss-reason enum for false-positive rate; a transition-history log for reassignment frequency) are each small and additive, and neither blocks a first release.
- **Competitive differentiation:** genuinely differentiating. Status boards and manual ticketing (option C, below) are table stakes across the charging-management-software category. A system whose recommendations visibly improve because it tracks its own hit rate against real operator decisions is a harder capability to copy and a harder one to fake in a demo.

### B. Automation

- **Business value:** high, in principle — reducing operator clicks (auto-dispatch, auto-notify, auto-resolve known-benign patterns) is a real efficiency gain and a common ask once a team trusts a system's judgment.
- **Customer urgency:** low today, specifically because that trust doesn't exist yet to be acted on. WO-ARGOS-026's own merge authorization explicitly held Automation back ("Do NOT start Automation yet") — this discovery confirms that instinct was correct: [LEARNING_METRICS.md](./LEARNING_METRICS.md) shows MOVOS cannot currently distinguish a well-calibrated recommendation type from a noisy one (acceptance rate is measurable; false-positive rate is not, without a schema change this discovery didn't make). Automating a response on top of an untracked accuracy rate means automating on a guess about which of the 5 recommendation types deserve that trust.
- **Technical complexity:** the execution mechanism itself is small (largely a wrapper around the transition logic `ActionService` already has) — the real cost is not building it, it's the judgment of _which_ transitions are safe to make unattended, which is exactly the judgment Learning's acceptance/recurrence data is needed to inform. Building Automation before Learning inverts the dependency: it would mean choosing which recommendation types to trust with automatic action based on nothing but instinct, the same way the 60-minute cooldown window in WO-ARGOS-026 was a judgment call rather than a measured value ([OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md)).
- **Competitive differentiation:** high value if done right, but a wrong automated action (dispatching a truck for a false `ENERGY_ANOMALY`, or auto-dismissing something genuinely urgent) is a worse look than a wrong recommendation an operator catches before acting — the downside risk of moving early here is asymmetric in a way it isn't for Learning.

### C. Alert / Incident / Maintenance

- **Business value:** real and well-understood — full incident lifecycle and maintenance ticketing is standard functionality in this category, and every operator ultimately wants it.
- **Customer urgency:** genuine, but not new information — this need has been visible since [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) was architected (WO-ARGOS-019) and has been deliberately deferred through WO-ARGOS-020 (MVP definition), 022 (Sprint 1), 025, and 026, each time in favor of a narrower, faster-to-ship slice. Nothing in this discovery surfaces a new urgency signal that would overturn that repeated, considered choice.
- **Technical complexity:** **highest of the three, and the reason for every prior deferral.** `Connector`/`Evse.status` are current-state-only ([RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s central finding); a real Incident/MaintenanceTicket model needs the status-transition history log that finding named as missing across three independent documents, plus a genuinely new entity (`Incident`, distinct from the narrower `Action` WO-ARGOS-026 deliberately built instead — see that work order's own scope note). This is a bigger schema and migration commitment than anything shipped so far in this engagement's additive-only migration discipline.
- **Competitive differentiation:** low. This is parity functionality, not a differentiator — most competing platforms already have some version of it. Valuable to have, not valuable to be first at.

## Comparison

| Criterion                   | A. Operational Learning                  | B. Automation                                                    | C. Alert/Incident/Maintenance                       |
| --------------------------- | ---------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| Business value              | High — compounds existing investment     | High, but unrealized until trust exists                          | High, but parity not differentiation                |
| Customer urgency            | Moderate, real today                     | Low today — no accuracy track record yet                         | Genuine, but not new; already deferred 4x           |
| Technical complexity        | Lowest — 3 of 5 metrics need zero schema | Low to build, high in judgment risk without Learning first       | Highest — needs the missing status-history log      |
| Competitive differentiation | High — hard to copy, hard to fake        | High if trusted, high downside if wrong                          | Low — table stakes                                  |
| Depends on                  | Nothing — usable on today's data         | **Operational Learning** (needs acceptance/false-positive rates) | A separate schema investment, independent of A or B |

## What this recommends concretely

Start Operational Learning next: the three real metrics from [LEARNING_METRICS.md](./LEARNING_METRICS.md) (time to resolution, recurrence rate, acceptance rate), rolled up per [ORGANIZATIONAL_MEMORY.md](./ORGANIZATIONAL_MEMORY.md)'s station- and operator-level questions, using zero schema changes to start. Treat the two named gaps — a dismiss-reason enum and a transition-history log — as candidate follow-on additive migrations, not blockers, to be scoped in a future implementation work order rather than this discovery. Revisit Automation once Learning has produced enough acceptance-rate history per recommendation type to say, with evidence rather than instinct, which of the 5 are trustworthy enough to act on unattended. Continue holding Alert/Incident/Maintenance (CAP-010) for the same reason it has been held four times already — it remains the right eventual investment, not the next one.
