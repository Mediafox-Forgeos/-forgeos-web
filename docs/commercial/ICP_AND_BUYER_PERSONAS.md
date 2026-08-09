# ICP and Buyer Personas

**Status:** BUSINESS DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** who actually buys MOVOS — grounded in what the product's own data model and shipped feature set actually serve, not a generic SaaS buyer template.

## The Ideal Customer Profile

MOVOS's data model is the clearest evidence of who it's built for: `Organization → Site → ChargingStation → Evse → Connector`, with every operational surface (fleet health, occupancy, the Recommendation Engine, the Action Center) built to roll up _across_ sites, not to manage one location in isolation. A prospect operating a single charging station is below the point where any of that rollup value exists — the ICP starts where an operator has enough sites and stations that they can no longer just look at each one individually.

### Firmographic profile

- **Multi-site charging network operator.** Enough physical locations (realistically, more than a handful) that fleet-wide visibility — not per-station spreadsheets — is the actual value proposition.
- **Already has the pain the Recommendation Engine targets.** Idle connectors going unnoticed, authorization failures nobody's aggregating, energy delivery anomalies nobody's watching in real time (`RecommendationService`'s five real, shipped detectors — WO-ARGOS-025) — an operator who doesn't recognize these as live problems isn't the ICP yet, regardless of size.
- **White-label-compatible.** MOVOS's own architecture keeps every operator's branding isolated to one config surface (`tenant.ts`) — this matters most to an operator who either already has their own brand to protect in front of drivers, or plans to resell charging access under their own identity.

### The four segments MOVOS's own billing model already anticipates

`BillingAccountType` (CAP-009) — built for MOVOS's own in-product driver billing, not for who pays MediaFOX, but a genuine signal of which operator shapes the product was designed against — names four real segments worth treating as distinct sub-ICPs:

| Segment                                                                  | What distinguishes them                                                                      | Where they'd feel MOVOS's value first                                                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Independent/regional charge-point operators** (`INDIVIDUAL`/`COMPANY`) | Own and operate their own charging sites directly, sell access to any driver                 | Fleet-wide health and occupancy visibility; the Recommendation Engine catching problems before drivers do                         |
| **Corporate/fleet operators** (`FLEET`)                                  | Operate charging primarily for their own vehicle fleet, not the public                       | Session history and utilization data justifying charging infrastructure ROI internally                                            |
| **Property/HOA-adjacent programs** (`HOA_CONDOMINIUM`)                   | Charging is an amenity, not the core business — thin ops teams, low tolerance for complexity | The lightest-touch surfaces: dashboard health rollup, Action Center's own-language resolution notes, not a full ops-team workflow |
| **Roaming partners/aggregators** (`ROAMING_PARTNER`)                     | Operate a network that interconnects with other networks' infrastructure                     | Multi-operator/multi-tenant isolation as the actual selling point, not a compliance checkbox                                      |

### Explicitly not the ICP (today)

- **A single-site operator.** Nothing in the Operator Control Center's value proposition (fleet rollup, cross-station comparison — `COMPARATIVE_UNDERPERFORMANCE` literally requires peer stations to compare against) holds for one station.
- **An individual EV driver.** MOVOS is operator-facing infrastructure software, not a consumer charging app — there is no persona anywhere in this document that is a driver.
- **An operator requiring on-premises/self-hosted deployment.** MOVOS is architected as multi-tenant SaaS; a hard on-prem requirement is a different product, not a packaging tier.

## The buyer personas

A B2B infrastructure sale like this one is never a single buyer — [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md)'s Evaluation and Negotiation stages both depend on getting three (sometimes four) different people to yes.

### 1. The economic buyer — VP/Director of Operations, or COO at a smaller operator

- **What they own:** the budget decision and the accountability for the network's operational performance.
- **What they actually care about:** uptime and revenue protection — a degraded or offline station is lost charging revenue and a driver who may not come back; operational efficiency — can the ops team manage a growing site count without headcount growing at the same rate; evidence, not promises, that a tool changes outcomes.
- **What convinces them:** a Pilot (Journey Stage 4) that shows a concrete, attributable improvement — a chronic station surfaced and fixed, a resolution-time trend moving in the right direction (see [TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md](./TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md)) — not a features list.
- **What stalls them:** a demo that only shows the interface, never their own data; a sales conversation that can't answer "what does this actually save me."

### 2. The technical evaluator — IT/Security lead, sometimes a CTO

- **What they own:** the veto. This persona can't single-handedly close a deal, but they can stop one.
- **What they actually care about:** multi-tenant data isolation (is another operator's data ever reachable — MOVOS's real answer: every tenant-scoped request re-validates ACTIVE membership server-side and is separately org-scoped in the query layer, not just UI-hidden), authentication and audit posture (real login/refresh-token lifecycle, `AuditEvent` logging for domain mutations), integration surface (what OCPP protocol versions and vendor hardware are actually supported today, stated honestly rather than aspirationally), and exit cost (what happens to their data if they leave).
- **What convinces them:** direct, specific, honest answers — the same standard of evidence this engagement's own architecture documentation holds itself to (real migrations, real test coverage, explicitly named gaps rather than glossed-over ones). [TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md](./TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md) is written directly at this persona.
- **What stalls them:** vague or evasive answers to any of the above — this persona has almost certainly seen a vendor oversell "enterprise-grade security" before and will discount marketing language on sight.

### 3. The champion — the day-to-day operations user

- **What they own:** nothing budget-related, but everything about whether the product actually gets used once it's paid for.
- **What they actually care about:** does logging into `/dashboard` every morning genuinely replace whatever manual process (spreadsheet, phone calls, site visits) they use today; is the Action Center's acknowledge/assign/resolve workflow actually faster than what they do now; is it in their working language (MOVOS's UI is Spanish-first by convention, a real and deliberate fit for this persona in MediaFOX's actual target markets, not an afterthought).
- **What convinces them:** using it during the Pilot and having it catch something they would have otherwise missed or been slow to notice.
- **What stalls them:** a tool that adds a new screen to check without removing an old process — the champion's endorsement requires net time saved, not net screens added.
- **Why they matter commercially, not just operationally:** a champion who genuinely likes the product is the internal advocate who carries the deal through Negotiation once the economic buyer and technical evaluator are otherwise satisfied — and, longer-term, the source of the peer referrals [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) identifies as the most credible Awareness channel in this narrow, referral-dense market.

### 4. Procurement/legal — gatekeeper, not a buyer

- **What they own:** contract terms, data-processing language, and the pace of the Negotiation stage.
- **What they actually care about:** standard SaaS-vendor risk questions (data residency, liability, termination terms) — rarely product-specific, but capable of stalling a deal that every other persona has already said yes to.
- **What convinces them:** a clean, prepared contract package rather than an improvised one — see [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) Stage 5's note that this can be the longest stretch of the whole journey if not planned for.

## What this means for the rest of the journey

Every stage in [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) after Awareness should be read as "convince these four people, in roughly this order of first contact, but keep all of them satisfied simultaneously by the time Negotiation starts" — losing any one of them late (the technical evaluator finding an unanswered security question at contract time, the champion going quiet after a bad pilot experience) resets progress even if the other three are fully bought in.
