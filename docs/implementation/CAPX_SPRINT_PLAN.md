# CAP-X — Implementation Sprint Plan

**Work order:** WO-ARGOS-021 (Operator Control Center Implementation Plan)
**Status:** PLANNING ONLY. No code, migration, `schema.prisma` change, or API is created by this document. This is a sequencing plan for a future authorized implementation.
**Builds on:** the approved MVP scope — [CAPX_MVP_WIDGETS.md](../product/CAPX_MVP_WIDGETS.md), [CAPX_MVP_SCREENS.md](../product/CAPX_MVP_SCREENS.md), [CAPX_DATA_MATRIX.md](../product/CAPX_DATA_MATRIX.md) (WO-ARGOS-020) — and the architecture — [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md), [CAP-X_STATION_HEALTH.md](../domain/CAP-X_STATION_HEALTH.md), [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md), [CAP-X_CONTRACTS.md](../domain/CAP-X_CONTRACTS.md) (WO-ARGOS-019).

## Objective 1 — Three sprints

### Calendar framing

The 30-day window from [CAPX_INVESTOR_DEMO.md](../product/CAPX_INVESTOR_DEMO.md) does not divide evenly into three standard two-week sprints. This plan uses three **~10-calendar-day phases** instead — a compressed, pilot-paced cadence appropriate to a fixed demo deadline, not a claim that this is a sustainable ongoing sprint length. Sprint 1: days 1–10. Sprint 2: days 11–20. Sprint 3: days 21–30.

### Why this exact split, not an even 8-widgets-in-3-buckets split

The split the work order specifies (map/station-status/session-list, then incidents/alerts/maintenance, then analytics/KPIs/occupancy) turns out to align exactly with the risk structure [CAPX_DATA_MATRIX.md](../product/CAPX_DATA_MATRIX.md) already identified, not by coincidence:

- **Sprint 1 contains every widget that needs zero migration** — the entire "disponible hoy"/"requiere backend" surface. This is deliberate risk sequencing: the riskiest, newest part of the MVP (a schema change touching multi-tenant, human-assignable records) is not on the critical path for the _first_ thing a stakeholder sees. If Sprint 1 slips, there is still a working, real-data dashboard to show.
- **Sprint 2 is where the one authorized migration happens** ([CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md)'s `Alert`/`Incident`/`MaintenanceTicket` slice, scoped down per [CAPX_MVP_WIDGETS.md](../product/CAPX_MVP_WIDGETS.md) to 3 `Alert` types and a read-only `MaintenanceTicket`). Isolating it to its own phase, after Sprint 1's non-migration work has already de-risked the aggregation/`StationHealth` layer these new services will themselves depend on, follows the same sequencing discipline this engagement used for CAP-008 (architecture) before CAP-009 (schema) — do the low-risk groundwork, then take the one deliberate schema risk with everything else already stable underneath it.
- **Sprint 3 (analytics/KPIs/occupancy) is placed last for two reasons, not one.** First, it needs no migration either, so it _could_ run in parallel with Sprint 1 in principle — it is sequenced last specifically because a trend chart is more convincing with real accumulated data behind it; a "day 3" trend chart showing three data points is not a compelling demo artifact regardless of how correctly it's built. Second, it is explicitly lower-priority (P1, not P0, per [OPERATOR_MODULE_PRIORITY.md](../product/OPERATOR_MODULE_PRIORITY.md)) — if the 30-day window compresses, Sprint 3 is the correct thing to cut first, and sequencing it last makes that an easy, low-disruption decision rather than a mid-project scope fight.

### Sprint 1 (Days 1–10) — Mapa operacional, estado de estaciones, lista de sesiones

| Item                 | MVP widgets/tables covered                                                        | Migration required |
| -------------------- | --------------------------------------------------------------------------------- | ------------------ |
| Mapa operacional     | `MAP`                                                                             | No                 |
| Estado de estaciones | `FLEET_STATUS`, `CONNECTIVITY`                                                    | No                 |
| Lista de sesiones    | `ACTIVE_SESSIONS`, `STUCK_SESSIONS`, `ENERGY_TODAY`, session table (table 1 of 3) | No                 |

**Definition of done:** Home operacional screen renders all five status-strip widgets plus the map with real, live data, scoped correctly per organization/site; the session table (filterable/sortable) is reachable from Home and pre-filterable from the Station view; the Station view (from [CAPX_MVP_SCREENS.md](../product/CAPX_MVP_SCREENS.md)) exists and shows a real `StationHealth` value with its plain-language reason. No `Alert`/`Incident`/`MaintenanceTicket` UI exists yet — the attention queue placeholder, if shown at all, is empty or hidden, not fake.

**Cross-reference:** component/service detail in [CAPX_COMPONENT_MAP.md](./CAPX_COMPONENT_MAP.md); query shapes in [CAPX_DATA_DEPENDENCIES.md](./CAPX_DATA_DEPENDENCIES.md); complexity/risk in [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md).

### Sprint 2 (Days 11–20) — Incidentes, alertas, mantenimiento

| Item          | MVP widgets/tables/actions covered                                                                                         | Migration required                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Alertas       | `ATTENTION_QUEUE` (the `Alert` half), actions 1–2 (acknowledge, dismiss)                                                   | **Yes** — the `Alert` slice (3 types only)                  |
| Incidentes    | `ATTENTION_QUEUE` (the `Incident` half), incident table (table 2 of 3), actions 3–4 (assign, resolve), Vista de incidentes | **Yes** — `Incident`, unreduced                             |
| Mantenimiento | Maintenance ticket table (table 3 of 3), Vista de mantenimiento (read-only)                                                | **Yes** — `MaintenanceTicket` schema (workflow UI deferred) |

**Definition of done:** the one migration for this MVP is applied (three small tables, no changes to any existing model — see [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md) for the exact shape); `AlertDetectionService` is wired to real transition points on `ConnectivityCoordinator`/`SessionLifecycleService`/the connector-fault path and is provably firing on the 3 in-scope conditions in a real environment (per this engagement's standing discipline of real-database/real-simulator validation, not unit tests alone — see [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md)); the attention queue on Home operacional is live; Vista de incidentes supports assign and resolve (with required notes); Vista de mantenimiento renders real (if sparse) ticket data.

**This sprint is the one place this plan asks for a schema change**, and per this work order's own constraint, no migration is written as part of this planning document — Sprint 2's first task in an authorized implementation phase is a dedicated migration-design step, not a "just add the tables" assumption. See [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md) for why this sprint carries this plan's highest risk rating.

### Sprint 3 (Days 21–30) — Analítica, KPIs, ocupación

| Item      | MVP widgets/tables covered                                                                                                                                  | Migration required |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Analítica | `TREND_CHART` (energy/session only)                                                                                                                         | No                 |
| KPIs      | Failed-session-reason breakdown and average-session-duration figure, both surfaced within the existing session table/trend widgets, not as new widget slots | No                 |
| Ocupación | An **instantaneous** occupancy figure (current connector-status counts), not a trend                                                                        | No                 |

**Explicit scope boundary, restated from [CAPX_MVP_WIDGETS.md](../product/CAPX_MVP_WIDGETS.md):** "ocupación" in this sprint means the point-in-time snapshot only. Occupancy/utilization _trend_ and `FAULT_RECURRENCE` both require `OccupancySnapshot` — a fourth new-domain entity architected in [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md) but explicitly excluded from the approved MVP's widget/table caps. Building it was not authorized by WO-ARGOS-020 and is not brought back into scope here — if ARGOS wants trend-based occupancy inside this 30-day window, that requires either a widened widget cap or displacing one of the 8 already approved, a call for ARGOS, not one this plan makes unilaterally.

**Definition of done:** the energy/session trend chart renders real day-over-day data on Home operacional; the session table gains a termination-reason grouping view and an average-duration figure; a fleet-wide/per-site instantaneous occupancy number is visible somewhere in the Home or Station view (placement is a Sprint 3 UI decision, not fixed by this plan).

## Summary table

| Sprint | Days  | New migration                                | Widgets/tables shipped                                                                                    | Actions shipped                                     |
| ------ | ----- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1      | 1–10  | No                                           | `MAP`, `FLEET_STATUS`, `CONNECTIVITY`, `ACTIVE_SESSIONS`, `STUCK_SESSIONS`, `ENERGY_TODAY`, session table | Drill-into-detail (action 5)                        |
| 2      | 11–20 | Yes (`Alert`/`Incident`/`MaintenanceTicket`) | `ATTENTION_QUEUE`, incident table, maintenance table                                                      | Acknowledge, dismiss, assign, resolve (actions 1–4) |
| 3      | 21–30 | No                                           | `TREND_CHART`, KPI enrichments, instantaneous occupancy                                                   | None new                                            |

By the end of Sprint 1, all 5 actions' _targets_ exist except the 4 that need `Alert`/`Incident` (which don't exist until Sprint 2) — action 5 (drill-into-detail) is the only one available early, which is expected and correct, not a gap.
