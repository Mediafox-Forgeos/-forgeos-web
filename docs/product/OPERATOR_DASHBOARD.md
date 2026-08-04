# Operator Dashboard (Discovery Description)

**Work order:** WO-ARGOS-018 (CAP-X Discovery — Operator Control Center)
**Status:** PRODUCT DISCOVERY. This document describes a dashboard concept in prose and layout terms only. **No component, route, API, or schema is implied or authorized by this document.** Every widget below is annotated with whether its data exists in MOVOS today (see [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) for the underlying formulas and gaps) — this description does not assume anything not already justified in the three preceding discovery documents.

## Layout concept

A single scrollable page, not a multi-tab application, on the reasoning laid out in [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md): the first screen has to answer "is anything broken, and is it earning" in one glance, then let the operator drill down — not force a click before any information appears. Three vertical zones, top to bottom in priority order:

1. **Status strip** (always visible, top of page) — the P0 glance-and-know zone.
2. **Attention queue + map** (side by side on wide screens, stacked on narrow) — the P0 triage zone.
3. **Trends and detail tables** (below the fold) — the P1 investigation zone, for when the operator has time to look deeper, not for the first three seconds on the page.

This ordering directly mirrors [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md)'s P0/P1 classification — nothing P1 or P2 is placed above anything P0.

## Zone 1 — Status strip

A row of compact summary widgets, each answering one yes/no-shaped question at a glance.

| Widget          | Shows                                                                                                                           | Data status                                                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fleet status    | "39/40 sites OK" style count, `AVAILABLE`/`CHARGING`/`OCCUPIED` vs `UNAVAILABLE`/`FAULTED`/`OFFLINE` connector counts rolled up | Real data (`Connector.status`), zero aggregation exists today                                                                                                                                                                          |
| Connectivity    | Stations `ONLINE` / `OFFLINE` / `UNKNOWN` count                                                                                 | Real data (`ChargingStation.connectivityStatus`), zero aggregation exists today                                                                                                                                                        |
| Active sessions | Live count, `ACTIVE`/`SUSPENDED`                                                                                                | Real data (`ChargingSession.status`), zero aggregation exists today                                                                                                                                                                    |
| Stuck sessions  | Count of `OFFLINE` sessions, with a distinct visual treatment for any past the 15-minute reconnect window                       | Real data, zero surfacing exists today — this widget did not exist as a concept before this discovery (see [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 8)                                                                               |
| Energy today    | kWh delivered today vs. same time yesterday                                                                                     | Real data (`ChargingSession.energyWh`), zero aggregation exists today                                                                                                                                                                  |
| Revenue today   | Currency value, today vs. baseline                                                                                              | **Not computable today** — no `TariffSnapshot` is ever populated. This widget would need to render an explicit "pricing not yet configured" state rather than a silent zero, so the gap is visible rather than misread as "no revenue" |

Each widget is a number plus a one-word/one-color state (green/amber/red), not a chart — charts belong in Zone 3. The strip's job is triage speed, not detail.

## Zone 2 — Attention queue and map

### Attention queue

A ranked list, not a raw event feed — directly implementing the three-tier ranking from [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) ("what requires attention"):

1. Money-losing-now items first (a normally-busy station gone `FAULTED`/`OFFLINE` during its own historical peak hours).
2. Stuck/ambiguous-ownership items next (sessions in `OFFLINE` past the reconnect window).
3. Pattern items last (a flapping connector, surfaced only once a recurrence threshold is crossed — see [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 10 — not on every single fault, to avoid alert fatigue).

Each queue item supports an inline action: acknowledge, dismiss (with a required reason, so dismissals themselves become a data trail), or drill into the affected station/session's detail view. No item silently disappears — the daily-workflow discovery names "did support already know about this" as a named anxiety, and a queue that can vanish without a decision trail would recreate exactly that uncertainty.

**Data status:** the individual signals are real (status fields, session state); the _queue_ — ranking, thresholding, and acknowledge/dismiss workflow — is entirely new product surface. No `Alert` model, no notification pipeline, and no dismissal/acknowledgment history exists in MOVOS today (Feature Matrix: Alerts is Mock, 5%).

### Map

A geographic view of sites, colored by the same status tiers as the attention queue (not a separate color scheme — consistency between the queue and the map is what lets an operator go "map shows red pin in the east cluster" → "queue confirms which station" without re-learning a second visual language).

- Pin per site, sized or badged by site scale (number of stations) so a five-charger site and a fifty-charger site aren't visually equal.
- Color reflects the worst status present at that site (a site with 9 fine stations and 1 faulted one still shows amber/red — hiding a real problem inside a "mostly fine" average is exactly the undifferentiated-data anxiety the workflow discovery names).
- Click-through to the site's own station/connector detail.

**Data status:** `Site.latitude`/`longitude` are real, production-ready fields (Location capability, Feature Matrix: 100%) — this widget is a rendering layer over already-solid data, the cheapest P0 item in this whole document to build. Per-site status rollup is new aggregation, same gap as the status strip above.

## Zone 3 — Trends and detail tables

Below the fold, for when an operator has moved past "is anything on fire" into "how is my business actually doing" — a deliberately different cognitive mode, which is why it's placed after, not beside, the P0 zones.

- **Energy/session trend chart** — a time series (daily granularity, selectable range) of energy delivered and session count, so an operator can see whether last night's incident actually cost volume or was a blip inside normal variance. Real underlying data (`ChargingSession`), no rollup/charting exists today.
- **Utilization/occupancy chart** — per-site or fleet-wide, showing the KPI 4/9 numbers from [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) over time. Partially blocked — occupancy (a snapshot metric) is available now; utilization (a time-integrated metric) needs the status-history log gap named in that document.
- **Session table** — a filterable, sortable list of recent `ChargingSession` rows (site, station, status, duration, energy, termination reason), the drill-down destination from both the attention queue and the trend charts. Real data, no list/filter UI exists today (Feature Matrix: Sessions frontend is "mock frontend not migrated").
- **Failed-session breakdown** — a small table or chart grouping terminated sessions by `terminationReason` (KPI 7's real, already-captured breakdown: `FAULT` vs `CABLE_DISCONNECTED` vs `USER_CANCELLED` vs `NETWORK_FAILURE`, etc.), because this single already-existing field distinguishes equipment problems from customer behavior without any new instrumentation.
- **Fault recurrence table** — per-connector/station fault count over the selected period, feeding the Maintenance module decision (dispatch or wait). Same status-history gap as the utilization chart.

## Explicitly not on this dashboard

Consistent with [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md)'s P2 classifications and this work order's own scope boundary:

- No reservation calendar or booking UI (Reservations, P2, no underlying model).
- No invoice list or payment-collection UI (Billing/Invoices — commercially real via CAP-009's `BillingAccount`, but not a daily-operational screen per the workflow discovery; sequencing is [OPERATOR_STRATEGY_RECOMMENDATION.md](./OPERATOR_STRATEGY_RECOMMENDATION.md)'s subject).
- No customer-support ticket/incident-lookup UI (P2, no model).
- No tariff _editing_ UI (Tariffs is P1 for _visibility_, not for rate-setting workflows — a materially larger, separate product surface).

## Widgets/sections summary (as required by Objective 4)

| Category     | Included                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **Widgets**  | Fleet status, Connectivity, Active sessions, Stuck sessions, Energy today, Revenue today (degraded-state widget)            |
| **Sections** | Status strip, Attention queue, Map, Trends, Detail tables                                                                   |
| **Alerts**   | The attention queue itself — ranked, three-tier, acknowledge/dismiss-with-reason, no silent disappearance                   |
| **Map**      | Site-level pins, status-colored, badge-scaled, click-through to station/connector detail                                    |
| **Charts**   | Energy/session trend, utilization/occupancy trend                                                                           |
| **Tables**   | Session list (filterable/sortable), failed-session breakdown by `terminationReason`, fault recurrence per connector/station |
| **Actions**  | Acknowledge, dismiss (with reason), drill into site/station/session detail, filter/sort tables, select trend date range     |
