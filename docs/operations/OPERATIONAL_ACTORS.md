# Operational Actors

**Work order:** WO-ARGOS-034 (Operational Actors & Responsibility Model)
**Status:** DOMAIN DISCOVERY. No code, frontend, backend, migration, or API change.
**Mission:** every human actor behind a MOVOS-managed charging network — grounded in the real, already-shipped `MemberRole` enum (`OWNER`/`ADMIN`/`OPERATOR`/`SUPPORT`/`ANALYST`/`VIEWER`) and WO-ARGOS-033's `Technician` entity, not an invented role vocabulary.

## The finding that shapes this whole document

MOVOS already has a six-value role enum, real and enforced today — but per the product's own earlier audit, "only 3 of 6 defined roles are ever checked" (`docs/product/MOVOS_PRODUCT_ATLAS_v1.0.md`). This document's first job is to check whether the real-world actors a charging network actually needs match the roles already sitting unused in the schema, before proposing anything new. In every case below, they do — the gap is enforcement and product surface, not missing vocabulary.

## The actors

### 1. Network Operator

- **Maps to:** `MemberRole.OPERATOR` — the real, already-used role this entire engagement's product work (WO-ARGOS-022 onward) has been built for.
- **Responsibilities:** daily fleet monitoring, triaging recommendations, working the Action Center, the day-to-day user of Command Center/Network/Operations.
- **Permissions (real, as enforced today):** update-level access on `Site`/`ChargingStation`/`Evse`/`Connector` (`@Roles(OWNER, ADMIN, OPERATOR)` on every `PATCH` route across those controllers), full read access everywhere, and — notably — the _entire_ Action Center write surface, since `ActionController` declares no `@Roles()` restriction at all (see "An honest gap this document has to name," below).
- **Decisions:** acknowledge/assign/snooze/resolve/dismiss on `Action`; would be the primary actor on `WorkOrder`'s `assign`/`start`/`block`/`resolve` transitions ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)).
- **KPIs:** time to acknowledgment, time to resolution, recurrence rate — exactly [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)'s three real, computable-today metrics.
- **Daily workflow:** [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md), in full.

### 2. Dispatcher

- **Maps to:** `MemberRole.OPERATOR` — **the same real role as Network Operator, not a distinct one.** This is a deliberate finding, not an oversight: at the scale MOVOS operates at today (one pilot org, a handful of stations), the person who notices a problem and the person who decides who fixes it are the same individual, confirmed directly by [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md) (the operator both triages _and_ self-assigns _and_ mentally tracks the technician). Inventing a separate `DISPATCHER` role now, with no evidence an organization has separate people doing these jobs, would repeat the exact premature-taxonomy mistake [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md) already avoided for `skills`.
- **Responsibilities:** the assignment function specifically — matching a problem to the right technician by zone, skill, and availability ([TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)).
- **Permissions:** identical to Network Operator, because it's the same account.
- **Decisions:** `WorkOrder.assign` specifically — the one transition this document treats as its own named function even though no separate role enforces it yet.
- **KPIs:** time to assignment (distinct from time to resolution — [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)'s `assignedAt` field exists specifically so this is measurable on its own).
- **Daily workflow:** interleaved with the Network Operator's day — see [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md).
- **A scaling note, not a recommendation to act on now:** the moment an organization has enough case volume that one person can't both triage _and_ personally track every technician's location and skillset, splitting Dispatcher into its own role becomes a real question. That's a future trigger condition, not a present gap.

### 3. Field Technician

- **Maps to:** **nothing in `MemberRole` — by design.** [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md) already made this explicit: a `Technician` is a directory record, not a login-capable actor. This is the one actor in this document with zero product access.
- **Responsibilities:** the actual physical work — diagnosing and fixing a station, connector, or EVSE issue on-site.
- **Permissions:** none, structurally. Every fact about a technician's work enters MOVOS through an operator's hands (a phone call, then a typed note or a `WorkOrder` transition performed on the technician's behalf).
- **Decisions:** real-world decisions (how to fix something) that MOVOS never sees directly — only the outcome, as reported.
- **KPIs:** derivable _about_ a technician (resolution time and recurrence rate of the work orders assigned to them — the same metric shape [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) already established for recommendation types, applicable to technicians once real `WorkOrder` data exists), but never self-reported _by_ one, since they have no way to report anything themselves.
- **Daily workflow:** [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md) describes this one from the outside, honestly, since MOVOS has no inside view of it.

### 4. Operations Manager

- **Maps to:** `MemberRole.ADMIN` — the real role one tier above `OPERATOR` in the enum's own declared order, already used for structural/creation-level permissions (`@Roles(OWNER, ADMIN)` on every `POST`/archive route).
- **Responsibilities:** supervision, not day-to-day case work — SLA policy ownership, escalation handling, staffing/roster decisions (`Technician.active`/`shift`), and periodic performance review.
- **Permissions:** everything an Operator can do, plus structural changes (provisioning a station, archiving a site, rotating an OCPP secret) that `OPERATOR` cannot.
- **Decisions:** SLA targets ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)'s proposed defaults are exactly the kind of number this actor should own and tune), escalation-level ownership ([ESCALATION_MODEL.md](./ESCALATION_MODEL.md)), and reassignment when a technician is unavailable or overloaded.
- **KPIs:** fleet-wide trend metrics — [WIDGET_VALUE_ANALYSIS.md](../product/WIDGET_VALUE_ANALYSIS.md) already found Analytics serves exactly this persona's cadence (weekly, not daily), and [USER_DECISION_MATRIX.md](../product/USER_DECISION_MATRIX.md) independently arrived at the same "economic buyer / periodic reviewer" persona from the commercial side — three separate documents converging on the same actor from three different angles.
- **Daily workflow:** [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md).

### 5. Customer Support

- **Maps to:** `MemberRole.SUPPORT` — real, defined in the enum since CAP-002/003's authentication foundation, and **never yet exercised by any shipped feature.** This document is the first place in the engagement's history that gives this role a real job to do.
- **Responsibilities:** the human intake point for anything a driver reports directly — a stuck connector, a failed charge, a billing question — none of which MOVOS currently has a structured channel for ([PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #4).
- **Permissions:** today, effectively identical to `VIEWER` in practice, since no feature branches on `SUPPORT` specifically yet — a real, honest gap, not a design choice.
- **Decisions:** whether a driver's report becomes a `WorkOrder` (`source: CUSTOMER_REPORT`), and — uniquely among all the actors here — whether a case is _actually_ closed from the customer's point of view, which may be a different fact than whether the underlying technical problem is fixed (see [RESPONSIBILITY_MATRIX.md](./RESPONSIBILITY_MATRIX.md)'s customer-complaint row).
- **KPIs:** first-response time to a customer report, and — not yet measurable — actual customer satisfaction with the resolution, which depends on a customer-contact channel that doesn't exist yet.
- **Daily workflow:** not mapped in this sprint — no shipped surface exists for this actor to have a day inside MOVOS yet, an honest gap named here rather than a workflow invented to fill it.

### 6. Property Administrator

- **Maps to:** `MemberRole.VIEWER`, for the smallest operators, or `MemberRole.OPERATOR` directly for a property manager who _is_ the day-to-day operator of their own small network — this is context-dependent, not a fixed mapping, and correctly so.
- **Responsibilities:** oversight of charging as an amenity, not a core operating business — matches [ICP_AND_BUYER_PERSONAS.md](../commercial/ICP_AND_BUYER_PERSONAS.md)'s `HOA_CONDOMINIUM` segment exactly, "thin ops teams, low tolerance for complexity."
- **Permissions:** read-mostly in the common case; this actor is far more likely to be the account's `VIEWER` checking in occasionally than its `OPERATOR` doing daily case work.
- **Decisions:** budget/continuation decisions (does this amenity keep getting funded), not operational ones.
- **KPIs:** uptime and complaint volume, read passively, not chased daily.
- **Daily workflow:** effectively none — this actor's relationship to MOVOS is closer to the Operations Manager's weekly cadence than the Network Operator's daily one, at a much lighter touch.

### 7. External Contractor

- **Maps to:** functionally the same as `Technician`, with an open modeling question this document surfaces rather than resolves: [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)'s current fields (`fullName`, `phone`, `email`, `city`, `zone`, `active`, `shift`, `skills`, `availability`) don't distinguish an employee from a contracted third party — no `employmentType` or `organizationAffiliation` field exists. For a single-technician pilot this distinction doesn't matter; the moment MOVOS serves an operator who outsources field work entirely to a contracting firm, it plausibly does (different invoicing relationship, different data-sharing boundary, possibly a contractor working across _multiple_ MOVOS tenant organizations rather than belonging to just one).
- **Responsibilities/permissions/decisions:** identical to Field Technician in this version — no product distinction exists yet, and this document does not propose inventing one without real evidence of the need, the same discipline `TECHNICIAN_MODEL.md` already applied to `skills`.

## Coverage table — every real `MemberRole` value, and every actor without one

| Real role / actor | Who plays it                                                                                                                                   | Currently exercised by a shipped feature?                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OWNER`           | Organization's commercial decision-maker — the [ICP_AND_BUYER_PERSONAS.md](../commercial/ICP_AND_BUYER_PERSONAS.md) economic buyer, in-product | Yes — structural/provisioning routes                                                                                                              |
| `ADMIN`           | Operations Manager                                                                                                                             | Yes — same structural routes as `OWNER`                                                                                                           |
| `OPERATOR`        | Network Operator, Dispatcher (same account)                                                                                                    | Yes — the entire console (WO-ARGOS-022 through -031)                                                                                              |
| `SUPPORT`         | Customer Support                                                                                                                               | **No** — real role, zero shipped features use it yet                                                                                              |
| `ANALYST`         | The Analytics screen's real audience (per [WIDGET_VALUE_ANALYSIS.md](../product/WIDGET_VALUE_ANALYSIS.md))                                     | **No** — `/analytics` has no `@Roles()` restriction; any authenticated member can view it today, `ANALYST` included but not specifically required |
| `VIEWER`          | Property Administrator, or any read-only stakeholder                                                                                           | Partially — implicitly, by having no elevated permissions, rather than by any feature built specifically for it                                   |
| _(no role)_       | Field Technician, External Contractor                                                                                                          | Structurally outside the account system, per [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)                                                         |

## An honest gap this document has to name

`ActionController` (WO-ARGOS-026) declares `@UseGuards(JwtAuthGuard, OrgContextGuard, RolesGuard)` at the controller level but **no `@Roles()` restriction on any individual route** — meaning every one of the six roles, including `VIEWER` and `ANALYST`, can call `POST /actions` and `PATCH /actions/:id` today, the same write authority this document assigns conceptually to the Network Operator alone. The actor model in this document describes who _should_ hold each responsibility; the real, already-shipped permission enforcement doesn't yet match it everywhere. [WORKORDER_READINESS.md](./WORKORDER_READINESS.md) returns to this gap directly when assessing whether `WorkOrder`'s own transitions should repeat the same pattern or close it from the start.
