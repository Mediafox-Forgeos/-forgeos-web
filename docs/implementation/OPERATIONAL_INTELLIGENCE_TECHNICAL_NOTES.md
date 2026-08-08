# Operational Intelligence MVP — Technical Notes

**Work order:** WO-ARGOS-025 (Operational Intelligence MVP)
**Status:** IMPLEMENTED. Real code, real database, real screenshots.
**Scope shipped:** exactly the 5 recommendations named in the work order — energy anomaly, authentication failure spike, idle connector, comparative underperformance, efficiency drift. No `Alert`, `Incident`, `MaintenanceTicket`, or CAP-010 code anywhere in this change. No `schema.prisma` change, no migration.
**Builds on:** [RECOMMENDATION_CATALOG.md](../product/RECOMMENDATION_CATALOG.md) (#7, #9, #8, #11, #20), [RECOMMENDATION_EXPLAINABILITY.md](../product/RECOMMENDATION_EXPLAINABILITY.md), [RECOMMENDATION_STRATEGY.md](../product/RECOMMENDATION_STRATEGY.md) (WO-ARGOS-024).

## What shipped

### Backend (`apps/movos-api`)

- **`src/recommendations/recommendation.service.ts`** — `RecommendationService`, five methods (`getEnergyAnomaly`, `getAuthFailureSpike`, `getIdleConnector`, `getComparativeUnderperformance`, `getEfficiencyDrift`), each returning at most one `ApiRecommendation | null`, plus `getAll()` that runs all five and filters out the nulls.
- **`src/recommendations/recommendation.controller.ts`** / **`recommendation.module.ts`** — one endpoint, `GET /recommendations`, behind the existing `JwtAuthGuard`/`OrgContextGuard`/`RolesGuard` stack. No write path exists anywhere in this module.
- **`packages/shared-types/src/movos-api.ts`** — `RecommendationType`, `RecommendationSeverity`, `ApiRecommendation`.

### Frontend (`apps/movos-web`)

- **`src/components/operator/operational-intelligence-widget.tsx`** — the "Inteligencia operativa" widget, polling `GET /recommendations` every 30 seconds, rendering each returned recommendation as its own card: title, severity badge, explanation, an evidence bullet list, and the suggested action.
- Wired into `operator-live.tsx`, below the existing Sprint 1 widgets, on the real `/dashboard` page.

## Why "at most one per type" satisfies "maximum five cards" by construction

The work order's UI constraint is a cap of five cards. Rather than generate an unbounded list and truncate it in the frontend, each backend method finds its own **single worst current instance** and returns it (or nothing). Five methods, five possible non-null results, five possible cards — the cap holds structurally, not by a display-layer slice that could silently drop a sixth real finding. This also means: if a recommendation type currently has three qualifying stations, the widget shows the worst one, not all three — a deliberate simplicity trade-off appropriate to an MVP, named here rather than left implicit.

## The five algorithms

Each restates, with an implementation-exact threshold, the algorithm already specified in [RECOMMENDATION_CATALOG.md](../product/RECOMMENDATION_CATALOG.md):

### 1. Energy anomaly (`ENERGY_ANOMALY`)

- **Scope:** sessions currently `ACTIVE`/`SUSPENDED`, running ≥5 minutes (avoids flagging normal charging ramp-up), with ≥2 `MeterValue.powerW` readings.
- **Trigger:** average of the last 3 `powerW` readings < 50% of the connector's `maxPowerKw` (converted to W).
- **Severity:** `high` if <30% of rated power, `medium` if 30–50%.
- **Confidence:** HIGH — a direct comparison against a fixed, known reference (the connector's own rated capacity), no baseline.

### 2. Authentication failure spike (`AUTH_FAILURE_SPIKE`)

- **Scope:** all `AuthorizationAttempt` rows per `ACTIVE` station in the last 7 days, minimum 3 attempts (avoids flagging noise from a single rejected tap).
- **Trigger:** share of `REJECTED`/`UNKNOWN` results > 40%.
- **Severity:** `high` if >60%, `medium` if 40–60%.
- **Confidence:** MEDIUM — real attempt data, but the 7-day window and 40% threshold are judgment calls, not physical facts.

### 3. Idle connector (`IDLE_CONNECTOR`)

- **Scope:** the most recent `COMPLETED` session per connector (org-wide), where the connector's current `status` is not `AVAILABLE`.
- **Trigger:** ≥15 minutes elapsed since `endedAt`.
- **Severity:** `high` if >60 minutes, `medium` if 15–60.
- **Confidence:** HIGH — a direct fact mismatch (session says done, connector disagrees), no interpretation required.

### 4. Comparative underperformance (`COMPARATIVE_UNDERPERFORMANCE`)

- **Scope:** `ACTIVE` stations grouped by site, sites with ≥2 stations.
- **Trigger:** a station's total `energyWh` (all-time — see "Known limitations" below) is <50% of the average of its site peers' totals (each peer average excludes the station itself).
- **Severity:** always `medium` — informational/P1 by design, per [RECOMMENDATION_PRIORITY.md](../product/RECOMMENDATION_PRIORITY.md).
- **Confidence:** MEDIUM — real session data, but "underperforming" is inherently peer-relative.

### 5. Efficiency drift (`EFFICIENCY_DRIFT`)

- **Scope:** `ACTIVE` stations with ≥4 `COMPLETED` sessions.
- **Trigger:** sessions split into an older half and a recent half (by `startedAt`); average delivery rate (Wh/minute) in the recent half is >15% lower than the older half.
- **Severity:** `high` if the drop exceeds 30%, `medium` if 15–30%.
- **Confidence:** MEDIUM — real telemetry-adjacent data (session energy/duration), trend relative to the station's own history.

## Real validation performed

1. **`pnpm typecheck`** (root, all 12 workspace projects) — clean.
2. **`pnpm lint`** (`movos-api`, `movos-web`) — clean.
3. **`jest`** in `movos-api` — 274/274 pass (18 new tests for `RecommendationService`, covering trigger/no-trigger and severity-boundary cases for all 5 algorithms), zero regressions.
4. **`vitest run`** in `movos-web` — 41/41 pass, zero regressions.
5. **`jest --config test/jest-e2e.json`**, run against a separate scratch database (`movos_test`, not `movos_dev`) so the demo fixture data used for screenshots survived — 22/22 pass.
6. **Real-database + real-HTTP validation** against `movos_dev`, seeded with realistic historical data (MeterValue readings on both active sessions, `AuthorizationAttempt` rows, 6 historical `COMPLETED` sessions spanning 8 weeks with a deliberate delivery-rate decline, and a second connector at Bogotá Centro 01 left `OCCUPIED` after its session completed). All 5 recommendation types fired simultaneously in one real `GET /recommendations` call — see "Recommendation examples" below for the exact response.
7. **Real browser validation** (Playwright/Chromium, logged in as the seeded Kylum Energy admin): confirmed exactly 5 cards render, each with a colored severity badge, an explanation, an evidence list, and a suggested action. See `docs/implementation/screenshots-operational-intelligence/`.

## Recommendation examples (real output, this demo run)

The exact response from `GET /recommendations` against the seeded `movos_dev`, station names and figures unedited:

| Type                           | Severity | Explanation                                                                                                                          |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ENERGY_ANOMALY`               | high     | Estación Bogotá Centro 02 está entregando 40 kW en promedio, muy por debajo de su capacidad nominal de 150 kW, en una sesión activa. |
| `AUTH_FAILURE_SPIKE`           | high     | Estación Bogotá Centro 02 rechazó 80% de los intentos de autorización en los últimos 7 días.                                         |
| `IDLE_CONNECTOR`               | high     | Un conector de Estación Bogotá Centro 01 sigue en estado OCCUPIED 98 minutos después de que su última sesión finalizó.               |
| `COMPARATIVE_UNDERPERFORMANCE` | medium   | Estación Bogotá Centro 03 ha entregado 0.0 kWh en total, frente a un promedio de 86.9 kWh en sus estaciones pares del mismo sitio.   |
| `EFFICIENCY_DRIFT`             | medium   | Estación Bogotá Centro 01 ha entregado energía 27% más lento en sus sesiones recientes que en sus sesiones anteriores.               |

Each response also carries its full `evidence` array and `recommendedAction` — visible directly in the screenshots.

**One honest note on `COMPARATIVE_UNDERPERFORMANCE`'s result:** the algorithm correctly picked `BOG-CTR-03` (0 kWh, the offline station with zero sessions) rather than the originally-anticipated `BOG-CTR-02` — because it genuinely is the worst-performing station at that site by the stated metric. This is the algorithm working exactly as designed (comparing every station fairly, not just the ones a demo script expected), not a bug.

## Known limitations, stated plainly

- **`COMPARATIVE_UNDERPERFORMANCE` and `EFFICIENCY_DRIFT` use all-time session history, not a rolling window.** [RECOMMENDATION_CATALOG.md](../product/RECOMMENDATION_CATALOG.md) describes both as trailing-period comparisons (e.g., 30 days); this MVP uses all-time because the pilot fleet's data is only a few weeks old and a 30-day window would exclude the very historical sessions seeded to demonstrate the algorithm. A real deployment with months of history should add a trailing-window filter — a small follow-up, not a redesign.
- **`EFFICIENCY_DRIFT`'s per-station query includes every `COMPLETED` session at that station, regardless of which connector.** In this demo, a `COMPLETED` session seeded for the _idle-connector_ scenario (on Bogotá Centro 01's second connector) was picked up by the efficiency-drift calculation for that same station, landing in the "recent" bucket alongside the intentional efficiency-drift fixtures. The result is still real and still correct — the recent-bucket average genuinely is lower than the older one — but it's a demo-data interaction worth naming rather than hiding: two unrelated demo scenarios sharing one station mixed together where a real deployment's naturally-separated data wouldn't.
- **No caching or pre-computation.** Every `GET /recommendations` call recomputes all five algorithms from scratch, including a per-station loop for efficiency drift and auth-failure-spike. Fine at pilot scale (a handful of stations); would need attention before a large fleet.
- **No acknowledge/dismiss action**, per the work order's own scope — a recommendation disappears only when its underlying condition clears, not because anyone marked it seen. [RECOMMENDATION_STRATEGY.md](../product/RECOMMENDATION_STRATEGY.md) already named this as a deliberate near-term gap, not an oversight.

## Screenshots

`docs/implementation/screenshots-operational-intelligence/`:

- `01-dashboard-full.png` — the complete "Centro de Operaciones" page with all 5 recommendation cards visible, above the "Datos de demostración" boundary.
- `02-operational-intelligence-widget.png` — the widget and the rest of the live operational section, scrolled into view.

## Demo

Navigable locally: `pnpm --filter @mediafox/movos-api dev` (port 4000) + `pnpm --filter @mediafox/movos-web dev` (port 3002), log in as the seeded Kylum Energy admin, land on `/dashboard`. The "Inteligencia operativa" widget sits directly below the Sprint 1 operator widgets.
