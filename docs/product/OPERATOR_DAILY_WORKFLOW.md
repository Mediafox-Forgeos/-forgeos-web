# Operator Daily Workflow

**Work order:** WO-ARGOS-018 (CAP-X Discovery — Operator Control Center)
**Status:** PRODUCT DISCOVERY. No code, schema, or UI implied by this document. Every claim about what MOVOS can do _today_ is checked against `apps/movos-api/prisma/schema.prisma` and the [Feature Matrix](./MOVOS_FEATURE_MATRIX_v1.0.md); every claim about what an operator _needs_ is a discovery finding, clearly marked as such.
**Premise (as instructed):** MOVOS's customer is not the driver. It is the company operating the infrastructure — a charging-network operator, an electrolinera, a condominium HOA, a shopping mall, a fleet operator, a construction company. This document describes that company's first daily touchpoint with MOVOS.

## Who is opening the screen

Five customer shapes were named in the work order. They share a first-screen need (is my infrastructure working, is it earning money, does anything need me right now) but differ sharply in what "attention" means:

| Operator shape                                       | What "down" costs them                                           | What they check first                                             |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| Charging-network operator (multi-site)               | Direct revenue loss, SLA penalties to landlords                  | Fleet-wide uptime, revenue trend, worst-performing sites          |
| Electrolinera (fuel-station-style charging business) | Forecourt throughput, queueing, brand reputation                 | Occupancy right now, queue length, any charger down during peak   |
| Condominium / HOA                                    | Resident complaints, shared-cost disputes                        | Which unit/resident is charging, fairness of usage, faults        |
| Shopping mall                                        | Foot traffic conversion, parking-lot experience, landlord optics | Whether chargers are available for visiting customers, complaints |
| Fleet operator                                       | Vehicles not ready for dispatch                                  | Which vehicles finished charging, which are stuck/faulted         |
| Construction company                                 | Equipment uptime on a remote/temporary site                      | Whether the one or two chargers on site are alive at all          |

This document describes the common first screen — the superset every shape needs a subset of — not five separate dashboards. Per-shape customization is a later product decision, out of scope for this discovery.

## Objective 1 — The first screen

### What information is visible

An operator's first screen answers one question before any other: **"Is anything broken right now, and is it making money?"** In order of what the eye actually needs first:

1. **Fleet-wide status summary** — how many sites, stations, and connectors are `AVAILABLE` / `CHARGING` / `OCCUPIED` / `UNAVAILABLE` / `FAULTED` / `OFFLINE` (the real `ConnectorStatus`/`EvseStatus` enum values already in `schema.prisma`), rolled up as counts, not a list. An operator with 40 sites does not want to scroll 40 rows to answer "is everything fine" — they want a single glance that says "39 fine, 1 not."
2. **Active sessions right now** — count and a short list of `ChargingSession` rows currently `ACTIVE`/`SUSPENDED`/`OFFLINE` (the real `ChargingSessionStatus` values), because these are live financial and operational events, not history.
3. **Connectivity health** — how many stations are `ONLINE` vs `OFFLINE` vs `UNKNOWN` (the real `ConnectivityStatus` enum, CAP-005), because a station that's administratively `ACTIVE` but has silently lost its network connection is invisible in every other view.
4. **Revenue/energy delivered, today vs. a comparable baseline** — even a coarse "kWh delivered today" and "sessions today" number, compared against yesterday or the same weekday last week, because the operator's mental model of "normal" is relative, not absolute.
5. **An attention queue** — a short, ranked list of things that need a human decision today, not a firehose of every event. See "what requires attention" below.

### What requires attention

Not everything abnormal deserves the same weight. Three tiers, ranked by what an operator would actually act on first:

- **Money-losing right now:** a station reporting `FAULTED`, or gone `OFFLINE`/`UNKNOWN` connectivity, while historically it's one of the busier ones for this time of day. A dead charger during a low-traffic overnight window is a shrug; the same charger dead at 8am on a weekday commute corridor is lost revenue happening at this exact moment.
- **Stuck state, ambiguous ownership:** a `ChargingSession` sitting in `OFFLINE` (CAP-005's real transition — a verified-stale connection moves an `ACTIVE`/`SUSPENDED` session to `OFFLINE`, not necessarily to `COMPLETED`) for longer than the 15-minute reconnect-recovery window this system already implements. Past that window, nobody — not the driver, not MOVOS, not the operator — knows whether the vehicle is still plugged in, still charging, or long gone. This is the single worst state in the current data model for operator anxiety, because it is neither "working" nor "resolved."
- **Pattern, not incident:** a specific connector or station that keeps flipping `FAULTED`→`AVAILABLE`→`FAULTED` (flapping) rather than one clean outage. A single fault is a fact; a flapping connector is a maintenance signal an operator would otherwise only notice by accident, days later, after enough drivers have already given up on it.

### What generates anxiety

This is the honest part of the discovery — the feelings, not just the facts, because a dashboard that doesn't address the anxiety fails even if every number on it is correct.

- **"Is a charger dead, or just quiet?"** — the gap between `ConnectivityStatus.OFFLINE` (verified-stale, CAP-005 already proves this) and `ConnectivityStatus.UNKNOWN` (unproven either way — the value the system deliberately assigns on startup rather than trusting stale pre-restart data, per `CONNECTIVITY_RUNTIME_GUIDE.md`) is a real distinction in the schema today, but nothing currently surfaces it to a human. An operator staring at "UNKNOWN" has no way to know if that means "we haven't checked yet" or "something is actually wrong," and that ambiguity is worse than a clean "down" signal.
- **"Is someone's car stuck mid-charge and I don't know it?"** — the `ChargingSession.OFFLINE` stuck-state above. This is the scenario every operator interviewed in analogous industries (parking, fuel, EV charging specifically) names unprompted: a customer standing next to a charger that says nothing, wondering if they're being charged, wondering if their car is charging, with no operator-side visibility into which is true.
- **"Am I losing money without knowing it?"** — a session that silently degenerates (partial energy delivery, a connector reporting `AVAILABLE` while a `ChargingSession` row still shows `ACTIVE` — a real inconsistency the current schema does not prevent between operational state and business state) erodes trust in every number on the dashboard, not just that one session.
- **"Did support already know about this, or am I the first to find out?"** — for a mall or condominium operator specifically, the anxiety is reputational: a resident or shopper complains before the operator's own dashboard would have surfaced the problem. Every day this is possible is a day the dashboard has failed at its actual job.
- **"Which of my 40 sites needs me today?"** — for the multi-site operator, undifferentiated data (every site shown with equal visual weight) is itself an anxiety generator, because it forces the operator to manually re-derive triage every single morning instead of MOVOS doing it once.

### What actions are taken daily

- Acknowledge or dismiss items in the attention queue (a fault is being worked on; a stuck session was resolved by a phone call to the driver; a flapping connector has a technician scheduled).
- Drill into one site or station from the summary view to see its own connector-level detail, connectivity history, and recent sessions.
- Check yesterday's/last-night's summary before deciding whether last night's incident needs escalation this morning versus already having self-resolved (e.g., a station that went `OFFLINE` at 2am and reconnected at 2:14am, inside CAP-005's own reconnect window, needing zero action).
- For a fleet operator specifically: confirm which vehicles finished charging and are ready for morning dispatch — a decision gate, not just information.
- Export or forward a summary to someone else (a landlord, a board, a regional manager) who does not log into MOVOS directly — an operator role, not a driver role, and one none of MOVOS's current five customer shapes can currently do at all, since no reporting/export capability exists yet (Feature Matrix: Reporting is Mock, 5%).

### What decisions are made

- **Escalate or wait:** does a fault get a technician dispatched today, or is it acceptable to leave until a routine maintenance visit? This decision needs the "pattern vs. incident" distinction above — a dashboard that can't distinguish those forces every fault to be treated as urgent, which trains operators to eventually ignore all of them.
- **Trust or investigate:** does an `UNKNOWN` connectivity reading get taken at face value, or does it need someone to physically check the site? Currently nothing in the product tells an operator which of those two responses is warranted.
- **Communicate or stay silent:** does this incident need a proactive message to affected drivers/residents/tenants, or will it self-resolve before anyone downstream notices? For a mall or condominium in particular, this is a reputational decision made daily under uncertainty, driven entirely by the quality of the first-screen information.
- **Prioritize which site gets attention first**, when more than one thing is wrong simultaneously — the multi-site operator's core daily triage decision, and the one most starved of tooling today (there is currently no cross-site rollup of any kind — see [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md)).

## What already exists to build this on

Every signal named above already has a real, schema-backed source in MOVOS today — this discovery is not proposing new device telemetry, only new ways of surfacing what CAP-002 through CAP-009 already capture:

| Signal                                       | Real source today                                                                                                                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Station/EVSE/connector operational status    | `ChargingStation.status`, `Evse.status`, `Connector.status` (CAP-002)                                                                                                                    |
| Device connectivity (ONLINE/OFFLINE/UNKNOWN) | `ChargingStation.connectivityStatus`, `lastConnectedAt`, `lastDisconnectedAt`, `lastSeenAt` (CAP-005)                                                                                    |
| Live/stuck session state                     | `ChargingSession.status`, including the real `OFFLINE` transition (CAP-004/CAP-005)                                                                                                      |
| Energy delivered                             | `ChargingSession.energyWh`, `MeterValue` telemetry (CAP-004)                                                                                                                             |
| Who is financially responsible               | `ChargingSession.billingAccountId` → `BillingAccount` (CAP-009) — real today, though nothing prices it yet (`TariffSnapshot` exists as schema, not yet populated by any pricing service) |
| Authorization/access attempts                | `AuthorizationAttempt` (CAP-004) — every credential presentation, accepted or not, already logged                                                                                        |

None of this is exposed through any dashboard, summary endpoint, or cross-site rollup today — every one of these fields is queryable per-record only, through the existing CRUD/read APIs, one station or one session at a time. That gap — real data, zero aggregation or surfacing — is this discovery's central finding, expanded on in [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md), [OPERATOR_KPIS.md](./OPERATOR_KPIS.md), and [OPERATOR_DASHBOARD.md](./OPERATOR_DASHBOARD.md).
