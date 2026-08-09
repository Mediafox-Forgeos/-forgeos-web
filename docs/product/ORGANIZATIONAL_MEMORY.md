# Organizational Memory

**Work order:** WO-ARGOS-027 (Operational Learning Discovery)
**Status:** PRODUCT DISCOVERY. No code, API, migration, or `schema.prisma` change.
**Mission:** what should MOVOS know about an operator's network after running for a year, that it doesn't know on day one — built from [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md)'s inventory and [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md)'s per-`Action` synthesis, rolled up to fleet scale and a year's time horizon.

## Why a year is the right horizon to reason about

A single `Action` says something about one moment at one station. A year of them — hundreds of rows across a real fleet, assuming the pilot org (Kylum Energy, the seeded demo dataset) or a comparable customer keeps operating at its current scale — is enough for patterns to separate from noise: a station that produced two `IDLE_CONNECTOR` actions in January could be coincidence; a station that's produced one every month for a year is not. Everything below is written at that scale, and is explicit about which parts are already true with the small amount of real data in `movos_dev` today versus which only become meaningful once a year of real production data exists.

## The five questions

### 1. Chronic stations

- **What MOVOS should know:** which stations are repeat offenders — not "flagged once," but flagged again and again, possibly across _different_ recommendation types, in a way that marks them as structurally different from the rest of the fleet rather than unlucky once.
- **Built from:** [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 7 (station behavior) — total `Action` count, severity mix, and dismiss/resolve ratio per station, ranked against the fleet.
- **What a year of data adds:** enough volume to separate "genuinely chronic" from "had a bad week." A station with 3 actions in its first month could be either; a station with 24 actions spread evenly across 12 months is unambiguously chronic. This is also the natural feeder into [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) #10 ("station approaching end-of-life") — a recommendation that needs exactly this kind of longitudinal view and was tagged `[Needs status-history log]` there for a different reason (fault-transition trend); the `Action`-based version proposed here is a real, already-available substitute using resolution history instead of raw status-flap history.

### 2. Best operators

- **What MOVOS should know:** who reliably closes which kind of problem well — not "who closed the most tickets," but who closes them with low recurrence (the fix held) and reasonable resolution time.
- **Built from:** [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 6 (repeated actions, i.e. `Action.assignedToUserId`'s final value) combined with [LEARNING_METRICS.md](./LEARNING_METRICS.md) metrics 1 (time to resolution) and 2 (recurrence rate), computed per assignee instead of per fleet.
- **Honest caveat:** this only credits the _final_ assignee on a resolved `Action`, per [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 5's gap — if two people touched an action before it closed, only the last one is visible. "Best operators" from a year of data is real but attributes outcomes to whoever happened to be assigned last, not necessarily whoever did the most work. Closing the reassignment-history gap would sharpen this; it is not required to get a first, honestly-caveated version.
- **What a year of data adds:** enough resolved actions per person, across enough recommendation types, to distinguish a genuinely strong operator from one who got lucky with an easy assignment queue.

### 3. Common failure patterns

- **What MOVOS should know:** which recommendation types recur most often fleet-wide, whether that mix is stable or shifting, and — from operator notes (per [KNOWLEDGE_EXTRACTION.md](./KNOWLEDGE_EXTRACTION.md) question 5's "remedy fact") — what actually tends to fix each one, in operators' own words, beyond MOVOS's own generic `recommendedAction` text.
- **Built from:** `Action` counts grouped by `recommendationType` over time, plus a qualitative pass over `notes` on resolved actions of each type.
- **What a year of data adds:** the difference between "we've seen one `AUTH_FAILURE_SPIKE`" and "`AUTH_FAILURE_SPIKE` is our third most common issue and it's almost always a specific reader model failing the same way" — the latter is only visible with real volume, and it's the kind of fact a human ops lead currently has to remember personally rather than something the system remembers on their behalf.

### 4. Seasonal demand

- **What MOVOS should know:** whether usage (`ChargingSession` volume, `energyWh`, occupancy) has a repeating time-of-year shape — same question [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md) #5 ("occupancy spike, recurring peak pattern") asks at the day-of-week scale, extended to month-of-year.
- **Built from:** `ChargingSession.startedAt`/`.energyWh`, already event-sourced (per [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s own finding that this table needs no new schema to analyze historically) — no `Action` involvement at all, since this is a demand pattern, not a fault pattern.
- **Honest caveat:** a full calendar year is close to the _minimum_ data needed to say anything about seasonality at all — six months of data cannot distinguish a seasonal effect from a one-time trend. This is the one question on this list where "after operating for a year" isn't just a nice-to-have horizon, it's close to the earliest point the question becomes answerable in principle.

### 5. Maintenance efficiency

- **What MOVOS should know:** whether the org's operational response is getting faster or slower over time, and whether the fleet's overall health is improving or degrading as a result.
- **Built from:** [LEARNING_METRICS.md](./LEARNING_METRICS.md) metric 1 (time to resolution) trended month-over-month, fleet-wide and per recommendation type, alongside metric 2 (recurrence rate) trended the same way — falling resolution time _and_ falling recurrence together is real improvement; falling resolution time with flat or rising recurrence means the team is closing tickets faster without actually fixing more.
- **What a year of data adds:** twelve real data points instead of one — trend, not snapshot. This is also the metric most directly useful to the org itself, not just to MOVOS: it's the fleet-health story an operator would want to bring to their own leadership.

## What this adds up to

None of the five questions above need new schema to start answering — every one is a rollup of `Action` and `ChargingSession` rows that already exist, at fleet scale instead of per-incident scale. What changes with a year of real operation isn't the query, it's the confidence: the same aggregation run on day 30 versus day 365 answers "chronic station" or "seasonal demand" with very different reliability. This is the case [LEARNING_STRATEGY.md](./LEARNING_STRATEGY.md) weighs directly: the data to start this is already accumulating with every `Action` WO-ARGOS-026 creates, whether or not MOVOS builds anything to read it next.
