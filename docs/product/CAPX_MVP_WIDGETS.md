# CAP-X — MVP Dashboard Definition

**Work order:** WO-ARGOS-020 (Operator Control Center MVP Definition)
**Status:** PRODUCT DISCOVERY / PLANNING. No code, API, migration, or `schema.prisma` change. Selections below are a scoping decision, not an implementation.
**Hard caps (as instructed):** maximum 8 widgets, 3 tables, 5 actions.
**Built from:** the full widget catalog in [CAP-X_WIDGETS.md](../domain/CAP-X_WIDGETS.md) (10 widget types), filtered against [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md)'s buckets and a 30-day buildability constraint.

## Objective 1 — Selection

### Selection principle

Favor **disponible hoy** and **requiere backend** items — zero schema risk, days-to-weeks of effort each — over **requiere nuevo dominio** items, which cannot ship at all until one deliberate, well-scoped migration lands first. The one exception made below (the Attention Queue) is deliberate and justified on its own, not a slip in the principle — see "The one new-domain exception," below.

### The 8 widgets

| #   | Widget                                                                          | Bucket ([CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md)) | Why it's in the MVP                                                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `FLEET_STATUS`                                                                  | Requiere backend                                      | The single fact [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) names first — "is anything broken." Zero migration risk.                                                                                                   |
| 2   | `CONNECTIVITY`                                                                  | Requiere backend                                      | Answers the sharpest anxiety in the discovery (`ONLINE`/`OFFLINE`/`UNKNOWN` ambiguity) using a field that's been real since CAP-005.                                                                                                  |
| 3   | `ACTIVE_SESSIONS`                                                               | Requiere backend (count) / disponible hoy (list)      | The pulse-check number every operator shape checks first.                                                                                                                                                                             |
| 4   | `STUCK_SESSIONS`                                                                | Requiere backend                                      | The single highest-value, cheapest-to-build widget in this set — the `OFFLINE`-past-15-minutes condition needs no new table, just a filtered query, and it directly closes the worst anxiety this whole capability exists to address. |
| 5   | `ENERGY_TODAY`                                                                  | Requiere backend                                      | Fundamental throughput number, zero schema risk.                                                                                                                                                                                      |
| 6   | `MAP`                                                                           | Requiere backend                                      | `Site.latitude`/`longitude` is already production-grade; `StationHealth` (the color/status layer) needs no persistence at all — this widget is almost entirely presentation over data that already exists twice over.                 |
| 7   | `TREND_CHART` (energy/session only — **not** the occupancy/utilization variant) | Requiere backend                                      | `ChargingSession.startedAt`/`endedAt`/`energyWh` already carry a full time series; no `OccupancySnapshot` dependency for this specific chart.                                                                                         |
| 8   | `ATTENTION_QUEUE`                                                               | Requiere nuevo dominio (minimal slice)                | The one deliberate exception — see below.                                                                                                                                                                                             |

**Cut from the MVP:** `REVENUE_TODAY` (excluded from the full catalog already, per [CAP-X_WIDGETS.md](../domain/CAP-X_WIDGETS.md) — blocked on a different domain entirely, see [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md)'s Revenue exception) and `FAULT_RECURRENCE` (needs fault-transition history — the occupancy-trend-shaped gap, not buildable in 30 days). Both remain in the full architecture ([CAP-X_WIDGETS.md](../domain/CAP-X_WIDGETS.md)) for a later phase.

### The one new-domain exception: Attention Queue

Every other widget above needs zero migration. `ATTENTION_QUEUE` is the sole exception, deliberately kept in the MVP despite that cost, for one reason: **without it, "stuck sessions" and "connectivity lost" are numbers on a status strip, not things an operator can act on.** [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md)'s own daily-action list ("acknowledge or dismiss items in the attention queue") requires _some_ persisted record of what's been seen and what hasn't — a purely computed, non-persisted list can be displayed, but cannot be acknowledged, assigned, or resolved, and an operator control center that only ever shows problems without ever letting someone mark one as handled reproduces the exact undifferentiated-noise anxiety this whole capability is meant to solve.

The MVP therefore proposes the **smallest defensible slice** of the full architecture's `Alert`/`Incident` model ([CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md)), not the full thing:

- **`Alert`, restricted to 3 of the 5 architected types**: `STATION_FAULT`, `CONNECTIVITY_LOST`, `SESSION_STUCK` — all three are event-driven off an existing state transition, need no rolling-window history, and can be detected the moment the transition happens. `FLAPPING_CONNECTOR` and `HIGH_FAILURE_RATE` (the two rolling-window types) are cut from the MVP along with `FAULT_RECURRENCE` above, for the identical reason: they need historical data MOVOS doesn't store yet.
- **`Incident`, full architecture, unreduced** — the four-stage lifecycle (`OPEN`/`INVESTIGATING`/`RESOLVED`/`CLOSED`) is not simplified further; it was already minimal in [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md), and the "no silent disappearance" principle it encodes is exactly what makes the attention queue trustworthy rather than just another feed to ignore.
- **`MaintenanceTicket`, schema included, workflow UI deferred** — see [CAPX_MVP_SCREENS.md](./CAPX_MVP_SCREENS.md) for why the table ships but the interactive lifecycle (schedule/start/complete) does not, in this 30-day cut.

This is a single migration, adding three small, already-designed tables with no changes to any existing model — the same shape of change CAP-009's own foundation migration was, not a large or risky one.

### The 3 tables

| #   | Table                                                                                            | Screen it serves    | Bucket                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------- |
| 1   | Session table (filterable/sortable: site, station, status, duration, energy, termination reason) | Home / Station view | Requiere backend (list endpoint + filter/sort), disponible hoy at the per-record level  |
| 2   | Incident list table (status, assignee, station, opened/resolved dates)                           | Incidents view      | Requiere nuevo dominio (the `Incident` slice above)                                     |
| 3   | Maintenance ticket table (status, priority, station, scheduled date)                             | Maintenance view    | Requiere nuevo dominio (the `MaintenanceTicket` slice above), **read-only in this MVP** |

**Cut from the MVP:** the failed-session breakdown and fault-recurrence tables from the full architecture ([CAP-X_WIDGETS.md](../domain/CAP-X_WIDGETS.md)) — the former is a display mode of table 1 above, not a distinct table (same reasoning the architecture document already used to narrow 13 candidate table/chart items to 10 widget types); the latter needs the same missing history as `FAULT_RECURRENCE`.

### The 5 actions

| #   | Action                                            | Applies to      | Bucket                                                                 |
| --- | ------------------------------------------------- | --------------- | ---------------------------------------------------------------------- |
| 1   | Acknowledge (an `Alert`)                          | Attention queue | Requiere nuevo dominio (part of the `Alert` slice)                     |
| 2   | Dismiss, with required reason (an `Alert`)        | Attention queue | Requiere nuevo dominio                                                 |
| 3   | Assign (an `Incident`, to self or a teammate)     | Incidents view  | Requiere nuevo dominio (part of the `Incident` slice)                  |
| 4   | Resolve, with required notes (an `Incident`)      | Incidents view  | Requiere nuevo dominio                                                 |
| 5   | Drill into detail (station, session, or incident) | All screens     | Disponible hoy / requiere backend — pure navigation, no new write path |

**Deliberately excluded from the 5:** creating or transitioning a `MaintenanceTicket` (schedule/start/complete/cancel) — the full contract exists in [CAP-X_CONTRACTS.md](../domain/CAP-X_CONTRACTS.md), but wiring it to an interactive UI action would both exceed the 5-action cap and add scope to the riskiest, newest part of this MVP in its first 30 days. The Maintenance view ships as a read-only table (see table 3 above); a technician-facing update happens outside the product in this cut (a phone call, a spreadsheet, direct backend access) exactly as it does today, with MOVOS providing visibility, not yet dispatch.

## Summary against the caps

| Cap     | Limit | This selection |
| ------- | ----- | -------------- |
| Widgets | 8     | 8              |
| Tables  | 3     | 3              |
| Actions | 5     | 5              |

Every cap is met exactly, not padded — nothing here is included "because there was room." Each of the three lists above states explicitly what was cut and why, so the boundary is a decision record, not a silent omission.
