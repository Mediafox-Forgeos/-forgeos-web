# Recommendation Catalog

**Work order:** WO-ARGOS-024 (Operational Recommendation Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change. No `Alert`, `Incident`, or `MaintenanceTicket` — every recommendation below is a proposed insight an operator would see, not an implementation of the case-management workflow around it.
**Mission:** the 20 most valuable recommendations MOVOS could generate automatically, evaluated against what's real today (`schema.prisma` through CAP-002–CAP-009 plus the CAP-X Sprint 1/hardening work), not a hypothetical future dataset.

## A finding that shapes every entry below

Two different kinds of tables exist in this schema today, and they have very different implications for what a recommendation can cost to build:

- **Already event-sourced, by construction.** `ChargingSession`, `AuthorizationAttempt`, and `MeterValue` are append-only — every session, every credential presentation, every telemetry reading that ever happened is still a row. A recommendation built by aggregating or comparing _these_ tables over time needs no new schema, no new logging, nothing this work order forbids — it needs a backend aggregation query, the same category of work [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md) already classified "requiere backend" for Sprint 1's own widgets.
- **Current-state only, no history.** `ChargingStation.connectivityStatus`, `Connector.status`, `Evse.status`, and the computed `StationHealthStatus` all store only the _latest_ value — the moment a station flips from `FAULTED` back to `AVAILABLE`, the fact that it was ever `FAULTED` is gone unless something else recorded it. A recommendation that needs to know _how many times_ or _how long_ a status held requires the same status-transition history log [OPERATOR_KPIS.md](./OPERATOR_KPIS.md), [CAPX_RISK_MATRIX.md](../implementation/CAPX_RISK_MATRIX.md), and [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) have each independently flagged as the same missing piece, not three separate gaps.

Each entry below is tagged **[Available today]**, **[Needs occupancy trend]**, or **[Needs status-history log]** accordingly — this tag is load-bearing for [RECOMMENDATION_PRIORITY.md](./RECOMMENDATION_PRIORITY.md), [RECOMMENDATION_EXPLAINABILITY.md](./RECOMMENDATION_EXPLAINABILITY.md), and especially [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md).

## The 20 recommendations

### 1. Recurring station fault (flapping connector) — _[Needs status-history log]_

- **Trigger:** a connector or EVSE has entered `FAULTED` a defined number of times within a rolling window (proposed starting value: 3 times in 24 hours, matching [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)'s own `FLAPPING_CONNECTOR` threshold).
- **Required data:** a count of _transitions into_ `FAULTED`, not just the current value — `Connector`/`Evse.status` today holds only the latest state.
- **Urgency:** high once detected, but detection itself is currently impossible without the missing log.
- **Expected operator action:** dispatch a technician for root-cause inspection rather than repeated reactive resets.
- **Business value:** a flapping connector silently erodes both uptime and driver trust every time it recurs; catching the third occurrence instead of the fifteenth shortens the window of lost revenue substantially.

### 2. Unusual disconnect pattern — _[Needs status-history log]_

- **Trigger:** a station's `connectivityStatus` has cycled `ONLINE`→`OFFLINE`→`ONLINE` more often than its own historical baseline, or than sibling stations at the same site, over a rolling window.
- **Required data:** connectivity transition history — same missing log as #1.
- **Urgency:** medium — usually a network/power issue at the site, not an immediate outage, but a leading indicator of one.
- **Expected operator action:** check site-level network/power infrastructure (router, PoE switch, ISP) rather than the individual charger.
- **Business value:** distinguishes a site-level infrastructure problem from a device-level one before it escalates into a full outage — a materially different, cheaper fix if caught early.

### 3. Overloaded station (persistent queueing) — _[Needs occupancy trend]_

- **Trigger:** a station's connectors read `OCCUPIED`/`CHARGING` (i.e., in active use, none free) for a sustained share of observed samples over a period, exceeding a threshold (e.g., >80% of daytime hours over a week).
- **Required data:** a time series of connector occupancy — the `OccupancySnapshot` entity already architected in [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md) but not yet built (deferred past Sprint 1, per [CAPX_MVP_WIDGETS.md](./CAPX_MVP_WIDGETS.md)).
- **Urgency:** medium — a capacity-planning signal, not an incident.
- **Expected operator action:** evaluate adding a connector/station at this site, or price-shift demand to off-peak hours.
- **Business value:** direct revenue upside — an operator turning away demand at a saturated site is leaving money on the table exactly where MOVOS has the clearest evidence to say so.

### 4. Low utilization — _[Available today]_

- **Trigger:** a station's session count and total energy delivered over a trailing period (e.g., 30 days) falls below a threshold — either an absolute floor or a share of the fleet average.
- **Required data:** `ChargingSession.startedAt`/`energyWh`, grouped by `chargingStationId` — real, already-persisted rows, no history log required (this is throughput, not occupancy — the distinction that keeps it in the "available today" tier unlike #3, which needs instantaneous state over time).
- **Urgency:** low — informational, reviewed periodically, not reacted to same-day.
- **Expected operator action:** investigate why (poor location, pricing, visibility) or consider reallocating/decommissioning the asset.
- **Business value:** every underused station is capital sitting idle; surfacing this without an operator having to notice it themselves across dozens of sites is a direct cost-avoidance case.

### 5. Occupancy spike (recurring peak pattern) — _[Needs occupancy trend]_

- **Trigger:** a repeating time-of-day/day-of-week window where occupancy consistently spikes above the site's own baseline.
- **Required data:** the same `OccupancySnapshot` history as #3.
- **Urgency:** low-medium — a planning signal.
- **Expected operator action:** proactively staff, message drivers, or dynamically price the predictable peak window.
- **Business value:** turns a reactive "why was it full at 6pm again" into a plannable, monetizable pattern.

### 6. Suspicious session interruption pattern — _[Available today]_

- **Trigger:** a station or connector's share of sessions ending in `FAILED`/`CANCELLED` (vs. `COMPLETED`), or a specific `terminationReason` (`NETWORK_FAILURE`, `POWER_LOSS`, `CABLE_DISCONNECTED`) recurring, exceeds its own historical baseline or the fleet average.
- **Required data:** `ChargingSession.status`/`terminationReason` — every terminated session is already a permanent row; this is a `GROUP BY`, the same query shape [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 7 already specified.
- **Urgency:** high if the failure share is climbing sharply; medium otherwise.
- **Expected operator action:** the `terminationReason` breakdown itself tells the operator which kind of problem to chase — `FAULT`/`POWER_LOSS` implies hardware, `USER_CANCELLED` implies a pricing/experience problem, entirely different remediation paths from the same signal.
- **Business value:** distinguishes "my equipment is failing" from "my customers are giving up," the exact distinction [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 7 named as underused, now turned into a proactive nudge instead of a number someone has to go looking for.

### 7. Energy delivery anomaly within a session — _[Available today]_

- **Trigger:** a session's `MeterValue` power readings (`powerW`) fall well below the connector's `maxPowerKw` rating for a sustained portion of its duration, without the session having ended — a vehicle charging far slower than the hardware should allow.
- **Required data:** `MeterValue.powerW`/`.timestamp` compared against `Connector.maxPowerKw` — both real, already populated per DEC-016's telemetry design.
- **Urgency:** medium, real-time — worth surfacing while the session is still active, not after.
- **Expected operator action:** flag the connector for inspection even though it never went fully `FAULTED` — a slow-degrading connector often never crosses into a hard fault at all.
- **Business value:** catches a genuinely difficult-to-notice class of problem: hardware that still "works" (starts a session, delivers _some_ power) but has quietly lost most of its rated capacity — invisible to every status-based signal in this catalog, only visible in the telemetry.

### 8. Idle connector after session completion ("stuck plugged in") — _[Available today]_

- **Trigger:** a `ChargingSession` reached `COMPLETED` (`endedAt` set) but the connector's current status has not returned to `AVAILABLE` within a reasonable window.
- **Required data:** `ChargingSession.endedAt` compared against `Connector.status` right now — both already real; no history needed, this is a point-in-time comparison between two tables Sprint 1 already reads.
- **Urgency:** high — this connector is unusable by the next driver and nothing else in the product currently flags it (a real, silent gap: `ChargingSession` says done, `Connector` disagrees).
- **Expected operator action:** contact the driver or dispatch someone to physically check the cable/vehicle.
- **Business value:** directly recovers lost capacity — a connector an operator doesn't know is stuck is one they're not billing and not offering to the next customer, at the same time.

### 9. Authorization failure spike — _[Available today]_

- **Trigger:** a station's or credential's `AuthorizationAttempt.result` share of `REJECTED`/`UNKNOWN` rises sharply over a short window.
- **Required data:** `AuthorizationAttempt` — every attempt, accepted or not, is already stored unconditionally (CAP-004's own design intent, per its schema comment: "a rejected attempt is itself operationally meaningful").
- **Urgency:** high if concentrated on one station (points at a reader/firmware problem denying legitimate drivers); medium if spread across many stations for one credential (could be a stolen/cloned card, or simply an expired one).
- **Expected operator action:** station-concentrated → inspect the reader; credential-concentrated → check status/expiry, contact the driver or fleet.
- **Business value:** a broken card reader silently turning away paying customers is one of the least visible revenue leaks possible today — nothing currently aggregates `AuthorizationAttempt` at all despite it already existing.

### 10. Station approaching end-of-life (rising fault trend) — _[Needs status-history log]_

- **Trigger:** a station's fault-transition rate has trended upward month-over-month over a multi-month horizon.
- **Required data:** long-horizon fault-transition history — same missing log as #1, at a longer time scale.
- **Urgency:** low — a capital-planning signal, reviewed quarterly.
- **Expected operator action:** budget for replacement rather than continuing incremental repairs.
- **Business value:** shifts a station from unplanned, reactive repair spend to planned capital replacement — a materially cheaper way to manage the same underlying decline.

### 11. Comparative underperformance vs. peer stations — _[Available today]_

- **Trigger:** a station's session throughput (count/energy) sits well below other stations at the same site or with similar characteristics (power rating, connector type), over a trailing period.
- **Required data:** `ChargingSession` grouped by `chargingStationId`, compared across stations at the same `siteId` — real data, a comparison rather than a single-station threshold.
- **Urgency:** low-medium — worth investigating, not urgent.
- **Expected operator action:** check for a local reason (poor signage, blocked access, pricing) rather than assuming demand is simply low everywhere.
- **Business value:** a station most operators would never think to compare against its own neighbors, because doing so by hand means holding several stations' numbers in your head simultaneously — exactly the kind of cross-entity comparison [RECOMMENDATION_VALUE.md](./RECOMMENDATION_VALUE.md) argues a human doesn't do unprompted.

### 12. Congestion redistribution — _[Available today, coarser; Needs occupancy trend for precision]_

- **Trigger:** one station at a site shows materially higher session throughput/wait-adjacent load than a sibling station at the same site over the same period.
- **Required data:** `ChargingSession` counts per station at one site (available today, throughput-based); a precise, real-time "wait time" version would need `OccupancySnapshot` for instantaneous occupancy — this entry ships a coarser, still-real version now and sharpens later.
- **Urgency:** low-medium.
- **Expected operator action:** rebalance via pricing, signage, or app-level routing so drivers are nudged toward the underused sibling station.
- **Business value:** directly named in the work order's own examples — the clearest case where MOVOS's fleet-wide view beats what any one operator standing at one station could ever notice.

### 13. Seasonal/trend demand pattern — _[Available today]_

- **Trigger:** a station or site's session count/energy shows a sustained multi-week upward or downward trend, distinct from day-to-day noise.
- **Required data:** `ChargingSession` time series — real, already available (this is [OPERATOR_KPIS.md](./OPERATOR_KPIS.md)'s Energy Delivered/Session-count KPIs extended over a longer window, not a new data source).
- **Urgency:** low — strategic, reviewed periodically.
- **Expected operator action:** adjust capacity or staffing plans ahead of a predictable seasonal shift rather than reacting after it arrives.
- **Business value:** turns a pattern that's only obvious in hindsight into one flagged while there's still time to act on it.

### 14. Connector-type demand mismatch — _[Available today]_

- **Trigger:** one `ConnectorType` at a site is consistently oversubscribed (high session count relative to its connector count) while another type sits comparatively idle.
- **Required data:** `ChargingSession` joined to `Connector.type` — real, no new schema.
- **Urgency:** low — an equipment-planning signal.
- **Expected operator action:** favor the oversubscribed connector type in the next hardware purchase or retrofit.
- **Business value:** prevents an operator from re-buying the same equipment mix that's already visibly mismatched to real demand.

### 15. Peak/off-peak pricing signal — _[Available today]_

- **Trigger:** a station or site's session volume shows a strong, repeatable intraday shape (a clear peak window vs. a clear trough).
- **Required data:** `ChargingSession.startedAt` distribution by hour — real, already available.
- **Urgency:** low — feeds a pricing decision, not an operational one.
- **Expected operator action:** design (once Tariffs exists — Architecture Backlog #24) a time-of-use rate that reflects the real, observed shape of demand rather than a guess.
- **Business value:** this is exactly the evidence a real tariff design needs and doesn't have today — MOVOS already holds the data to answer "when is my demand actually peaking," it's just never aggregated.

### 16. Firmware/protocol version outlier correlated with faults — _[Mixed — partially available, partially needs status-history log]_

- **Trigger:** a station running an older or different `lastProtocolVersion` than its peers shows a higher fault or session-failure rate than those peers.
- **Required data:** `ChargingStation.lastProtocolVersion` (real, already populated) combined with either session failure rate (#6, available today) or fault-transition count (#1, needs the missing log) — usable today in its session-failure-correlated form, sharper once the status-history log exists.
- **Urgency:** low-medium.
- **Expected operator action:** prioritize a firmware update for the outlier station(s) before assuming a hardware fault.
- **Business value:** distinguishes "this specific unit is broken" from "this whole firmware version is buggy," which changes whether the fix is a truck roll or a remote update.

### 17. Credential nearing expiry with high recent usage — _[Available today]_

- **Trigger:** an `AuthorizationCredential.expiresAt` is approaching, and that credential has a meaningfully high `AuthorizationAttempt` count in the recent window.
- **Required data:** `AuthorizationCredential.expiresAt` + `AuthorizationAttempt` frequency — both real.
- **Urgency:** medium, time-bound (must act before the expiry date, not after).
- **Expected operator action:** proactively renew or contact the driver/fleet before their card stops working mid-use.
- **Business value:** converts a guaranteed future support complaint ("why did my card stop working") into a non-event, for the specific customers who'd actually notice — the frequent users, not the dormant cards nobody would miss.

### 18. Site connectivity degradation trend — _[Needs status-history log]_

- **Trigger:** the aggregate time a site's stations spend in `OFFLINE`/`UNKNOWN` connectivity is trending upward week-over-week.
- **Required data:** connectivity transition history across every station at a site — same missing log as #1/#2, aggregated one level higher.
- **Urgency:** medium — usually a site-level infrastructure issue worsening gradually before a full outage.
- **Expected operator action:** escalate to whoever manages the site's network/power infrastructure, not to a per-charger technician.
- **Business value:** catches a slow-motion problem (aging router, intermittent power) before it becomes a full-site outage, at the level (site infrastructure) where the actual fix has to happen.

### 19. Idle fleet-wide capacity window (commercial opportunity) — _[Available today]_

- **Trigger:** a specific weekday/hour window shows consistently low session activity fleet-wide (or org-wide), a mirror image of #15 at the portfolio level.
- **Required data:** `ChargingSession` distribution across the whole fleet — real, already available.
- **Urgency:** low — a commercial/marketing signal, not operational.
- **Expected operator action:** target a promotion, fleet-partner outreach, or off-peak rate at exactly the window with spare capacity, instead of guessing when demand is soft.
- **Business value:** the flip side of #3/#5 — MOVOS can name the operator's actual slow window with evidence, not intuition, making a promotional spend a data-backed decision instead of a guess.

### 20. Efficiency drift (predictive maintenance signal) — _[Available today]_

- **Trigger:** a station's average delivered power (from `MeterValue.powerW`, or `energyWh`/duration where telemetry is sparse) trends downward across sessions over weeks, relative to its own historical baseline or its rated `maxPowerKw`.
- **Required data:** `MeterValue`/`ChargingSession.energyWh` time series per station — real, already accumulating with every session; a trend across many historical sessions, not a new log.
- **Urgency:** medium — a genuine predictive-maintenance signal, ahead of an outright fault.
- **Expected operator action:** schedule inspection before the unit crosses into a hard fault (#1) or a customer-visible energy anomaly (#7) — the earliest possible warning in this whole catalog.
- **Business value:** the highest-leverage recommendation in the set for cost avoidance: a hardware unit degrading slowly is the textbook case where catching it early (a scheduled visit) is dramatically cheaper than catching it late (an emergency truck roll after a driver complaint or an outright fault).

## Summary table

| #   | Recommendation                            | Data availability                                          |
| --- | ----------------------------------------- | ---------------------------------------------------------- |
| 1   | Recurring station fault (flapping)        | Needs status-history log                                   |
| 2   | Unusual disconnect pattern                | Needs status-history log                                   |
| 3   | Overloaded station                        | Needs occupancy trend                                      |
| 4   | Low utilization                           | Available today                                            |
| 5   | Occupancy spike                           | Needs occupancy trend                                      |
| 6   | Suspicious session interruption pattern   | Available today                                            |
| 7   | Energy delivery anomaly (in-session)      | Available today                                            |
| 8   | Idle connector after completion           | Available today                                            |
| 9   | Authorization failure spike               | Available today                                            |
| 10  | Station approaching end-of-life           | Needs status-history log                                   |
| 11  | Comparative underperformance              | Available today                                            |
| 12  | Congestion redistribution                 | Available today (coarse) / needs occupancy trend (precise) |
| 13  | Seasonal/trend demand pattern             | Available today                                            |
| 14  | Connector-type demand mismatch            | Available today                                            |
| 15  | Peak/off-peak pricing signal              | Available today                                            |
| 16  | Firmware/protocol outlier                 | Mixed                                                      |
| 17  | Credential nearing expiry, high usage     | Available today                                            |
| 18  | Site connectivity degradation trend       | Needs status-history log                                   |
| 19  | Idle fleet-wide capacity window           | Available today                                            |
| 20  | Efficiency drift (predictive maintenance) | Available today                                            |

**12 of 20 are buildable today with zero new schema** — a finding [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md) treats as load-bearing, not incidental.
