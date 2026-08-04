# CAP-X — Station Health

**Work order:** WO-ARGOS-019 (CAP-X Architecture)
**Status:** ARCHITECTURE ONLY. `StationHealth` is a derived/computed view, not a proposed database column — this document specifies a computation, not a migration. No `schema.prisma` change is implied.
**Part of:** [CAP-X_OPERATOR_DOMAIN.md](./CAP-X_OPERATOR_DOMAIN.md)

## Objective 4 — The five health states

### Why a fifth status dimension, not a reuse of an existing one

`schema.prisma` already carries four distinct status dimensions for a charging station's world, and its own comments are explicit that each is deliberately independent of the others:

| Dimension      | Field                                | What it answers                                                             | Who/what sets it                                                     |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Administrative | `ChargingStation.status`             | Is this station commissioned/decommissioned as a business record?           | A human, via CRUD (CAP-002)                                          |
| Operational    | `Evse.status` / `Connector.status`   | Is this specific hardware interface available to start a session right now? | The OCPP engine, from device-reported state (CAP-002/CAP-003)        |
| Connectivity   | `ChargingStation.connectivityStatus` | Is the device's network connection currently verified reachable?            | `ConnectivityCoordinator`, from heartbeat/message evidence (CAP-005) |
| Business       | `ChargingSession.status`             | Is a specific charging transaction proceeding normally?                     | The session lifecycle engine (CAP-004/CAP-005)                       |

None of these four answers the question an operator actually asks first, per [OPERATOR_DAILY_WORKFLOW.md](../product/OPERATOR_DAILY_WORKFLOW.md): "is this station, as a whole, something I need to worry about?" A station can be administratively `ACTIVE`, have one `FAULTED` connector out of four, `ONLINE` connectivity, and zero active sessions — none of the four existing fields alone says whether that's fine (three working connectors) or a problem (a fault nobody has looked at). `StationHealth` is the fifth dimension: a **derived rollup answering that specific question**, never a fact set independently of the other four.

### The five states

- **`healthy`** — connectivity is `ONLINE`, the station's administrative status is `ACTIVE`, no `Connector`/`Evse` under it is `FAULTED`, and there is no open `Alert` or active `MaintenanceTicket` against it. The default, unremarkable state.
- **`degraded`** — connectivity is `ONLINE` and administrative status is `ACTIVE` (the station is reachable and in service), but at least one of: a `Connector`/`Evse` is `FAULTED` while at least one sibling connector is not; an open, unacknowledged `Alert` exists against the station; the station's rolling `HIGH_FAILURE_RATE` threshold ([CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md)) has been crossed. The station is still doing its job, partially, with a known, visible reason to pay attention.
- **`offline`** — connectivity is `OFFLINE` (CAP-005's verified-stale definition — not merely "we haven't heard from it in a while," but a confirmed, timeout-based determination). This state **overrides** whatever `Connector`/`Evse.status` values are currently stored, because once connectivity is lost, those values are last-known, not current — trusting them would misrepresent stale data as live fact, the exact failure mode CAP-005's own design (forcing `ONLINE → UNKNOWN` rather than trusting pre-restart state) was built to avoid.
- **`unknown`** — connectivity is `UNKNOWN`: either the station has never connected, or the process restarted and startup reconciliation has not yet re-verified this station's connectivity (`CONNECTIVITY_RUNTIME_GUIDE.md`'s documented behavior). Distinct from `offline` on purpose — `offline` is a confirmed negative; `unknown` is the literal absence of evidence either way, and the daily-workflow discovery names conflating these two as one of the sharpest sources of operator anxiety ("is a charger dead, or just quiet?").
- **`maintenance`** — an operator-declared override: an `Incident` for this station has an open `MaintenanceTicket` in `SCHEDULED` or `IN_PROGRESS` status. This is the one state a human causes directly rather than the system deriving purely from device signals, and it is scoped narrowly (see "The maintenance override" below).

### Precedence when multiple conditions hold simultaneously

A station can satisfy more than one state's raw conditions at once (e.g., connectivity is `OFFLINE` _and_ there's an open `MaintenanceTicket` for it — a technician is already on site precisely because it went offline). `StationHealth` is a single value, so precedence must be explicit, highest first:

1. **`maintenance`** — an active maintenance window suppresses every other signal. An operator who scheduled work on a station does not need MOVOS re-alerting them that the station they already know is being worked on is offline or faulted — this is a deliberate alert-fatigue reduction, not data being hidden (the underlying `Alert`s and `ConnectivityStatus` remain fully queryable; only the single-value rollup is suppressed).
2. **`offline`** — reachability beats everything below it, because nothing about operational or business state can be trusted as current once the device itself is unreachable.
3. **`unknown`** — same reasoning as `offline`, one level down: no current evidence exists, so no more specific claim (`degraded`, `healthy`) is honest to make.
4. **`degraded`** — the station is reachable and administratively active, but something about it needs attention.
5. **`healthy`** — the default; everything else evaluated false.

This ordering is itself a discovery finding worth stating plainly: **`maintenance` outranking `offline` is a real product decision**, not an obvious default. The alternative (maintenance as a low-priority annotation layered on top of the "real" offline/degraded state) was considered and rejected — it would mean every scheduled maintenance window still generates the exact anxiety-inducing alert noise this whole capability exists to reduce, defeating the purpose of tracking maintenance windows as a first-class concept at all.

### The maintenance override, scoped narrowly

`maintenance` health is driven by the existence of an active `MaintenanceTicket`, not by any field an operator sets directly on `ChargingStation` itself. This is deliberate: it keeps `ChargingStation` (CAP-002's own model) untouched by this capability — no new column, no `schema.prisma` change — and it means the override is automatically time-bounded (the moment a `MaintenanceTicket` moves to `COMPLETED`/`CANCELLED`, the station's computed health reverts to whatever its real connectivity/operational signals say, with no separate "turn maintenance mode back off" step an operator could forget to perform). A station stuck showing `maintenance` forever because someone forgot to flip a flag back is a known failure mode in comparable systems; tying the override to a ticket's own lifecycle instead of an independent toggle avoids it structurally.

### Rollup from EVSE/connector level to station level

A station's health considers its child `Evse`/`Connector` rows but is not a simple worst-of-all-children rule:

- **One `FAULTED` connector among several** → `degraded`, not `offline` — the station is still partially serving traffic.
- **All connectors `FAULTED` or `UNAVAILABLE`** → still evaluated as `degraded`, not `offline`, as long as connectivity itself is `ONLINE` — this is a real, deliberate distinction: a station that is fully reachable but fully non-functional is a different operational problem (likely a hardware fault needing a technician) from a station that has vanished from the network entirely (likely a power/network outage), and collapsing them into the same `offline` label would lose exactly the information an operator needs to decide who to call.
- **Connectivity itself governs `offline`/`unknown`**, independent of connector-level detail, because — as stated above — connector-level status cannot be trusted once the device is unreachable regardless of how many connectors are involved.

### Relationship to Alert

A `StationHealth` transition into `degraded`, `offline`, or `unknown` is one of the triggers that causes the detection layer to raise an `Alert` (see [CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md)) — but the two are not the same mechanism. `StationHealth` is a stateless computation, re-derivable at any moment from current data with no history required; `Alert` is a stateful record of _that a transition was noticed and is being tracked_. This separation matters for a concrete reason: `StationHealth` must remain correct even if the alerting pipeline were ever down or backlogged — an operator querying a station's health directly gets the true current computed state regardless of whether an `Alert` row happens to exist for it yet.

### What this document does not define

- The exact rolling window and threshold for `HIGH_FAILURE_RATE` (one of `degraded`'s trigger conditions) — proposed as a concrete starting value in [CAP-X_INCIDENT_FLOW.md](./CAP-X_INCIDENT_FLOW.md), owned by that document since it's a detection-threshold question, not a health-state-definition one.
- Whether `StationHealth` is computed on-demand (a query-time function) or cached/materialized for dashboard performance at fleet scale (an operator with hundreds of stations needs this to render fast) — an implementation-time performance decision, out of scope for this architecture. Either approach must produce the same result from the same underlying data; this document specifies the _function_, not its execution strategy.
