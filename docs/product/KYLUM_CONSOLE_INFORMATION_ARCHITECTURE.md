# Kylum Console — Information Architecture

**Work order:** WO-ARGOS-030 (Kylum Console Foundation)
**Status:** PRODUCT DESIGN. No code, API, migration, or `schema.prisma` change. Every "real today" claim below points at a shipped service or component on `main`; every "not real yet" claim is stated as plainly as the shipped ones.
**Mission:** the information architecture of the Kylum Console MVP — what the operator sees, organized around the question each screen answers, not around which sprint happened to build which widget.

## The problem this IA actually solves

MOVOS already has real operational data and a real operator-facing page — `/dashboard`, composed by `OperatorLive` (WO-ARGOS-022/025/026). But that page is an **accretion**, not an **architecture**: `FleetMap`, `StationStatusWidget`, `ConnectivityWidget`, `ActiveSessionsWidget`, `OccupancyWidget`, `OperationalIntelligenceWidget`, and `OperationalActionsSection` are stacked vertically in the order each sprint happened to add them, all on one page, with no distinction between "what tells me the network is healthy," "where is the problem," "what needs my hands," and "is this business working." The mission statement's own framing is exactly right: this is not a request to build a dashboard — it's a request to organize what already exists (plus what's honestly still missing) around the four real questions an operator actually asks, each on its own screen.

## Who this is for

The day-to-day operations champion persona ([ICP_AND_BUYER_PERSONAS.md](../commercial/ICP_AND_BUYER_PERSONAS.md)) — the person who logs in every morning, not the economic buyer evaluating whether to pay for MOVOS. Every hierarchy decision below is made for someone who opens this **once a day, under time pressure, before their first coffee** — not for someone exploring the product for the first time.

## The four screens, and what each one is for

| Screen               | Question it answers                  | Real data available today                                                          | Not real yet                                                                        |
| -------------------- | ------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Command Center    | "Is my network healthy right now?"   | Station health, connectivity, active sessions, occupancy, open Actions             | Revenue, technician location/dispatch                                               |
| 2. Network Map       | "Where are my operational problems?" | Site/station health with lat/long, connectivity, occupancy                         | Live connector-level map pins (today: site- and station-level only)                 |
| 3. Operations Center | "What needs attention today?"        | Actions (`OPEN`/`ACKNOWLEDGED`/`ASSIGNED`/`RESOLVED`/`DISMISSED`), assignee, notes | Maintenance tickets, SLA timers, technician identity/location, intervention history |
| 4. Business Overview | "Is the business growing?"           | Session counts, energy delivered (`ChargingSession.energyWh`)                      | Revenue, utilization trend, growth-over-time — no rollup service exists yet         |

The **Not real yet** column is not a design failure — it is the honest boundary this document is required to draw. Screens 1, 3, and 4 all include elements that describe real operator needs MOVOS cannot yet answer with real data. The wireframes ([KYLUM_CONSOLE_WIREFRAMES.md](./KYLUM_CONSOLE_WIREFRAMES.md)) and this document both mark those elements explicitly rather than quietly wiring them to placeholder numbers that would look real and aren't.

## Screen 1 — Command Center

**Question:** _Is my network healthy right now?_ **Budget:** answerable in under five seconds, without scrolling.

| Widget                           | Real source today                                                            | Status                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Active stations (online / total) | `StationHealthService.summarizeConnectivity()`                               | **Real**                                                                                                        |
| Active sessions                  | `ChargingSession` where `status IN (ACTIVE, SUSPENDED)`                      | **Real**                                                                                                        |
| Energy delivered today           | `SUM(ChargingSession.energyWh)` for sessions started today                   | **Real**, needs a new rollup query (no service computes "today" specifically yet — the raw data is there)       |
| Estimated revenue                | Would need `TariffSnapshot.energyPricePerKwh` × energy delivered, aggregated | **Not real** — no revenue-rollup service exists; explicitly out of scope for this WO ("DO NOT work on billing") |
| Open incidents                   | `ActionService.list()` filtered to non-terminal status                       | **Real**, using `Action`, not a separate Incident model — see the honest naming note below                      |
| Technicians on route             | Would need a technician/dispatch/location concept                            | **Not real** — no `Technician` entity, no dispatch/location tracking exists anywhere in the schema              |

**Honest naming note:** the mission's suggested widget is "open incidents." What MOVOS actually has today is `Action` (WO-ARGOS-026) — a narrower, `RecommendationService`-scoped entity, deliberately not the fuller `Alert`/`Incident`/`MaintenanceTicket` architecture ([CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)) that has been evaluated and deferred four times already. This screen should say "acciones abiertas" (open actions), the real, correct vocabulary, not borrow "incident" language the backend doesn't yet support — see [KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md)'s vocabulary-discipline principle.

**Hierarchy:** one health verdict (a single word: healthy fleet / attention needed / critical, derived from the same precedence logic `StationHealthService.computeHealth()` already uses — connectivity before fault) sits above everything else, largest on the screen. The six supporting numbers sit below it in one row, equal visual weight, no single one dominant — this is a scan, not a story.

## Screen 2 — Network Map

**Question:** _Where are my operational problems?_

| Layer                                         | Real source today                                                                               | Status                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Site pins with worst-status color             | `StationHealthService.summarizeBySite()` (already returns `latitude`/`longitude`/`worstStatus`) | **Real** — this is exactly what `FleetMap` already renders                                                                                |
| Station-level detail on site drill-in         | `StationHealthService.summarizeFleet()` + `computeHealth()` per station                         | **Real**                                                                                                                                  |
| Connector-level occupancy on station drill-in | `StationHealthService.getOccupancy()`                                                           | **Real**                                                                                                                                  |
| Live connectivity flicker (real-time push)    | Would need websocket/live-update delivery to the browser                                        | **Not real** — today's map is polled, not pushed (`use-polled-resource.ts`), which is an honest, acceptable interim, not a defect to hide |

**Hierarchy:** the map is the whole screen — no competing widgets beside it. A right-hand or bottom drill-down panel appears only once a site or station is selected, never before. This is the one screen where the mission's own instruction ("avoid excessive charts") is easiest to violate by cramming summary tiles around the map; this IA deliberately keeps the map alone.

## Screen 3 — Operations Center

**Question:** _What needs attention today?_

| Column                                           | Real source today                                                               | Status                                                                                                                                                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pending / Assigned / Resolved case columns       | `ActionService.list()`, exactly `OperationalActionsSection`'s existing grouping | **Real**                                                                                                                                                                                                                                |
| Priority (severity)                              | `Action.severity` (`HIGH`/`MEDIUM`)                                             | **Real**                                                                                                                                                                                                                                |
| Assigned technician                              | `Action.assignedToUserName`                                                     | **Real**, but scoped to "assign to self" only in the current UI ([ACTION_BUTTONS.md-equivalent limitation](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md) — no members-list endpoint exists to assign to a teammate) |
| SLA timer                                        | Would need a due-by field and a countdown                                       | **Not real** — `Action` has no SLA/due-date field; time-in-state is derivable from `createdAt`, but a true SLA needs a target to count down against, which nothing defines yet                                                          |
| Intervention history (full audit trail per case) | Would need a transition-history log                                             | **Not real** — [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) already found this exact gap: `Action` overwrites `status`/`assignedToUserId` in place, so only the _current_ state is knowable, not the sequence that produced it          |
| Maintenance tickets (distinct from Actions)      | Would need the deferred Alert/Incident/MaintenanceTicket model                  | **Not real** — same CAP-X_INCIDENT_FLOW.md boundary as Screen 1                                                                                                                                                                         |

**Hierarchy:** this screen is the Action Center's existing three-column model (`OperationalActionsSection`), promoted from "a section at the bottom of the dashboard" to its own screen, with room to actually work a case (the full `ActionButtons` transition control) instead of a cramped inline control.

## Screen 4 — Business Overview

**Question:** _Is the business growing?_

| Widget                                                | Real source today                                                                                                            | Status                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session count trend                                   | `ChargingSession` grouped by day/week                                                                                        | **Real**, needs a new rollup query                                                                                                                                                                                        |
| Energy sold (kWh) trend                               | `SUM(ChargingSession.energyWh)` over time                                                                                    | **Real**, needs a new rollup query                                                                                                                                                                                        |
| Top-performing stations                               | Same aggregation `RecommendationService.getComparativeUnderperformance()` already computes, inverted (best instead of worst) | **Real**, reuses an existing pattern                                                                                                                                                                                      |
| Revenue trend                                         | `TariffSnapshot` × energy, over time                                                                                         | **Not real** — no revenue-rollup service; billing/invoicing is explicitly out of scope for this WO                                                                                                                        |
| Utilization (occupancy over time, not just right now) | Would need historical occupancy snapshots                                                                                    | **Not real** — `StationHealthService.getOccupancy()` is point-in-time only; no `OccupancySnapshot` history exists (the same gap [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) named for recommendations #3/#5) |

**Hierarchy:** this is the one screen where trend-over-time, not a single current number, is the point — the only screen in this IA where a line chart is appropriate at all (see [KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md)'s "avoid excessive charts" principle: three trends here, not a chart per widget everywhere).

## The information hierarchy principle across all four screens

Every screen has exactly one **primary** answer (the health verdict, the map itself, the case columns, the growth trend), a small set of **supporting numbers** that back it up, and only then — behind a click, never in the first view — **detail**. This is the same discipline [KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md)'s five-second rule requires structurally, not just visually: an IA that puts ten equally-weighted facts on screen one has already failed the rule before a single pixel is drawn.

## What this supersedes

This IA proposes retiring `OperatorLive`'s single-page composition in favor of the four dedicated screens above, each independently addressable and each linked from the reorganized navigation ([KYLUM_CONSOLE_NAVIGATION.md](./KYLUM_CONSOLE_NAVIGATION.md)). No component listed above needs to be rebuilt from scratch — `FleetMap`, `StationStatusWidget`, `ConnectivityWidget`, `ActiveSessionsWidget`, `OccupancyWidget`, `OperationalIntelligenceWidget`, and `OperationalActionsSection` are all real, tested, and reusable; this document proposes where each one belongs, not that any of them are wrong.
