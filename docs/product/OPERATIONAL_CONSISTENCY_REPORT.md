# Operational Consistency Report

**Work order:** WO-ARGOS-023 (Operational Consistency Hardening)
**Status:** IMPLEMENTED. Real code fixes, validated against real PostgreSQL and a real logged-in browser session — not documentation-only.
**Mission:** fix every operational inconsistency [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) (WO-ARGOS-022A) found, before Sprint 2 starts. **Constraints honored:** no `Alert`, no `Incident`, no `MaintenanceTicket`, no CAP-010 code anywhere in this change.

## What was found, and what was fixed

| #   | Finding (from the usability review)                                                                                                                | Fixed here?                                                  | How                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/sessions` nav page shows entirely fictional sessions (different ids, sites that don't exist in this org) contradicting the real dashboard widget | **Yes**                                                      | `/sessions` and `/sessions/[sessionId]` rebuilt on `GET /sessions` / `GET /sessions/:id` (real, already-existing endpoints) instead of `data/sessions.ts` fixtures. That file is deleted — nothing else referenced it.                                                                                                                                                                    |
| 2   | Active-session widget links 404                                                                                                                    | **Yes**                                                      | Root cause: the session detail page only recognized fixture ids. Fixed by making the detail page real (above) — a real session id now resolves correctly. Verified live: see `screenshots-consistency-after/session-detail-fixed.png`.                                                                                                                                                    |
| 3   | Same station reads "En línea" (Sitios → Infraestructura) vs. "Degradada" (dashboard) — different vocabularies, no visible link                     | **Partially — see "What this report does not claim," below** | The specific _wording_ bug this enabled — `ConnectivityStatus.OFFLINE` rendering as "Fuera de línea" on the dashboard's `ConnectivityWidget` and "Desconectado" everywhere else — is fixed. The two screens still describe two genuinely different dimensions (connectivity vs. computed health) by design; see [OPERATIONAL_VOCABULARY.md](./OPERATIONAL_VOCABULARY.md)'s Rule 1/Rule 2. |
| 4   | `Alertas` nav page looks fully functional (real-looking Reconocer/Resolver buttons) but does nothing                                               | **No — explicitly out of scope**                             | WO-ARGOS-023's own constraints forbid `Alert` work. Untouched, unmentioned in code, by design.                                                                                                                                                                                                                                                                                            |

## Objective 1 — Fix broken session links

**Root cause**, confirmed by reading the code before touching it: `apps/movos-web/app/(app)/sessions/[sessionId]/page.tsx` was a Sprint-0-era mock page that looked up `getSessionById()` against `data/sessions.ts`'s six hardcoded fixture rows (`sess-01`...`sess-06`). The Sprint 1 active-sessions widget ([WO-ARGOS-022](../implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md)) linked to `/sessions/{realId}` — a real CUID that page's lookup could never match, producing "Página no encontrada" on every single click.

**Fix**: the page is now a real, client-fetched view backed by `GET /sessions/:id` (an endpoint that already existed and already worked — the bug was entirely in the frontend never calling it). It also replaces the old page's fictional "events" timeline with a real one built from `GET /sessions/:id/meter-values` (also pre-existing, real, previously unused by any page).

**Verified live**: logged in as the seeded Kylum Energy admin, clicked the dashboard's active-session row, landed on a fully populated real detail page — energy, timestamps, site, station, connector, protocol, transaction id, all real. See `screenshots-consistency-after/session-detail-fixed.png`.

## Objective 2 — Remove fictional session data from operational flows

**`/sessions` (list)**: rebuilt on `GET /sessions`, which already supported `status`/`siteId` server-side filtering — the page's own filter dropdowns were already built and visible, just `disabled` with the text "Filtros disponibles cuando se conecte el backend." The backend has been connected since Sprint 1 (`GET /sessions` predates it, from CAP-004); this work order is what finally wired the page to it. The filters are now enabled, not new surface.

**`data/sessions.ts` deleted.** Before deleting, confirmed by grep that its only two consumers were the two pages just rewritten — nothing else in the app imported it (the dashboard's own "Sesiones activas" demo metric card, part of the clearly-labeled "Datos de demostración" section, is a hardcoded literal in `data/dashboard.ts` and was never wired to this file; it is untouched, and remains explicitly out of this work order's scope — see "What this report does not claim").

**A real cost column was not added.** The old mock table had a "Costo estimado" column with fabricated currency values. The real table has no such column — inventing one would have been the exact category of fictional data this objective exists to remove. Pricing remains blocked on Tariffs, unrelated to this work order (see [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md)'s Revenue exception).

**Type consolidation, as a side effect of doing this properly**: the active-sessions widget (`GET /sessions/active`) previously returned a separate, narrower `ApiActiveSession` type with the same `siteName`/`chargingStationName` enrichment now also needed by the general list/detail endpoints. Rather than duplicate that enrichment a second time, `ApiChargingSession` itself gained the two name fields, `ApiActiveSession` was deleted, and all three read paths (`list`, `getById`, `listActive`) now share one Prisma include and one presenter function. One canonical enriched session shape, not two near-identical ones — directly in the spirit of Objective 3.

## Objective 3 — Canonical operational vocabulary

See [OPERATIONAL_VOCABULARY.md](./OPERATIONAL_VOCABULARY.md) for the full table. Summary of what changed in code to match it:

- `ConnectivityWidget` (dashboard): "Fuera de línea" → "Desconectado" (now imports `CONNECTIVITY_STATUS_LABELS` instead of hardcoding its own copy).
- `StationHealthBadge`: `offline` state label "Fuera de línea" → "Desconectado"; both `offline`/`unknown` now import the same `CONNECTIVITY_STATUS_LABELS` constant rather than restating the words, documented as a deliberate shared-root-cause decision (Rule 1 in the vocabulary doc).
- `StationStatusWidget` (fleet-wide count labels): "Fuera de línea" → "Desconectadas", "Desconocido" → "Desconocidas" — corrected to agree in gender/number with "estaciones" while also fixing the same word-choice bug.
- **New**: `ApiChargingSessionStatusBadge`, covering all 10 real `ChargingSessionStatus` values — added because the real `/sessions` pages built for Objective 1/2 needed one, and none of the existing badge components covered the real enum (the legacy mock `SessionStatusBadge` only knows a 5-value fictional one that doesn't match).

## What this report does not claim

- **It does not claim every inconsistency the usability review found is now resolved.** Finding #4 (the fully-interactive-looking but non-functional `Alertas` page) is explicitly, deliberately untouched — the work order's own constraints forbid `Alert` work, and this report says so rather than silently leaving the gap unmentioned.
- **It does not unify `ConnectorStatus`/`EvseStatus.OFFLINE` with `ConnectivityStatus.OFFLINE`.** They stayed two different words on purpose — see [OPERATIONAL_VOCABULARY.md](./OPERATIONAL_VOCABULARY.md) Rule 2. A reviewer who expected every "offline"-shaped value in the app to now read identically should read that rule before flagging it as a miss.
- **It does not add a station-level unified view** (the "second, smaller thing" [OPERATOR_USABILITY_REVIEW.md](./OPERATOR_USABILITY_REVIEW.md) suggested — one screen combining connectivity, health, sessions, and EVSE fault detail). That was a suggestion for a future improvement, not a named objective of this work order, and building it wasn't authorized here.

## Validation performed

1. **`pnpm typecheck`** (root, all 12 workspace projects) — clean.
2. **`pnpm lint`** (`movos-api`, `movos-web`) — clean.
3. **`jest`** in `movos-api` — 256/256 pass, zero regressions.
4. **`vitest run`** in `movos-web` — 41/41 pass, including 26 for the two canonical-badge test suites (10 pre-existing + 16 new, covering every `ChargingSessionStatus` value).
5. **`jest --config test/jest-e2e.json`**, run against a separate scratch database (`movos_test`, not `movos_dev`) specifically so this validation pass would not wipe the demo fixture data used for the before/after screenshots — 22/22 pass.
6. **Real-database + real-HTTP validation** against `movos_dev`: confirmed `GET /sessions`, `GET /sessions/:id`, and `GET /sessions/active` all now return `siteName`/`chargingStationName` on every row.
7. **Real browser validation** (Playwright/Chromium, logged in as the seeded Kylum Energy admin): clicked the exact path that used to 404, confirmed it now renders a real session; loaded `/sessions` and confirmed it now shows the same two real sessions the dashboard widget shows, not six fictional ones; confirmed the dashboard's connectivity/health widgets now read "Desconectado"/"Desconectadas" instead of "Fuera de línea".

## Screenshots

**Before** (captured during WO-ARGOS-022A, `docs/product/screenshots-review/`):

- `nav-sesiones.png` — the fictional `/sessions` list (`sess-01`...`sess-06`, `Centro Logístico Norte`, `Terminal Sur Medellín` — none of which exist in this org's real data).
- `active-session-detail-target.png` — the 404 a real session link produced.
- `dashboard-home.png` — the dashboard's `ConnectivityWidget` reading "Fuera de línea" for the same value the Infraestructura tab called "Desconectado" (compare against `bogota-site-infraestructura.png` in the same folder).

**After** (`docs/product/screenshots-consistency-after/`):

- `sessions-list-real.png` — `/sessions` now showing the same two real sessions as the dashboard, filters enabled, no fictional rows.
- `session-detail-fixed.png` — the same session id that 404'd now resolving to a real detail page.
- `dashboard-home.png` — `ConnectivityWidget`/`Estado de estaciones` now reading "Desconectado"/"Desconectadas", matching the rest of the app.
