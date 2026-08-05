# CAP-X — Sprint 1 Technical Notes

**Work order:** WO-ARGOS-022 (Operator Control Center Sprint 1)
**Status:** IMPLEMENTED. Real code, real database, real screenshots — this is the first CAP-X deliverable that isn't documentation-only.
**Scope actually shipped:** mapa operacional, estado de estaciones, sesiones activas, ocupación instantánea — exactly the three ALCANCE items and five OBJETIVOS named in the work order. No alerts, incidents, maintenance, or CAP-010 code exists anywhere in this change.
**Builds on:** [CAP-X_OPERATOR_DOMAIN.md](../domain/CAP-X_OPERATOR_DOMAIN.md), [CAP-X_STATION_HEALTH.md](../domain/CAP-X_STATION_HEALTH.md), [CAPX_MVP_WIDGETS.md](../product/CAPX_MVP_WIDGETS.md), [CAPX_SPRINT_PLAN.md](./CAPX_SPRINT_PLAN.md), [CAPX_COMPONENT_MAP.md](./CAPX_COMPONENT_MAP.md), [CAPX_DATA_DEPENDENCIES.md](./CAPX_DATA_DEPENDENCIES.md).

## What shipped

### Backend (`apps/movos-api`)

- **`src/operator/station-health.service.ts`** — `StationHealthService`. Pure, non-persisted computation (`computeHealth`) plus four aggregation methods (`summarizeFleet`, `summarizeConnectivity`, `summarizeBySite`, `getOccupancy`). Every query filters to `ChargingStationStatus.ACTIVE` — a `DRAFT`/`INACTIVE`/`ARCHIVED` station is excluded from the live operational view entirely, rather than misleadingly reading as `offline`/`unknown`.
- **`src/operator/operator.controller.ts`** / **`operator.module.ts`** — four read-only endpoints: `GET /operator/fleet-status`, `/operator/connectivity`, `/operator/map`, `/operator/occupancy`, each accepting an optional `siteId` query param, all behind the existing `JwtAuthGuard`/`OrgContextGuard`/`RolesGuard` stack — no new authorization pattern introduced.
- **`src/sessions/sessions.service.ts`** — added `listActive()`, joining `Site`/`ChargingStation` names (a read-only Prisma `include`, not a schema change) so the ACTIVE_SESSIONS widget shows human-readable names, not raw ids.
- **`src/sessions/sessions.controller.ts`** — added `GET /sessions/active`, registered _before_ `GET /:id` to avoid the literal string `"active"` being swallowed by the `:id` route parameter.
- **`packages/shared-types/src/movos-api.ts`** — 8 new exported types (`StationHealthStatus`, `ApiStationHealth`, `ApiStationHealthSummary`, `ApiConnectivitySummary`, `ApiConnectorStatusCounts`, `ApiOccupancySummary`, `ApiSiteHealthSummary`, `ApiActiveSession`), consumed by both the API and the web console from the same source of truth.

### Frontend (`apps/movos-web`)

- **`src/components/operator/`** — new folder: `fleet-map.tsx`, `station-status-widget.tsx`, `connectivity-widget.tsx`, `occupancy-widget.tsx`, `active-sessions-widget.tsx`, `station-health-badge.tsx`, `use-polled-resource.ts` (a shared 15-second polling hook — see "Real-time strategy" below), and `operator-live.tsx` (composes all five into the "vista operacional principal").
- **`app/(app)/dashboard/page.tsx`** — the existing "Centro de Operaciones" page (already, by name, the operational home Objective 3 asks for) now renders `<OperatorLive />` directly under the existing live org/health strip, with real data. The two mock cards it directly superseded — "Estado de la red" (network distribution) and "Sesiones activas" — were removed, since leaving fabricated numbers next to their real replacements would have been actively misleading, not merely redundant. Every other pre-existing demo section (executive metrics, pilot milestones, alerts, recent activity, the revenue estimate) is untouched and remains clearly under the page's existing "Datos de demostración" heading.

### Objective 1 — "Extender el SiteMap existente"

`FleetMap` is a genuine extension, not a rebuild: same library (`@vis.gl/react-google-maps`), same `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` env var, same graceful "Vista de mapa no disponible" fallback when that key isn't configured — all reused verbatim from `src/components/location/site-map.tsx`. What's new: multiple `AdvancedMarker`s instead of one, `Pin` color driven by each site's worst `StationHealth`, `gestureHandling="greedy"` instead of disabled (this is the primary interactive map, not an inline preview), and a click-triggered `InfoWindow` showing the site's name and health breakdown.

### Objective 2 — Health states shown: `healthy`/`degraded`/`offline`/`unknown`

Implemented exactly the 4-state precedence from [CAP-X_STATION_HEALTH.md](../domain/CAP-X_STATION_HEALTH.md), **minus** the 5th state and two of its degraded triggers — deliberately, per the work order's own restrictions:

| From the full architecture                             | Sprint 1 status                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `offline` (connectivity-driven)                        | Implemented                                                                          |
| `unknown` (connectivity-driven)                        | Implemented                                                                          |
| `degraded` — faulted connector/EVSE                    | Implemented                                                                          |
| `degraded` — open unacknowledged `Alert`               | **Not implemented** — no `Alert` model exists yet (Sprint 2)                         |
| `degraded` — `HIGH_FAILURE_RATE` rolling-window breach | **Not implemented** — depends on the same detection infrastructure as the line above |
| `healthy` (default)                                    | Implemented                                                                          |
| `maintenance` (5th state, `MaintenanceTicket`-driven)  | **Not implemented** — no `MaintenanceTicket` model exists yet (Sprint 2)             |

This is not a shortcut taken silently — it is the exact boundary WO-ARGOS-022 drew ("No implementar alertas... incidentes... mantenimiento"), and every deferred item was already flagged as Sprint-2-dependent in the architecture and implementation-plan documents this work order builds on.

### Objectives 3–5 — Operational home, active sessions, instantaneous occupancy

All real, all described above. `Ocupación instantánea` is deliberately a snapshot (current `Connector.status` counts), not a trend — the trend/utilization variant needs `OccupancySnapshot` history that doesn't exist, exactly as scoped in [CAPX_SPRINT_PLAN.md](./CAPX_SPRINT_PLAN.md)'s Sprint 3 boundary note.

### Objective 6 — Compatibility with CAP-002 through CAP-009

- **No `schema.prisma` change.** `git diff` on this branch touches zero lines of the schema file — every new endpoint reads existing, already-migrated tables.
- **No existing migration, model, or service was modified** — `StationHealthService` and the operator module are additive; `SessionsService`/`SessionsController` gained one new method and one new route, nothing existing was changed.
- **Full monorepo typecheck, full lint, and the full existing unit-test suite (256 tests across 31 suites) all pass unmodified** — see "Validation," below.
- **The existing e2e suite (`auth`, `tenant-isolation`, `billing-foundation` — 22 tests) passes unmodified.**

## Real-time strategy: polling, not push

`usePolledResource` (15-second interval, 30 seconds for the map) is the only new client-side data-fetching mechanism introduced. This follows [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md)'s explicit recommendation — "start with polling... revisit push-based delivery only if polling proves visibly too slow" — and the same pattern `_dashboard-live.tsx` already used for the org/health strip, just shared across five widgets instead of copy-pasted into each.

## StationHealth precedence — implemented as an early-return chain, not independent flags

Directly addressing [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md) risk #1 (precedence correctness): `computeHealth()` in `station-health.service.ts` returns on the first matching condition in order (`OFFLINE` → `UNKNOWN` → faulted-connector → `healthy`), not a set of booleans resolved afterward — the exact mitigation that risk note called for. 14 unit tests in `station-health.service.spec.ts` cover every row of the precedence table, including the specific case the architecture doc calls out by name: all connectors faulted while connectivity is still `ONLINE` resolves to `degraded`, never `offline`.

## Validation performed

All of the following were run against this branch, not assumed:

1. **`pnpm typecheck`** (root, all 12 workspace projects) — clean.
2. **`pnpm lint`** (`movos-api`, `movos-web`) — clean.
3. **`jest`** in `movos-api` — 256/256 existing + new tests pass, zero regressions.
4. **`jest --config test/jest-e2e.json`** — 22/22 existing e2e tests pass against real PostgreSQL, zero regressions.
5. **Real-database validation** — seeded `movos_dev` with 4 `ChargingStation`s deliberately spanning all four health states (one `ONLINE`+all-connectors-fine, one `ONLINE`+one-`FAULTED`-connector, one `OFFLINE`, one left at the default `UNKNOWN`), plus 2 real `ChargingSession` rows. Booted the real API against real Postgres and confirmed every new endpoint's response by hand:
   - `GET /operator/fleet-status` → `{"healthy":1,"degraded":1,"offline":1,"unknown":1}` — exactly the seeded distribution.
   - `GET /operator/map` → correctly rolled the Bogotá site's worst status up to `"offline"` (one of its three stations is offline) despite also containing a healthy and a degraded station — confirming the precedence rollup, not just the per-station computation, is correct.
   - `GET /operator/occupancy` → `{"occupiedCount":1,"eligibleCount":2,"occupancyRate":0.5}`, matching the seeded connector states by hand-count.
   - `GET /sessions/active` → both seeded sessions returned with correct, real site/station names.
6. **Real browser validation** — logged into the running `movos-web` dev server (Playwright/Chromium) as the seeded Kylum Energy admin and screenshotted the live operational home. See `docs/implementation/screenshots/`.

## Known, honest limitations of this Sprint 1 slice

- **The map renders as "Vista de mapa no disponible" without a configured `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY`** — identical fallback behavior to the pre-existing `SiteMap` component, not a new gap. No key was available in the environment this was built and screenshotted in; the component and its data layer (`/operator/map`) are complete and were validated directly via API response, independent of map rendering.
- **`StationHealth` history does not exist** — every widget shows current state only. An operator cannot yet see "this station has been degraded since 9am" — that requires the status-history log named as a cross-cutting gap in [OPERATOR_KPIS.md](../product/OPERATOR_KPIS.md) and [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md), out of scope for Sprint 1.
- **No pagination on `/sessions/active` or the fleet-status aggregation queries** — flagged as a Low-risk, known gap in [CAPX_RISK_MATRIX.md](./CAPX_RISK_MATRIX.md) risk #6; acceptable at pilot scale (Kylum Energy's current seeded fleet is 4 stations), a real constraint before a much larger fleet is onboarded.
- **No E2E test file was added for the new endpoints specifically** — validated by hand against a real database and real HTTP requests (documented above) rather than a committed automated e2e spec, given the time budget for this sprint. A follow-up worth doing before this ships past a pilot: a `operator-control-center.e2e-spec.ts` mirroring `billing-foundation.e2e-spec.ts`'s real-Postgres pattern.

## Screenshots

See `docs/implementation/screenshots/`:

- `01-operator-home-full.png` — the full "Centro de Operaciones" page, live data visible above the "Datos de demostración" boundary.
- `02-operator-home-live-section.png` — the live operational section alone, scrolled into view.

## Demo

Navigable locally: `pnpm --filter @mediafox/movos-api dev` (port 4000) + `pnpm --filter @mediafox/movos-web dev` (port 3002), log in as the seeded Kylum Energy admin, land on `/dashboard`. The CI-deployed Vercel preview for this PR serves the same build against whatever `NEXT_PUBLIC_MOVOS_API_URL` its environment is configured with — see the PR's own Vercel preview comment for that live link.
