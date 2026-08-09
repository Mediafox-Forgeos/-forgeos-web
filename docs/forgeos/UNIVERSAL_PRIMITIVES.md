# Universal Primitives

**Work order:** WO-ARGOS-028 (ForgeOS Core Extraction)
**Status:** ARCHITECTURE DISCOVERY. No code, API, migration, or `schema.prisma` change.
**Mission:** the primitives underneath [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md)'s eight capabilities, named independently of mobility — what each one is _for_, regardless of which vertical happens to be using it.

## The dependency chain

Each primitive below builds on the one before it. This isn't incidental — it's the same order [FORGEOS_STACK.md](./FORGEOS_STACK.md)'s seven layers follow, and it matches something already true in the shipped code: `Action` (WO-ARGOS-026) is built on top of `Recommendation` (WO-ARGOS-025), which reads `Event`-shaped tables (`ChargingSession`, `AuthorizationAttempt`, `MeterValue`) that existed since CAP-003/004, months earlier. The primitives were built bottom-up before anyone named them.

```
Event → Observation → Recommendation → Action → Memory
                                           ↓         ↓
                                        Learning ←────┘
                                           ↓
                                       Automation
```

## The primitives

### Event

- **Purpose:** an immutable record that something happened, at a specific time, attributable to a specific subject. The append-only substrate every other primitive is ultimately derived from.
- **Lifecycle:** created once, never updated, never deleted in ordinary operation — write-once by construction. May eventually need a stated retention/archival policy once volume grows (see `OcppProtocolEvent`'s own schema comment: unlimited retention during pilot phase is an explicit interim decision, not silence, and a purge strategy is a named future requirement).
- **Dependencies:** none — this is the base primitive everything else depends on, not the reverse.
- **Already real in mobility (unnamed, un-extracted):** `MeterValue` (a telemetry reading), `AuthorizationAttempt` (a credential presentation, logged whether accepted or not), `OcppProtocolEvent` (a raw protocol frame), `AuditEvent` (a human-attributable domain mutation). Four different tables, never unified under one shared shape, each independently re-deriving "immutable, timestamped, attributable fact."
- **Outside mobility:** a POS transaction line, a sensor reading in a building-management system, a login attempt, a message in a support-ticket thread, a bank ledger entry.

### Observation

- **Purpose:** a judgment about an entity's current state, derived from one or more Events — the bridge between raw fact and actionable insight. Distinguished from an Event by being a _conclusion_, not a _fact_: "this station is degraded" is an Observation built from the Event that a connector reported `FAULTED`.
- **Lifecycle:** two shapes exist today, both real. **Ephemeral**: computed fresh on every read and never stored (`StationHealthService.computeHealth()` — CAP-X Sprint 1). **Persisted-and-superseded**: written once, overwritten in place on the next update, with no record of the prior value (`ChargingStation.connectivityStatus`, reconciled by `ConnectivityCoordinatorService` — CAP-005). The persisted shape trades history for a cheap "what do we currently believe" read; the ephemeral shape trades a repeated computation for always being current.
- **Dependencies:** one or more Events (or other Observations) to derive from.
- **Already real in mobility:** `StationHealthStatus` (`healthy`/`degraded`/`offline`/`unknown`), `ConnectivityStatus` (`ONLINE`/`OFFLINE`/`UNKNOWN`).
- **Outside mobility:** "service: degraded" on an SRE dashboard, "in stock: 3 units" in an inventory system, "battery: low" on a connected device, a fraud model's live risk score for one transaction.

### Recommendation

- **Purpose:** a stateless, evidenced, explained suggestion for what to do next, computed from Observations and/or Events — the first primitive that exists specifically to be _acted on_ rather than merely known.
- **Lifecycle:** deliberately ephemeral. Recomputed fresh on every request; never persisted; silently stops appearing the moment its trigger condition clears (`RecommendationService`, WO-ARGOS-025 — "a recommendation is only ever as current as the data behind it"). Carries no state machine of its own — an accepted or dismissed Recommendation becomes an Action, not a Recommendation with a status field.
- **Dependencies:** Events and/or Observations containing a detectable pattern; a defined trigger/threshold.
- **Already real in mobility:** the 5 `RecommendationType`s — `ENERGY_ANOMALY`, `AUTH_FAILURE_SPIKE`, `IDLE_CONNECTOR`, `COMPARATIVE_UNDERPERFORMANCE`, `EFFICIENCY_DRIFT`.
- **Outside mobility:** "this cloud instance is idle 90% of the time, consider downsizing," "this customer's support-ticket volume is trending up," "this employee's timesheet pattern looks anomalous," "this SKU is about to stock out at current sell-through."

### Action

- **Purpose:** the persisted, stateful record of a response to a Recommendation (or, in principle, to any triggering source) — durable case management. Where a Recommendation is a suggestion that can vanish, an Action is a commitment that cannot.
- **Lifecycle:** created only on first real interaction (never pre-created for every live Recommendation — that would turn every read into a write); transitions through a server-enforced state map, never a client-trusted one; reaches a terminal state; becomes eligible for a fresh row again after a cooldown window if the same underlying condition recurs (WO-ARGOS-026).
- **Dependencies:** a Recommendation (or other source) to snapshot at creation time, so the explanation survives even after the live condition that produced it has cleared; a human assignee.
- **Already real in mobility:** the `Action` entity — `OPEN → ACKNOWLEDGED/ASSIGNED → RESOLVED/DISMISSED`, with `title`/`severity`/`explanation`/`evidence`/`recommendedAction` frozen at creation.
- **Outside mobility:** a support ticket, a security-incident case, a maintenance work order, a collections case in accounts-receivable — any workflow where "someone owns this until it's closed" is the point.

### Memory

- **Purpose:** the longitudinal rollup of many closed Actions/Events into durable facts about an entity — distinct from a single Observation (a snapshot of now) by being a _pattern across time_, and distinct from a single Event by being synthesis rather than raw fact. This is what lets an organization say "we already know this station is chronic" instead of rediscovering it from scratch on every incident.
- **Lifecycle:** continuously re-derivable, not write-once — a Memory fact changes as new Actions close, and should always be re-computable from the underlying Action/Event history it summarizes rather than treated as an independent source of truth (a cache of a query, not a ledger).
- **Dependencies:** a sufficient volume of closed Actions/Events for a pattern to be statistically distinguishable from noise — [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md)'s own finding that some questions (seasonal demand) need close to a full year of data before the question is even answerable in principle, not just answerable with confidence.
- **Already real in mobility:** not implemented — [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) (WO-ARGOS-027) defines the five target questions (chronic stations, best operators, common failure patterns, seasonal demand, maintenance efficiency) as rollups over `Action`/`ChargingSession`, entirely as discovery.
- **Outside mobility:** "this customer typically churns after their third support ticket," a factory floor's seasonal machine-failure pattern, a CRM's "at-risk account" flag built from interaction history, a hospital's readmission-risk score built from prior visits.

### Learning

- **Purpose:** evaluates whether the Recommendation layer is actually working — distinct from Memory by being about _system performance_ (is this detector reliable) rather than _entity history_ (what happened to this specific station). Without Learning, a Recommendation's thresholds are permanently whatever they were guessed to be at launch.
- **Lifecycle:** continuously computed from closed Action outcomes, attributed back to the Recommendation type that produced each Action — informs (does not automatically overwrite) a detector's tuning.
- **Dependencies:** Action history, specifically the outcome (`RESOLVED` vs `DISMISSED`, recurrence, resolution time) attributed to each Recommendation type.
- **Already real in mobility:** not implemented — [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) (WO-ARGOS-027) defines the target metrics (time to resolution, recurrence rate, operator acceptance rate, false-positive rate, avoided downtime) against the `Action` model, entirely as discovery, honestly flagging which are computable today versus which need a schema addition.
- **Outside mobility:** an ML model's precision/recall tracked over live traffic and used to retune a decision threshold, a spam filter's false-positive rate driving rule adjustments, a recommender system's click-through rate driving algorithm changes.

### Automation

- **Purpose:** the not-yet-built layer that lets the system execute an Action transition without a human in the loop, gated by Learning's confidence data rather than launch-time guesswork.
- **Lifecycle:** would reuse `ActionService`'s exact transition mechanism, triggered by policy instead of a human click.
- **Dependencies:** Learning — specifically, per-Recommendation-type acceptance and false-positive rates, to determine which transitions are trustworthy enough to make unattended. [LEARNING_STRATEGY.md](../product/LEARNING_STRATEGY.md) (WO-ARGOS-027) already made this dependency explicit: Automation was deliberately held back across WO-026, WO-027, and this work order precisely because that confidence data doesn't exist yet.
- **Already real in mobility:** nothing — explicitly not started, by repeated direct instruction.
- **Outside mobility (hypothetical, to illustrate the shape only):** an IT-ops system auto-restarting a service after N consecutive health-check failures, a fraud system auto-blocking a transaction above a confidence threshold, a thermostat auto-adjusting based on a learned occupancy pattern.

## Summary table

| Primitive      | Persisted today?        | Has a state machine?      | Already real in mobility (unnamed)                                           |
| -------------- | ----------------------- | ------------------------- | ---------------------------------------------------------------------------- |
| Event          | Yes (4 separate tables) | No — write-once           | `MeterValue`, `AuthorizationAttempt`, `OcppProtocolEvent`, `AuditEvent`      |
| Observation    | Sometimes (mixed)       | No — current-value only   | `StationHealthStatus` (ephemeral), `ConnectivityStatus` (persisted)          |
| Recommendation | No — deliberately never | No                        | `RecommendationType` × 5                                                     |
| Action         | Yes                     | Yes                       | `Action`                                                                     |
| Memory         | Not implemented         | No (rollup, not stateful) | design only, [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) |
| Learning       | Not implemented         | No                        | design only, [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)           |
| Automation     | Not implemented         | Reuses Action's           | not started                                                                  |

## What stands out

Four Event-shaped tables exist independently across CAP-003/004/audit, each re-solving "immutable, timestamped, attributable fact" from scratch, with no shared shape. That's the clearest, lowest-risk extraction candidate in this entire inventory — not because the current tables are wrong, but because a future second vertical would otherwise re-solve the same problem a fifth time. [VERTICAL_BOUNDARIES.md](./VERTICAL_BOUNDARIES.md) draws the line on exactly which fields would move and which would stay.
