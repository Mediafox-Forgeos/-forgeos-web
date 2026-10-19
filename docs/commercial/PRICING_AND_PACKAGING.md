# Pricing and Packaging

**Status:** BUSINESS DESIGN. No code, API, migration, or `schema.prisma` change. This document proposes a pricing **model and structure** — what the price should scale with, and how capabilities should be tiered. It does not invent specific dollar figures: real price points depend on market and cost data this discovery does not have, and stating invented numbers as fact would be worse than leaving them explicitly open.

## The distinction this document must not blur

MOVOS already has a real, shipped billing concept — `BillingAccount` and `TariffSnapshot` (CAP-008/009) — and it is **not** what this document is about. That model prices **an operator's own end drivers** for charging sessions (`energyPricePerKwh`, `pricePerMinute`, frozen per session). This document is about a completely different commercial relationship: **what MediaFOX charges the operator** for access to MOVOS itself. An operator's driver-facing tariff and MediaFOX's own SaaS price to that operator can move independently and should never be presented, internally or externally, as the same number. Every packaging idea below is about the second relationship only.

## The pricing axis: what should the price scale with

| Candidate axis                              | Fit                                     | Why                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Per station** (or per connector)          | **Recommended primary axis**            | Matches the unit the entire data model, the Operator Control Center, and the ICP itself already organize around (`Organization → Site → ChargingStation`). Value scales with footprint — more stations means more surface for the Recommendation Engine and Action Center to actually help with — so price scaling the same way is the most defensible alignment between cost and value. |
| Per seat/user                               | Poor fit                                | The value proposition is fleet-wide rollup, not per-person usage — a lean ops team managing 50 stations gets enormous value from very few logins; seat-based pricing would systematically undercharge exactly the customers getting the most value, and penalize a customer for being appropriately efficiently staffed.                                                                 |
| Flat tiers by fleet-size band               | Reasonable secondary/simplifying option | Coarser than per-station, but avoids "my bill changes every time I add a charger" friction for a mid-market buyer who wants a predictable line item — worth offering as an alternative packaging shape for the same underlying per-station logic, not a different philosophy.                                                                                                            |
| Usage-based (per session or per kWh routed) | Not recommended yet                     | Ties MediaFOX's revenue to the operator's own driver-facing revenue activity, which is a fundamentally different commercial relationship (closer to a payments take-rate) and, practically, cannot be metered precisely without the in-product billing/ledger infrastructure (CAP-010) that doesn't exist yet. Worth reconsidering only after that foundation is real.                   |

**Recommendation: price per managed station (or, at simplified-packaging tiers, banded by station-count range), not per seat and not usage-based.**

## The tiers: mapped to real capability boundaries, not arbitrary splits

[CAPABILITY_INVENTORY.md](../forgeos/CAPABILITY_INVENTORY.md) already found a real, load-bearing line in the product's own architecture — it's the natural packaging boundary too, not a coincidence, since both questions ("what's a coherent unit of value" and "what's a coherent unit of engineering") tend to land on the same seams.

### Tier 1 — Foundation

- **What's included:** multi-tenant access, Site/Station/EVSE/Connector management, Sessions history, real-time fleet health and connectivity Observability (`StationHealthService`'s rollup — healthy/degraded/offline/unknown, fleet and per-site).
- **Why this is the floor, not an add-on:** this is baseline operational visibility — the thing that replaces "check each station's status by hand" with one screen. Every prospect's Pilot (Journey Stage 4) should be run against at least this tier, because it's what proves MOVOS is a credible operations tool at all.

### Tier 2 — Operational Intelligence (the differentiated tier)

- **What's included:** everything in Foundation, plus the Recommendation Engine (the 5 shipped detectors — `ENERGY_ANOMALY`, `AUTH_FAILURE_SPIKE`, `IDLE_CONNECTOR`, `COMPARATIVE_UNDERPERFORMANCE`, `EFFICIENCY_DRIFT`) and the Action Center (acknowledge/assign/snooze/resolve/dismiss workflow, explainability snapshots).
- **Why this is priced separately:** [FORGEOS_POSITIONING.md](../forgeos/FORGEOS_POSITIONING.md) already identified this exact capability pair as MOVOS's genuine competitive differentiator — "a system whose recommendations visibly improve because it tracks its own hit rate... is a harder capability to copy and a harder one to fake in a demo" than status boards, which are category table stakes. Differentiated value is exactly what should carry a premium over the baseline, not be bundled into it by default.
- **The honest caveat this tier requires in every sales conversation:** [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) already found that MOVOS cannot yet measure false-positive rate or prove avoided downtime as a hard number — meaning the sales conversation for this tier should sell "a system that catches real, evidenced problems and gives your team a place to work them," not an unproven ROI dollar figure. Overselling this tier's measurability is a foreseeable trust risk; [TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md](./TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md) treats this directly.

### Tier 3 — not sellable yet

- **What would be included, eventually:** Operational Memory (chronic-station/best-operator rollups) and Learning (recommendation-accuracy tracking), and — further out, and only once Learning exists to gate it — Automation.
- **Why this isn't a real tier today:** none of it is built. [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) and [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) are discovery documents, not shipped capabilities — naming a paid tier around them before they exist would be selling roadmap as product, exactly the risk [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) warns against at the Interest stage. This tier belongs on a roadmap slide, explicitly labeled as such, not on a price list.

## Contract shape, not contract price

- **Term:** an annual (or multi-year) contract, converted from a time-boxed Pilot, is the shape that matches the recommended enterprise, pilot-led motion ([SALES_MOTION_AND_GTM_STRATEGY.md](./SALES_MOTION_AND_GTM_STRATEGY.md)) — monthly self-serve billing isn't executable today regardless of preference, since no in-product recurring payment collection exists (CAP-010 not started).
- **Collection mechanism, today:** manual invoicing under agreed contract terms — not a checkout flow, not an in-app subscription. This is a real, current constraint, not a temporary formality; it should be stated plainly in Negotiation, not discovered by the buyer at Close.
- **Growth within an account:** because pricing is per-station, an existing customer adding sites or stations is a natural, low-friction expansion motion — the same commercial relationship, more units, no new sales cycle required — worth treating as an explicit expansion path once a first cohort of paying customers exists to expand.

## What this document is not proposing

No specific price-per-station figure, no specific tier price, no discount schedule. Those require real inputs this discovery doesn't have — cost to serve, competitor pricing, and willingness-to-pay data from actual sales conversations — and inventing them here would create false precision that could get quoted to a real prospect. What's proposed is the shape a real pricing decision should take: per-station as the primary axis, two sellable tiers aligned to real, shipped capability boundaries, and an honest acknowledgment that a third tier and any usage-based model are not yet buildable into a real quote.
