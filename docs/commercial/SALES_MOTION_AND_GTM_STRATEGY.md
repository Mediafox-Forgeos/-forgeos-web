# Sales Motion and GTM Strategy

**Status:** BUSINESS DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** how the commercial journey in [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) should actually be run — and an explicit answer on which motion to run it with.

## The answer

**Enterprise, pilot-led sales — the same motion MOVOS already runs with Kylum Energy today, deliberately repeated, not a new invention.**

Not self-serve, not a lightweight inside-sales motion. One finding makes this close to non-negotiable rather than merely preferred: **MOVOS has no in-product way to collect payment today.** CAP-009's own status is explicit — `BillingAccount`/`TariffSnapshot` exist as real models, but they price _the operator's own end drivers_, a completely different concern from MediaFOX charging the operator for MOVOS access (see [PRICING_AND_PACKAGING.md](./PRICING_AND_PACKAGING.md) for why these must never be conflated). No `Invoice`, `Payment`, or billing-processor integration exists anywhere in this codebase — CAP-010 (Invoice & Ledger Architecture) is registered in the backlog and not started. A self-serve motion assumes a prospect can sign up and pay with a credit card in one sitting; today, that path does not exist and building it is out of this document's scope (no code). Every path to "I'm paying for MOVOS" currently runs through a human-negotiated contract and an out-of-platform invoice — which is exactly what an enterprise, pilot-led motion is built around.

## Why this is also the right motion on its own merits, not just the only executable one

### Business value

Charging-network operators in MOVOS's actual ICP ([ICP_AND_BUYER_PERSONAS.md](./ICP_AND_BUYER_PERSONAS.md)) are multi-site operations where the value proposition — fleet-wide health visibility, revenue protection, the Recommendation Engine catching problems before they compound — scales with site count. That points toward a meaningfully higher per-account value than a self-serve SMB tool, which is exactly the profile that justifies the cost of a high-touch sales process instead of needing volume to make the economics work.

### Customer urgency

Charging infrastructure is revenue-generating, driver-facing equipment. No operations leader signs up self-serve for software that will touch that equipment's monitoring and response workflow without validating it first — this is the same risk-aversion that makes the technical evaluator persona a hard gate, not a soft one. A pilot isn't a sales tactic here; it's what a rational buyer in this category requires regardless of how MOVOS chooses to sell.

### Technical complexity

The product-side complexity was never the obstacle to a lighter-touch motion — the obstacle is that self-serve requires infrastructure (public signup, in-product billing/payment collection, self-service tenant provisioning) that simply doesn't exist yet and isn't close. Pilot-led sales requires none of that: a pilot tenant today is provisioned the same way Kylum Energy's was, by a human, which is already a proven, working process.

### Competitive differentiation

MOVOS's real differentiator — the Recommendation Engine surfacing a real problem, the Action Center turning it into a tracked, resolved case — is close to impossible to sell convincingly as a features list or a canned demo video. It has to be experienced against a prospect's own sites to land. A pilot is not just the safest motion available; it's the best possible showcase for the specific thing MOVOS is actually good at.

## The motion, stage by stage

| Journey stage | Who runs it                                                                                                                           | What "good" looks like                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Awareness     | Founder/BD-led outreach, industry events, peer referral — see [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) Stage 1        | A named list of target operators, not a broad campaign — this market is small enough to work as an account list, not a funnel top                                       |
| Interest      | A short, honest qualifying call, not a form-triggered auto-demo                                                                       | Real fleet-size and pain-point information captured before any product is shown                                                                                         |
| Evaluation    | A technical/business fit conversation with both the economic buyer and technical evaluator present                                    | Every real architectural question ([TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md](./TRUST_OBJECTIONS_AND_CONVERSION_METRICS.md)) answered with specifics, not reassurance |
| Pilot         | Hands-on, against the prospect's real (or realistically representative) sites, time-boxed with named success criteria agreed up front | The champion persona actually logs in and the Action Center gets real use, not a passive dashboard glance                                                               |
| Negotiation   | Economic buyer + procurement, using packaging tied to real capability boundaries                                                      | A clear, honest boundary between what's included and what's roadmap — see [COMMERCIAL_JOURNEY_MAP.md](./COMMERCIAL_JOURNEY_MAP.md) Stage 5                              |
| Close         | Signed contract, first invoice — necessarily manual/off-platform today                                                                | First payment collected under agreed terms                                                                                                                              |

## What this motion is not ruling out, later

This recommendation is about the motion to run **now**, with the product and payment infrastructure that exists **now** — not a permanent ceiling.

- **A lighter-touch track for the smallest ICP segment** (property/HOA-adjacent programs, [ICP_AND_BUYER_PERSONAS.md](./ICP_AND_BUYER_PERSONAS.md)'s thinnest-ops-team segment) could make sense once packaging and onboarding are simple enough — but that's a packaging maturity question, not a reason to abandon pilot-led sales for the core ICP today.
- **A self-serve or product-led motion** becomes conceivable only after real in-product billing exists (CAP-010, not started) and a self-service tenant-provisioning path is built — both real product investments, not GTM decisions, and both out of scope for this document.
- **A channel/partner motion** (OCPP hardware vendors, installers, utility partnerships) is a plausible future amplifier for Awareness specifically, but there is no existing partnership evidence anywhere in this repository to build a recommendation on — naming it here as a future direction, not a current plan, is the honest way to treat it.

## What this recommends concretely

Keep running the same motion MOVOS already runs with Kylum Energy, deliberately, for the next prospect: named-account outreach into Awareness, an honest qualifying conversation at Interest, a real technical/business diligence conversation at Evaluation, a time-boxed pilot with agreed success criteria, packaging tied to real capability boundaries at Negotiation, and a manually-executed contract and invoice at Close. Nothing about this requires new product work to start; it requires only doing, on purpose and repeatably, what has already happened once.
