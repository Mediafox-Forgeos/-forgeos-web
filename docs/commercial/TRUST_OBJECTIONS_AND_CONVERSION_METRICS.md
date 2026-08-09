# Trust Objections and Conversion Metrics

**Status:** BUSINESS DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** the real objections a charging-network operator will raise, honest answers grounded in what MOVOS actually is today, and how to measure whether [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md)'s journey is actually working.

## Why honesty is the whole strategy here

[ICP_AND_BUYER_PERSONAS.md](./ICP_AND_BUYER_PERSONAS.md)'s technical evaluator persona "has almost certainly seen a vendor oversell 'enterprise-grade security' before and will discount marketing language on sight." The only durable answer to that skepticism is the same discipline this entire engagement's architecture documentation already practices: state what's real, state what isn't, and never blur the two. Every objection below is answered that way on purpose — including the ones without a fully satisfying answer yet.

## The real objections

### "Is my data actually isolated from other operators?"

- **The honest answer:** yes, and it's enforced server-side, not just hidden in the UI. Every tenant-scoped request re-validates the caller's ACTIVE membership and is separately org-scoped in the query layer (`docs/product/MOVOS.md`'s "Operational foundation" section) — a compromised or misconfigured frontend cannot leak cross-tenant data because the backend never trusts the frontend's own scoping. `Organization`/`Membership`/`User` carry no mobility-specific residue at all ([VERTICAL_BOUNDARIES.md](../forgeos/VERTICAL_BOUNDARIES.md)) — this is core platform plumbing, exercised on every request, not a bolted-on feature.
- **What not to claim:** a specific compliance certification (SOC 2, ISO 27001, etc.) unless one has actually been obtained — this document has no evidence one exists, and claiming it would be exactly the kind of overselling this evaluator persona is primed to catch.

### "If a recommendation is wrong, what happens?"

- **The honest answer:** nothing happens automatically — that's a feature of where the product is today, not a limitation to hide. Every recommendation is evidenced (the exact numbers behind it — see `RecommendationService`'s detectors) and every operator action (acknowledge/assign/snooze/resolve/dismiss) is a human decision recorded with the operator's own notes. Automation — the system acting without a human — is explicitly not built yet ([FORGEOS_STACK.md](../forgeos/FORGEOS_STACK.md) Layer 7, "not started, explicitly and repeatedly"). Frame this as reassurance: the system surfaces and explains, your team decides.
- **What not to claim:** a specific false-positive rate. [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) already found this isn't reliably measurable yet without a schema addition MOVOS hasn't built. Say what's true — "every recommendation shows its evidence so your team can judge it themselves" — not an invented accuracy percentage.

### "What OCPP protocol and hardware do you actually support?"

- **The honest answer:** state the real, current scope plainly rather than the aspirational one — this is a technical evaluator's question and deserves a technical, specific answer, not a positioning statement. Whatever the real current OCPP coverage is at the time of the conversation (protocol versions, message types, vendor hardware validated) should be stated exactly as the engineering documentation states it internally — this document does not restate that scope here because it changes over time and the sales conversation must always reflect the current state, not a snapshot frozen into a commercial document.
- **What not to claim:** full OCPP 2.0.1 support, remote commands, or any hardware vendor compatibility that hasn't actually been validated against real devices — overclaiming here is the single fastest way to fail Evaluation once the technical evaluator tests it themselves.

### "What's your uptime and reliability track record?"

- **The honest answer:** MOVOS is an early-stage, pilot-proven product, not a product with years of uptime history — say that directly rather than deflect. What can honestly be pointed to instead is engineering discipline: the connectivity layer is explicitly designed not to trust a stale belief across a process restart (`ConnectivityCoordinatorService` forces `ONLINE → UNKNOWN` on restart rather than assuming a pre-restart state still holds — CAP-005), which is evidence of how the team thinks about reliability, even without a long track record yet to point to.
- **What not to claim:** a specific uptime percentage (e.g., "99.9% SLA") without a real, contractually-backed SLA behind it.

### "Can I get my data out if I leave?"

- **The honest answer:** this document does not have evidence of a built data-export capability to point to, and the honest move is to say so — this is a real open question to have a prepared, honest answer for before a technical evaluator asks it, not a claim to paper over with reassuring language. Surfacing this gap here is deliberate: an unanswered version of this question discovered live in a sales call is far more damaging than a known gap the team already has a plan for.

### "Is this just a dashboard, or does it actually change what my team does?"

- **The honest answer:** the Action Center is the direct answer — a real, stateful workflow (acknowledge/assign/snooze/resolve/dismiss) with server-enforced transitions, not a read-only status board. This is also the honest place to invoke [FORGEOS_POSITIONING.md](../forgeos/FORGEOS_POSITIONING.md)'s own finding: status dashboards are category table stakes; a system that turns findings into tracked, resolved work is the differentiated part.

### "Why should I trust an early-stage vendor with infrastructure this critical?"

- **The honest answer:** this is exactly what the recommended Pilot stage is _for_ ([SALES_MOTION_AND_GTM_STRATEGY.md](./SALES_MOTION_AND_GTM_STRATEGY.md)) — don't argue the objection away, agree with it, and point at the de-risking mechanism already built into the journey: start with a time-boxed pilot against real (or representative) data before any commitment, exactly as Kylum Energy did.

## Conversion metrics — what to actually measure

MOVOS has run this journey, in substance, exactly once (Kylum Energy) — there is no statistically meaningful conversion-rate data yet, the same honest caveat [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) and [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) already applied to product-usage data. The right move is not to guess at baseline numbers — it's to start tracking these from the very next prospect, so a real baseline exists after a real cohort has moved through the funnel.

| Stage transition      | Metric                                                                                             | What it tells you                                                                                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Awareness → Interest  | Share of awareness touches (outreach, event contact, referral) that produce a real qualifying call | Whether the account-list/referral approach ([SALES_MOTION_AND_GTM_STRATEGY.md](./SALES_MOTION_AND_GTM_STRATEGY.md)) is reaching the right people                                                                                          |
| Interest → Evaluation | Share of qualifying calls that advance to a technical/business fit conversation                    | Whether early qualification is honest and accurate, not just optimistic                                                                                                                                                                   |
| Evaluation → Pilot    | Share of evaluations that convert to an agreed pilot; median days in Evaluation                    | Whether the technical evaluator's real questions ([TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md](#the-real-objections) above) are being answered convincingly and quickly                                                                   |
| Pilot → Negotiation   | Share of pilots that convert to a commercial conversation; median pilot duration                   | The single most important number in this table — this is "did the product actually prove its value" translated into a rate                                                                                                                |
| Negotiation → Close   | Share of negotiations that reach a signed contract; median days in Negotiation                     | Whether packaging and pricing ([PRICING_AND_PACKAGING.md](./PRICING_AND_PACKAGING.md)) match what the market will actually agree to, and whether procurement/legal is a bottleneck worth planning around                                  |
| End-to-end            | Awareness-to-Close conversion rate; total sales-cycle length                                       | The headline health metric for the whole motion, and the number that tells you whether the enterprise pilot-led motion ([SALES_MOTION_AND_GTM_STRATEGY.md](./SALES_MOTION_AND_GTM_STRATEGY.md)) is working at the pace the business needs |

### The metric that matters most: did the pilot actually work

Every other metric in this table measures process. Pilot → Negotiation measures the thing the whole journey exists to prove. [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) already named the risk directly: "a pilot with no defined success criteria never converts, because there's no shared moment where both sides agree it worked." Concretely, a pilot should be judged against agreed-in-advance criteria in the same shape as [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)'s honest measurement discipline — a chronic station actually surfaced, an Action actually resolved faster than the prospect's prior process, a health-status view the champion persona actually checks unprompted — not a vague "did they like it."

## What this means going forward

None of these objections or metrics require product changes to start acting on — they require sales discipline: stating the real OCPP scope and the real data-export gap out loud before being asked, and instrumenting the next pilot with named success criteria and a tracked outcome instead of an informal "how did it go" conversation. The first few prospects that move through this journey are also the first real data [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)-style discipline can eventually be applied to the commercial funnel itself, the same way it's already being applied to the product's own recommendation engine.
