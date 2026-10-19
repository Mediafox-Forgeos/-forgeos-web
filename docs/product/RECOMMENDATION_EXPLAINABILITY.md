# Recommendation Explainability

**Work order:** WO-ARGOS-024 (Operational Recommendation Discovery)
**Status:** PRODUCT DISCOVERY. No code. Defines what an explanation must contain, not how one is rendered.
**Built from:** [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md).

## Why this matters before a single recommendation is built

[OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) found that today's dashboard already asks an operator to trust a computed value (`StationHealth.degraded`) without showing its reasoning — the review's own Task 4 required manually reconstructing _why_ a station was degraded by visiting two more screens. A recommendation engine makes this worse by default: it doesn't just report a status, it tells an operator to _do something_, and an operator who can't see why won't act on it, or worse, will act on a wrong one and stop trusting the next hundred correct ones. Explainability is not a nice-to-have layered on afterward — it is the difference between a recommendation and an unexplained command.

## The four required answers, and what "good" looks like for each

### 1. Why did MOVOS generate it?

A one-sentence, plain-language statement of the exact condition that fired — not the internal rule name. "Estación Bogotá Centro 02 tuvo 3 fallas de conector en las últimas 24 horas" is an explanation; "`FLAPPING_CONNECTOR` threshold exceeded" is not, no matter how accurate.

### 2. Which events contributed?

The literal, real rows that fed the computation — session ids, timestamps, meter readings, attempt records — not a description of the rule in the abstract. This is the "show your work" requirement: an operator (or, honestly, this document's own author under later scrutiny) should be able to take the same real data and independently re-derive the same conclusion.

### 3. How confident is the recommendation?

Not a fabricated percentage. Three tiers, defined by what kind of claim is actually being made:

- **HIGH** — a deterministic comparison against a known, fixed reference (a rated capacity, an expiry date, a real-time state mismatch). No historical baseline, no statistical judgment call — the same real inputs always produce the same conclusion, and there is no reasonable disagreement about whether the condition is true.
- **MEDIUM** — the underlying facts are real, but the recommendation depends on a _baseline_ (a fleet average, a station's own trailing history, a peer comparison) that is itself a judgment call — how long a window, how much history is enough to be meaningful. Two reasonable implementations could set the threshold slightly differently and disagree at the margin.
- **LOW** — the recommendation depends on data that does not exist in this schema yet. It is not that the reasoning is weak; it is that the evidence hasn't been collected. Every _[Needs status-history log]_ and _[Needs occupancy trend]_ entry from the catalog is LOW for exactly this reason, and stays LOW until that data exists — no amount of clever inference substitutes for the missing rows.

### 4. What evidence supports it?

The specific query or comparison, expressed against real field names — the same discipline [CAPX_DATA_DEPENDENCIES.md](../implementation/CAPX_DATA_DEPENDENCIES.md) already used for Sprint 1's widgets. An operator (or a future engineer implementing this) should be able to go from "what evidence" straight to a runnable query with no translation step.

## All 20, at a glance

| #   | Recommendation                            | Confidence | Why                                                                                                             |
| --- | ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| 1   | Recurring station fault                   | LOW        | Depends on fault-transition history that isn't recorded                                                         |
| 2   | Unusual disconnect pattern                | LOW        | Depends on connectivity-transition history that isn't recorded                                                  |
| 3   | Overloaded station                        | LOW        | Depends on occupancy history that isn't recorded                                                                |
| 4   | Low utilization                           | MEDIUM     | Real session data, but "low" is relative to a chosen baseline                                                   |
| 5   | Occupancy spike                           | LOW        | Depends on occupancy history that isn't recorded                                                                |
| 6   | Suspicious session interruption pattern   | MEDIUM     | Real termination data, baseline-dependent threshold                                                             |
| 7   | Energy delivery anomaly (in-session)      | **HIGH**   | Direct comparison: real `powerW` vs. the connector's own fixed `maxPowerKw`                                     |
| 8   | Idle connector after completion           | **HIGH**   | Direct fact mismatch: session `endedAt` is set, connector status isn't `AVAILABLE` — no interpretation required |
| 9   | Authorization failure spike               | MEDIUM     | Real attempt data, "spike" is baseline-relative                                                                 |
| 10  | Station approaching end-of-life           | LOW        | Depends on multi-month fault-transition history that isn't recorded                                             |
| 11  | Comparative underperformance              | MEDIUM     | Real session data, peer-comparison baseline                                                                     |
| 12  | Congestion redistribution                 | MEDIUM     | Real throughput data, comparison-based; sharper once occupancy history exists                                   |
| 13  | Seasonal/trend demand pattern             | MEDIUM     | Real session data, trend-detection is a statistical judgment                                                    |
| 14  | Connector-type demand mismatch            | MEDIUM     | Real session/connector data, oversubscription is threshold-relative                                             |
| 15  | Peak/off-peak pricing signal              | MEDIUM     | Real session-time distribution, "peak" is shape-relative                                                        |
| 16  | Firmware/protocol outlier                 | LOW–MEDIUM | Available half (session-failure correlation) is MEDIUM; sharper half needs the missing fault log                |
| 17  | Credential nearing expiry, high usage     | **HIGH**   | Direct fact check: real `expiresAt` date, real attempt count against a fixed floor                              |
| 18  | Site connectivity degradation trend       | LOW        | Depends on connectivity-transition history that isn't recorded                                                  |
| 19  | Idle fleet-wide capacity window           | MEDIUM     | Real session distribution, "idle" is baseline-relative                                                          |
| 20  | Efficiency drift (predictive maintenance) | MEDIUM     | Real telemetry, trend is relative to the station's own history                                                  |

**3 HIGH, 10 MEDIUM, 7 LOW** — confidence tracks data maturity closely, which is the correct shape: this catalog isn't guessing at confidence, it's reporting how much of each recommendation's claim rests on real, already-collected evidence versus a still-missing log.

## Worked examples, one per confidence tier plus one blocked case

### #8 — Idle connector after completion (P0, HIGH)

- **Why generated:** "El conector B1 de Estación Bogotá Centro 02 sigue mostrando estado OCCUPIED 25 minutos después de que la sesión finalizó."
- **Contributing events:** one `ChargingSession` row (`status = COMPLETED`, `endedAt` = 25 minutes ago) and the current `Connector.status` row for the same `connectorId`, read at generation time.
- **Confidence:** HIGH — this isn't an inference, it's two real facts that shouldn't both be true simultaneously under normal operation.
- **Evidence:** `ChargingSession.findFirst({ where: { connectorId, status: 'COMPLETED' }, orderBy: { endedAt: 'desc' } })` compared against `Connector.findUnique({ where: { id: connectorId } }).status !== 'AVAILABLE'`.

### #9 — Authorization failure spike (P0, MEDIUM)

- **Why generated:** "La Estación Bogotá Centro 03 tuvo un 60% de intentos de autorización rechazados en la última hora, frente a un 4% habitual."
- **Contributing events:** every `AuthorizationAttempt` row for that `chargingStationId` in the last hour (numerator: `result IN (REJECTED, UNKNOWN)`) compared against the station's own trailing 30-day rate (denominator baseline).
- **Confidence:** MEDIUM — the attempts themselves are exact, real counts; the "spike" judgment depends on the chosen baseline window and threshold, which is a design decision, not a physical fact.
- **Evidence:** `AuthorizationAttempt.groupBy({ by: ['result'], where: { chargingStationId, attemptedAt: { gte: oneHourAgo } } })`, denominator computed the same way over a 30-day window.

### #20 — Efficiency drift (P1, MEDIUM)

- **Why generated:** "La potencia promedio entregada por Estación Medellín El Poblado 01 ha caído 18% en las últimas 6 semanas frente a su propio promedio histórico."
- **Contributing events:** `MeterValue.powerW` readings across every session at that station, bucketed by week, compared week-over-week.
- **Confidence:** MEDIUM — real telemetry, but "drift" requires enough historical weeks to distinguish a real trend from noise; a station with 2 weeks of history can't support this recommendation responsibly yet, which the explanation should say plainly rather than firing early.
- **Evidence:** weekly `AVG(powerW)` per station, ordered by week, trend computed via linear regression or simple week-over-week delta (an implementation choice, not specified here).

### #1 — Recurring station fault (P0-if-it-fired, LOW)

- **Why generated:** cannot be generated today — included here specifically to show what an honest LOW-confidence entry looks like, not to pretend it works.
- **Contributing events:** would need every transition of `Connector`/`Evse.status` into `FAULTED`, timestamped — none of which are recorded; only the _current_ value survives a status change.
- **Confidence:** LOW, and correctly so — this is not a case of an uncertain statistical signal, it is a case of no evidence existing to evaluate at all.
- **Evidence:** none available. The honest evidence statement for this recommendation, if it were shown to an operator today, would have to be "not yet available — requires connectivity/status history," which is exactly why it isn't proposed for near-term implementation without that log first (see [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md)).

## The governing rule

**No recommendation ships to an operator without all four answers filled in with real values — a recommendation that can't state its own evidence doesn't get generated, regardless of how plausible the underlying idea is.** This is the same discipline this engagement has applied to every prior capability (CAP-008 through CAP-X): a documented, honestly-flagged gap is acceptable; a confident-sounding claim built on data that doesn't exist is not.
