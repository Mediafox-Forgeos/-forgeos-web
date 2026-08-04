# Operator KPIs

**Work order:** WO-ARGOS-018 (CAP-X Discovery — Operator Control Center)
**Status:** PRODUCT DISCOVERY. Formulas below are product specifications, not implemented queries — no analytics/aggregation code exists yet. Each KPI is checked against `apps/movos-api/prisma/schema.prisma` for whether its inputs exist today.

## Selection method

The work order named ten example KPIs: utilization rate, energy delivered, revenue, uptime, active sessions, average session duration, reservations, failed sessions, maintenance incidents, occupancy. Nine of those are carried forward below. **Reservations is dropped** — no `Reservation` concept exists anywhere in MOVOS's domain (confirmed: no model, no field, no mention outside this discovery), and [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md) classifies Reservations P2 with no evidence of operator urgency. In its place: **stuck/offline session count**, a KPI unique to MOVOS's actual architecture (the `ChargingSession.OFFLINE` state introduced by CAP-005) and directly tied to the single sharpest anxiety named in [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) — a real gap the ten generic examples don't capture because they weren't written against this schema.

## The ten KPIs

### 1. Fleet Uptime (Connectivity Availability)

- **Definition:** the share of stations that were reachable (`ConnectivityStatus.ONLINE`) out of total elapsed time, aggregated across the fleet or filtered to one site.
- **Formula:** `SUM(time spent ONLINE per station) / SUM(total observed time per station)`, computed from `ChargingStation.connectivityStatus` transition history (`lastConnectedAt`/`lastDisconnectedAt` timestamps, CAP-005). Requires a transition log, not just current-state snapshots — today only the _current_ value and the two most recent timestamps are persisted, so historical uptime cannot yet be computed for any window further back than the last state change.
- **Update frequency:** near-real-time for the current-state numerator; the historical formula above requires a new append-only connectivity-event log (does not exist yet — `ChargingStation` stores only the latest transition, not a history).
- **Operational importance:** the single number a network operator would use to negotiate an SLA or justify a site's continued operation. Distinct from `ConnectorStatus`-based occupancy — a station can be 100% connectivity-available and 0% utilized, or vice versa (a station stuck `ACTIVE` in the business layer while its connection is actually gone).

### 2. Energy Delivered

- **Definition:** total kWh dispensed across all completed and in-progress sessions, for a given period and scope (site, station, fleet).
- **Formula:** `SUM(ChargingSession.energyWh) / 1000`, filtered by `startedAt`/`endedAt` falling in the target window. Already resolvable per DEC-016 without requiring any `MeterValue` rows to exist — `energyWh` is authoritative on `ChargingSession` itself.
- **Update frequency:** real-time for in-progress sessions (energyWh updates as `MeterValues` telemetry arrives), finalized at session termination.
- **Operational importance:** the most fundamental measure of throughput — the electrolinera/mall-shape operator's direct analogue to "gallons pumped" or "footfall." Feeds both Utilization and Revenue below.

### 3. Revenue

- **Definition:** total monetary value of energy delivered plus any per-minute/fixed-fee charges, for a given period.
- **Formula:** `SUM(TariffSnapshot-priced value per ChargingSession)` — requires multiplying `energyWh` (and session duration, for `pricePerMinute`) against the `TariffSnapshot` rows attached to each session, plus `fixedFee`.
- **Update frequency:** would be real-time in principle, but **cannot be computed at all today**. `TariffSnapshot` is real schema (CAP-009) but nothing in MOVOS populates it — no pricing service exists, so every `ChargingSession` today has zero attached `TariffSnapshot` rows. This KPI is currently undefined in practice, not merely stale.
- **Operational importance:** the KPI every commercial operator shape ultimately cares about most, and the one this discovery can state with the most confidence is currently unavailable — a direct, quantified argument for [OPERATOR_STRATEGY_RECOMMENDATION.md](./OPERATOR_STRATEGY_RECOMMENDATION.md) to weigh explicitly.

### 4. Utilization Rate

- **Definition:** the share of available charging time actually spent delivering energy, for a connector, station, site, or fleet.
- **Formula:** `SUM(session duration where status was ACTIVE) / SUM(time the connector was AVAILABLE-or-better, i.e. not UNAVAILABLE/OFFLINE/FAULTED)`, over a period. Session duration is directly available (`endedAt - startedAt` on `ChargingSession`); the availability denominator has the same gap as Uptime above — current `Connector`/`Evse.status` is a snapshot, not a history.
- **Update frequency:** daily/weekly rollup is the natural cadence (this is a capacity-planning number, not an incident-response one); would require the same status-history log as Fleet Uptime.
- **Operational importance:** answers "am I running out of capacity" (invest in more chargers) vs. "am I over-built" (a very different, and equally real, operator anxiety not covered in the daily-workflow discovery's incident-focused framing, but present in every multi-site operator conversation this kind of product needs to serve).

### 5. Active Sessions (Live Count)

- **Definition:** how many `ChargingSession` rows are currently `ACTIVE` or `SUSPENDED`, right now, fleet-wide or per site.
- **Formula:** `COUNT(*) WHERE status IN (ACTIVE, SUSPENDED)`. Fully available today from `ChargingSession.status` with no gaps.
- **Update frequency:** real-time — this is a live gauge, not a rollup.
- **Operational importance:** the closest thing to a pulse check; the number every operator shape glances at first, per [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md)'s first-screen description.

### 6. Average Session Duration

- **Definition:** mean (and, more usefully operationally, median) length of a completed charging session, for a period/scope.
- **Formula:** `AVG(endedAt - startedAt) WHERE status = COMPLETED`. Fully available today.
- **Update frequency:** daily rollup is sufficient — this is a trend indicator, not an incident signal.
- **Operational importance:** an unusual shift (sessions suddenly running much longer or shorter than the historical baseline) is itself a leading indicator of a problem — a charger delivering power more slowly than it should, or a batch of sessions being cut short by a fault — before any explicit fault state gets reported.

### 7. Failed Session Rate

- **Definition:** the share of sessions that ended in `FAILED` or `CANCELLED` (the real `ChargingSessionStatus` terminal values that are not a successful `COMPLETED`) out of all sessions started, for a period/scope.
- **Formula:** `COUNT(status IN (FAILED, CANCELLED)) / COUNT(*) WHERE startedAt in period`. Fully available today, and further breakable down by `terminationReason` (`CABLE_DISCONNECTED`, `FAULT`, `NETWORK_FAILURE`, `POWER_LOSS`, `STATION_REBOOT`, etc. — all real enum values already captured on every terminated session).
- **Update frequency:** real-time is possible; daily rollup is the operationally useful cadence for trend-spotting.
- **Operational importance:** the `terminationReason` breakdown is a genuinely underused asset already sitting in the schema — it lets an operator distinguish "my equipment is failing" (`FAULT`, `POWER_LOSS`) from "my customers are giving up" (`USER_CANCELLED`), two completely different remediation paths, from data already captured today with zero new instrumentation.

### 8. Stuck / Offline Session Count

- **Definition:** sessions currently in the `OFFLINE` `ChargingSessionStatus` — a session whose underlying connection went verifiably stale (CAP-005) — broken out by how long they've been in that state, specifically flagging any past the 15-minute reconnect-recovery window this system already implements.
- **Formula:** `COUNT(*) WHERE status = OFFLINE`, with `NOW() - updatedAt` (the timestamp of the transition into `OFFLINE`) as the age used for the past-window flag.
- **Update frequency:** real-time — this is the single highest-anxiety state named in [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md) and belongs in the attention queue, not a rollup.
- **Operational importance:** unlike the other nine KPIs (all adapted from generic industry practice), this one is specific to a real, already-implemented MOVOS mechanism (CAP-005's offline/reconnect design) that no generic EV-charging KPI list would name, because most such lists are written against systems without this exact state machine. Its absence from any dashboard today is a direct, correctable gap, not a hard problem.

### 9. Occupancy Rate

- **Definition:** the share of connectors currently `CHARGING` or `OCCUPIED` out of all connectors that are not themselves `UNAVAILABLE`/`OFFLINE`/`FAULTED`, at a point in time (distinct from Utilization Rate's _time-integrated_ view — this is a snapshot).
- **Formula:** `COUNT(status IN (CHARGING, OCCUPIED)) / COUNT(status NOT IN (UNAVAILABLE, OFFLINE, FAULTED))`, scoped to a site or the fleet.
- **Update frequency:** real-time — this is the electrolinera/mall shape's queueing signal, needed at the moment a customer is deciding whether to visit.
- **Operational importance:** distinguishes "busy, working as intended" from "broken, unavailable" — two states an undifferentiated status count would otherwise blur together, directly relevant to the P1 Occupancy module in [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md).

### 10. Maintenance Incident Rate (Fault Recurrence)

- **Definition:** count of distinct fault episodes per connector/station over a period, weighted to distinguish a single clean incident from a flapping (repeatedly faulting) device — the "pattern vs. incident" distinction named in [OPERATOR_DAILY_WORKFLOW.md](./OPERATOR_DAILY_WORKFLOW.md).
- **Formula:** `COUNT(distinct transitions INTO FAULTED status)` per connector/station per period. Requires the same status-history log gap named under Fleet Uptime and Utilization Rate above — current status is a snapshot, so "how many times did this flip to FAULTED this month" cannot be computed from today's schema without a transition log.
- **Update frequency:** daily/weekly rollup — this is a maintenance-planning signal, not an incident-response one (the incident-response signal is the real-time `FAULTED`/`OFFLINE` status itself, already covered by KPI 1 and 8).
- **Operational importance:** feeds the Maintenance module ([OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md), P1) — without recurrence tracking, every fault looks identical regardless of whether it's a first-time blip or the fifth time this month, which is exactly the distinction an operator needs to decide whether to dispatch a technician or wait.

## Cross-cutting finding: the missing status-history log

Three of the ten KPIs above (Fleet Uptime, Utilization Rate, Maintenance Incident Rate) are blocked on the same missing piece: MOVOS today stores only the _current_ value of `ConnectorStatus`/`EvseStatus`/`ConnectivityStatus`, with at most one or two "last transition" timestamps (`lastConnectedAt`/`lastDisconnectedAt` on `ChargingStation` specifically), never a full transition history. This is a single, well-scoped gap — an append-only status-event log, analogous in shape to the `OcppProtocolEvent` log CAP-003 already built for raw protocol frames — not three separate problems. Closing it once would unblock all three KPIs simultaneously. This is a discovery finding for a future capability's scoping, not an instruction to build it now.

Revenue (KPI 3) has a different, unrelated blocker: it requires a pricing service that populates `TariffSnapshot`, which is Tariffs/Billing territory (Architecture Backlog #24/#25/CAP-010), not a Control Center concern. See [OPERATOR_STRATEGY_RECOMMENDATION.md](./OPERATOR_STRATEGY_RECOMMENDATION.md).
