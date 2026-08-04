# CAP-X — Investor Demo Readiness

**Work order:** WO-ARGOS-020 (Operator Control Center MVP Definition)
**Status:** PRODUCT DISCOVERY / PLANNING. No code, API, migration, or UI. This document answers a question, it does not build a demo.
**Question posed (Objective 4):** "¿Qué podría enseñarle Kylum mañana a un inversionista?" — what could Kylum show an investor _tomorrow_, and how does that answer change after the 30-day MVP in [CAPX_MVP_WIDGETS.md](./CAPX_MVP_WIDGETS.md) and [CAPX_MVP_SCREENS.md](./CAPX_MVP_SCREENS.md) ships?

## Objective 4 — Two honest answers, not one

This question has two different correct answers depending on what "tomorrow" means, and conflating them would overstate one or understate the other. This document keeps them separate on purpose.

### Answer 1: What Kylum could show tomorrow, with zero new work

Everything in this tier already exists, in real, populated production schema, reachable through existing endpoints, as of `main`'s current state (through CAP-009). None of it requires this MVP, or even this work order, to be true — it is true today:

- **Real infrastructure, not a mockup.** Every `Site`, `ChargingStation`, `Evse`, and `Connector` an investor is shown is a real database record, with real, production-grade location data (100% complete per the Feature Matrix) — not the placeholder/fixture data this codebase's own history shows earlier stages relied on (the pre-CAP-002 mock station/charger/connector pages, retired at WO-ARGOS-005).
- **Real charging activity.** Every `ChargingSession` shown — status, energy delivered, duration — is a real transaction processed through a real OCPP 1.6J engine, validated against a real device simulator and a real PostgreSQL database (CAP-003/CAP-004's own validation records), not synthetic numbers.
- **Real connectivity awareness.** MOVOS can already tell, live, whether a station's connection is verified reachable — CAP-005 shipped this, real-boot/real-WebSocket validated. An investor can watch a simulated device disconnect and watch MOVOS notice within the same demo.
- **Real multi-tenant, real billing attribution.** Every session is already attributed to a `BillingAccount` (CAP-009) — real schema, real foreign-key enforcement, real tenant isolation (the composite FK closing a cross-tenant assignment gap ARGOS's own review found and required fixed). This is a genuinely strong technical story: the financial _plumbing_ is already built and hardened, even though pricing isn't yet.

**What this tier cannot yet show, and should not be implied to show:** a polished dashboard. Today, this data is real but not aggregated or presented — an investor would be looking at API responses or, at best, the existing per-entity CRUD screens (Feature Matrix: Sessions frontend is still "mock frontend not migrated"), not the Home operacional screen from [CAPX_MVP_SCREENS.md](./CAPX_MVP_SCREENS.md). This tier's story is **"the hard infrastructure and data model are real and already survived multiple rounds of hardening,"** not **"here is the product."**

### Answer 2: What Kylum could show after the 30-day MVP

This is where the product story becomes visual and demoable in the way an investor conversation actually needs:

- **The Home operacional screen**, live, showing real fleet status, real connectivity, a real attention queue, and a real map with `StationHealth`-colored pins — the single glance [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) established as the operator's actual daily habit, now something an investor can watch happen rather than have described to them.
- **A live incident, start to finish**, using the demo's own simulator: fault a connector on camera, watch an `Alert` appear in the attention queue within seconds, acknowledge it, escalate to an `Incident`, assign it, resolve it with notes — the full detection-to-closure story from [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md), demonstrated live rather than described in a slide. This is the single highest-leverage moment available in the whole 30-day plan: it is the one sequence that makes "operator control center" a felt experience rather than a claim.
- **A real multi-site view** — the map, with more than one site, showing an investor that MOVOS already thinks in terms of a portfolio, not one charger — directly speaking to the network-operator/multi-site customer shape [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) named as one of five real target customers, not a hypothetical one.

**What this tier still cannot show, and must not be implied to show:** revenue, invoices, or any dollar figure tied to a session. [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md)'s Revenue exception is unaffected by this MVP shipping — pricing depends on a different, unbuilt domain (Tariffs) regardless of how much Operator Control Center work happens. An investor who asks "so what's this station earning" should hear an honest, confident answer about sequencing (visibility first, because you can't trust billing on infrastructure you can't see, per [OPERATOR_STRATEGY_RECOMMENDATION.md](./OPERATOR_STRATEGY_RECOMMENDATION.md)) — not a fudged number.

Similarly, the **Maintenance view will likely be sparse or empty** in a genuine 30-day-old pilot, per [CAPX_MVP_SCREENS.md](./CAPX_MVP_SCREENS.md)'s own honest note — nothing in this MVP creates a `MaintenanceTicket` through the product yet. If the demo needs a populated maintenance view, that means seeding a demonstration ticket manually beforehand and saying so, not presenting an organically-generated one.

## What not to promise

Stated plainly, because an investor demo is exactly the setting where the temptation to overstate is highest, and this engagement's own discipline (every prior document in this capability, and every document before it back to DEC-022's threat models) has been to name limitations before they're discovered by someone else:

- Do not imply real-time billing or invoicing exists or is imminent within 30 days — it is explicitly out of this MVP's scope, and out of CAP-010's scope until Tariffs (a separate, unscheduled capability) ships first.
- Do not imply the Maintenance workflow (dispatch, scheduling, technician assignment) is built — only visibility into ticket records is, and only for tickets that exist, which in a fresh pilot may be none.
- Do not imply `StationHealth`'s `maintenance` state or fault-recurrence detection are live in the 30-day cut — `FLAPPING_CONNECTOR`/`HIGH_FAILURE_RATE` alert types and the `FAULT_RECURRENCE` widget are explicitly deferred past day 30 in [CAPX_MVP_WIDGETS.md](./CAPX_MVP_WIDGETS.md).
- Do not imply incident closure (the fourth stage of [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)'s lifecycle) is available — the MVP stops at `RESOLVED`, per [CAPX_MVP_SCREENS.md](./CAPX_MVP_SCREENS.md)'s explicit action-budget cut.

## The one-sentence answer

**Tomorrow**, Kylum can honestly say: "the infrastructure model, the session data, the connectivity engine, and the multi-tenant billing foundation are real, hardened, and already in production — go ahead and disconnect a charger, we'll show you MOVOS notice." **In 30 days**, Kylum can additionally say: "and here is the live screen an operator uses every morning to see that, act on it, and close the loop" — with a live fault-to-resolution demonstration as the single moment that turns the pitch from an architecture story into a product story.
