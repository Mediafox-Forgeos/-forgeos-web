# CAP-X — Dashboard Widgets

**Work order:** WO-ARGOS-019 (CAP-X Architecture)
**Status:** ARCHITECTURE ONLY. No component, route, or UI code is implied. This document formalizes [OPERATOR_DASHBOARD.md](../product/OPERATOR_DASHBOARD.md)'s widget descriptions into `DashboardWidget` catalog entries, each backed by a named contract from [CAP-X_CONTRACTS.md](./CAP-X_CONTRACTS.md).
**Part of:** [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md).

## Objective 5 — Main dashboard widgets

Each entry below is a `DashboardWidget.type` value (the enum named in [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md)'s entity model), with its data source, refresh cadence, and the contract method that would back it. Zone placement matches [OPERATOR_DASHBOARD.md](../product/OPERATOR_DASHBOARD.md)'s layout (status strip → attention queue/map → trends/tables), reproduced here with the domain-layer detail that document didn't yet have available.

### Zone 1 — Status strip

| Widget            | Data source                                                     | Backing contract                                                                                                                                                                             | Refresh                            |
| ----------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `FLEET_STATUS`    | `Connector.status`/`Evse.status` counts, rolled up per site/org | `StationHealthService.summarizeFleet()`                                                                                                                                                      | Real-time (poll or live-subscribe) |
| `CONNECTIVITY`    | `ChargingStation.connectivityStatus` counts                     | `StationHealthService.summarizeConnectivity()`                                                                                                                                               | Real-time                          |
| `ACTIVE_SESSIONS` | `ChargingSession.status IN (ACTIVE, SUSPENDED)` count           | Direct read of existing `ChargingSession` — no new contract needed, this widget requires no CAP-X entity at all                                                                              | Real-time                          |
| `STUCK_SESSIONS`  | `ChargingSession.status = OFFLINE`, age-flagged past 15 minutes | `AlertService.countOpenByType(SESSION_STUCK)`                                                                                                                                                | Real-time                          |
| `ENERGY_TODAY`    | `SUM(ChargingSession.energyWh)` for today vs. baseline          | Direct read of existing `ChargingSession` — no new contract needed                                                                                                                           | Real-time (session-level updates)  |
| `REVENUE_TODAY`   | Would require `TariffSnapshot` population                       | **Blocked** — see [OPERATOR_KPIS.md](../product/OPERATOR_KPIS.md) KPI 3. This widget renders an explicit "pricing not configured" state, not a contract call, until a pricing service exists | N/A                                |

### Zone 2 — Attention queue and map

| Widget            | Data source                                                                          | Backing contract                              | Refresh                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ATTENTION_QUEUE` | Ranked `Alert`/`Incident` list, three-tier severity ordering                         | `IncidentService.listAttentionQueue(scope)`   | Real-time                                                                           |
| `MAP`             | `Site.latitude`/`longitude` (real, production data) + per-site worst `StationHealth` | `StationHealthService.summarizeBySite(scope)` | Near-real-time (site-level rollup changes less often than individual station state) |

### Zone 3 — Trends and detail tables

| Widget                                                                                                     | Data source                                                                     | Backing contract                                                                                                         | Refresh                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `TREND_CHART` (energy/session)                                                                             | Time series of `ChargingSession` counts/energy, by day                          | `OccupancySnapshotService` for the connector-status half; direct `ChargingSession` aggregation for energy/session counts | Daily rollup                                              |
| `TREND_CHART` (utilization/occupancy)                                                                      | `OccupancySnapshot` rows over the selected range                                | `OccupancySnapshotService.queryRange(scope, range)`                                                                      | Daily rollup                                              |
| `SESSION_TABLE`                                                                                            | Filterable/sortable `ChargingSession` list                                      | Direct read of existing `ChargingSession` — no new contract needed                                                       | On-demand (filter/sort triggers a query, not a live feed) |
| Failed-session breakdown (part of `SESSION_TABLE` zone, not a separate `DashboardWidget.type` — see below) | `ChargingSession.terminationReason` grouped counts                              | Direct read of existing `ChargingSession` — no new contract needed                                                       | On-demand                                                 |
| `FAULT_RECURRENCE`                                                                                         | `Alert(type=FLAPPING_CONNECTOR)` history plus underlying `STATION_FAULT` counts | `AlertService.recurrenceReport(scope, range)`                                                                            | Daily rollup                                              |

**Note on the failed-session breakdown:** [OPERATOR_DASHBOARD.md](../product/OPERATOR_DASHBOARD.md) lists it as a distinct table, but it requires no CAP-X entity and no distinct `DashboardWidget.type` — it's a grouping view over the same `SESSION_TABLE` data source. Listing it as its own widget type in the catalog would be inventing configuration surface (a separate position, a separate on/off toggle) for what is really a display mode of one existing widget. This document narrows the discovery doc's list from 13 named table/chart items down to 10 `DashboardWidget.type` values for exactly this reason.

## Widget catalog summary

The `DashboardWidget.type` enum, final form:

```
FLEET_STATUS | CONNECTIVITY | ACTIVE_SESSIONS | STUCK_SESSIONS | ENERGY_TODAY |
ATTENTION_QUEUE | MAP | TREND_CHART | SESSION_TABLE | FAULT_RECURRENCE
```

`REVENUE_TODAY` is deliberately **not** included in this enum. Per [OPERATOR_KPIS.md](../product/OPERATOR_KPIS.md), it cannot be computed today, and per [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md)'s domain-boundary statement, this capability does not own pricing logic. [OPERATOR_DASHBOARD.md](../product/OPERATOR_DASHBOARD.md) proposed it as a degraded-state placeholder widget; this architecture document goes one step further and excludes it from the widget catalog entirely, on the reasoning that a widget type this domain can never legitimately populate does not belong in this domain's own catalog — it belongs to whichever future capability (Tariffs, then Billing) actually builds pricing, at which point it becomes that capability's widget to register, potentially reusing this same `DashboardWidget` entity if it still exists by then.

## Widgets requiring no new CAP-X contract

Three widgets (`ACTIVE_SESSIONS`, `ENERGY_TODAY`, `SESSION_TABLE`) read `ChargingSession` directly and need nothing this domain defines — worth stating plainly, because it means roughly a third of the P0/P0-adjacent dashboard surface has zero dependency on any entity in [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md) shipping first. This is a sequencing-relevant fact for whichever future work order scopes an actual implementation phase: the widgets requiring `StationHealth`/`Alert`/`Incident` (`FLEET_STATUS`, `CONNECTIVITY`, `STUCK_SESSIONS`, `ATTENTION_QUEUE`, `MAP`, `FAULT_RECURRENCE`) are a materially larger build than the three that need nothing new at all.
