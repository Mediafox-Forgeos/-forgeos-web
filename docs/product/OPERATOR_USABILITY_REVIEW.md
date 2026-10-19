# Operator Usability Review — Sprint 1

**Work order:** WO-ARGOS-022A (Operator Demo Review)
**Status:** REVIEW ONLY. No code, migration, or API change. Every finding below was produced by actually operating the running Sprint 1 build (`OPERATOR_CONTROL_CENTER_SPRINT_1_COMPLETE`, `cc98d48`) — logged in as the seeded Kylum Energy admin, against a real seeded fleet — not by re-reading prior design documents. Where a finding reflects something outside Sprint 1's own scope (an existing mock page, a pre-existing app-wide behavior), that is stated explicitly rather than attributed to Sprint 1.
**Method:** a real Playwright/Chromium session, since the interactive browser tool was unavailable in this environment (the same substitution used for [CAPX_SPRINT_1_TECHNICAL_NOTES.md](../implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md)'s screenshots). `movos_dev` was seeded with 4 stations deliberately spanning all 4 health states (`healthy`, `degraded`, `offline`, `unknown`) and 2 real active sessions — the same fixture used for Sprint 1's own validation, reused here so this review's findings are reproducible. Screenshots: `docs/product/screenshots-review/`.

## The scenario

Acting as an operator at Kylum Energy, logging into MOVOS for the first time after Sprint 1 shipped, with:

- **Bogotá Centro** (3 stations): `BOG-CTR-01` healthy and online with an active session; `BOG-CTR-02` degraded (1 of 2 EVSEs faulted) with an active session on its other EVSE; `BOG-CTR-03` offline.
- **Medellín El Poblado** (1 station): `MED-POB-01`, connectivity `unknown` (never reported in).

## Task 1 — Find the busiest station

**What I did:** the "Sesiones activas" widget on the Resumen (dashboard) screen lists both real active sessions by station name directly — `Estación Bogotá Centro 01` (8.4 kWh, running ~1h) and `Estación Bogotá Centro 02` (3.1 kWh, running ~32 min). With two sessions, eyeballing which has run longer/delivered more energy is trivial.

**Finding:** this "worked," but only because the fleet is tiny. There is no ranking, no per-station session count, and no aggregation of any kind — "busiest" is a concept I had to construct myself by reading two rows and comparing numbers mentally. At real pilot scale (dozens of stations, more concurrent sessions than fit in one card without scrolling), this task would stop being answerable from this screen at all. See [OPERATOR_KPIS.md](./OPERATOR_KPIS.md) KPI 4 (Utilization Rate) — the KPI that would actually answer this question doesn't exist yet, by that document's own honest admission.

## Task 2 — Find offline stations

**What I did:** the dashboard's "Conectividad" widget told me _that_ 1 station is offline and 1 is unknown — but not _which_ ones. To get names, I had to leave the dashboard entirely: Sitios → Bogotá Centro → the "Infraestructura" tab, where each station card shows a real connectivity badge (`BOG-CTR-03` marked "Desconectado"). See `bogota-site-infraestructura.png`.

**Finding:** the dashboard answers "is something offline" in under a second, but answering "which station" required 3 clicks into a screen Sprint 1 didn't build and doesn't link to. [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md) already classified "Alerts (attention queue)" P0 specifically because status counts without names force exactly this manual cross-referencing — this task is a live demonstration of that finding, not a new one.

## Task 3 — Find stations with active sessions

**What I did:** same widget as Task 1 — direct, immediate, correct.

**Finding:** the only one of the five tasks the dashboard fully self-serves without leaving the screen. Worth naming as a real win, not just a gap report.

## Task 4 — Identify operational bottlenecks

**What I did:** the dashboard told me 1 station is "degraded" but not which one, or why. Cross-referencing against the Infraestructura tab (Task 2's path) identified `BOG-CTR-02` as the degraded station. Its card there, though, reads only "En línea" — connectivity is fine, so nothing on that screen signals a problem. I had to click one level deeper, into the station's own detail page, to see its EVSE list: EVSE 2 marked "Con falla" (faulted), EVSE 1 "Cargando" (mid-session). See `station-02-detail.png`.

**Finding:** the actual bottleneck — one of Bogotá Centro's three stations is running at half its real capacity, mid-session, on the working half — is real, present in the data, and completely discoverable... after connecting three separate screens by hand, two of which use different status vocabularies for the same station (see "What causes confusion," below). Nothing in the product surfaces this as a bottleneck; I found it only because I already knew, from the architecture documents, what "degraded" was supposed to imply and went looking for the cause.

## Task 5 — The first three actions an operator would take

Grounded in exactly what today's build makes possible, not what a future one might:

1. **Name the offline station.** Sitios → Bogotá Centro → Infraestructura, to convert "1 station offline" into "`BOG-CTR-03` is offline" — the same detour Task 2 required.
2. **Diagnose the degraded station.** Drill into `BOG-CTR-02`'s own detail page to learn it's specifically EVSE 2 that's faulted, not the whole station — the information a technician would actually need before being dispatched.
3. **Leave the product.** There is no fourth in-app step, because there is no action to take once the diagnosis is made — no acknowledge, no assign, no dispatch. The `Alertas` nav item exists and _looks_ like it would be that step (see below), but it isn't connected to anything real. The operator's actual third action is a phone call or a message app outside MOVOS entirely.

This is the sharpest finding in the whole exercise: today, MOVOS can tell an operator _that_ something is wrong and, with enough digging, _what_ is wrong — but offers no way to _do_ anything about it inside the product. That gap is exactly what [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) (Sprint 2) was architected to close, and this task makes the case for it with a lived example rather than a hypothetical one.

## What feels useful

- **The real-time status strip.** "Is anything wrong right now" in one glance is a genuine improvement over the pre-Sprint-1 state, where answering that question meant opening the CRUD screens for every station one at a time.
- **The active-sessions widget.** Real names, real energy, real elapsed time, zero drilling — the one part of this review with no complaint attached.
- **Occupancy as a single percentage.** Immediately legible, no interpretation required.
- **The station-detail EVSE view**, once reached — precise enough that a technician could act on it directly ("EVSE 2, faulted" is unambiguous). The problem with it is findability, covered below, not the information itself.

## What feels unnecessary

- **The map, in a Maps-key-less environment, is a large empty rectangle.** "Vista de mapa no disponible" is the correct, honest fallback ([CAPX_SPRINT_1_TECHNICAL_NOTES.md](../implementation/CAPX_SPRINT_1_TECHNICAL_NOTES.md) already documents why), but it still occupies roughly a third of the primary viewport with zero information in that state. Worth considering, for any environment where the key genuinely won't be configured (not this one, but conceivably a constrained pilot deployment): collapsing the empty map rather than reserving its full footprint.
- **The pre-existing "Datos de demostración" section, directly beneath the real one, for a customer who is actually operating a pilot (as opposed to being pitched to).** The pilot-milestones, pre-Sprint-1 mock "Alertas abiertas" card, recent-activity feed, and revenue estimate all read as filler once the real section above has already answered the operational question — for an investor demo this sequencing is correct (per [CAPX_INVESTOR_DEMO.md](./CAPX_INVESTOR_DEMO.md)'s own "tomorrow vs. day 30" framing), but for a working operator it's competing screen space that doesn't help them do their job.

## What information is missing

- **Names, not just counts, on the status-strip widgets.** "1 degraded" required two more screens to become "`BOG-CTR-02`, EVSE 2." [OPERATOR_MODULE_PRIORITY.md](./OPERATOR_MODULE_PRIORITY.md) already predicted this specific gap.
- **A busiest-station or load signal** beyond manually scanning the raw active-session list — real at 2 sessions, unworkable at fleet scale.
- **Any recurrence/pattern signal.** `BOG-CTR-02`'s fault might be a first-time blip or the fifth time this month — nothing distinguishes those today. This is precisely `FLAPPING_CONNECTOR` from [CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md), not yet built.
- **One consistent status vocabulary for one station.** See the next section — this is as much a confusion source as a missing-information one.

## What causes confusion

Ranked by how sharply each one would land on a real operator, most confusing first:

1. **The main "Sesiones" nav item shows a completely different, fictional set of active sessions than the real dashboard widget** — different session ids (`sess-01`...`sess-06` vs. real CUIDs), different site names entirely (`Centro Logístico Norte`, `Terminal Sur Medellín` — neither of which exists in this organization's real data; the real sites are `Bogotá Centro` and `Medellín El Poblado`). See `nav-sesiones.png`. This isn't a subtle inconsistency — it's two contradictory answers to "what's active right now," one real and one fictional, one click apart in the same product. This page predates Sprint 1 (Feature Matrix already listed Sessions frontend as "mock frontend not migrated") but Sprint 1's real widget now sits directly above a sidebar link to it, which makes the contradiction newly reachable in a way it wasn't before.
2. **Clicking a real active session 404s.** The dashboard's active-sessions widget links each row to `/sessions/{realId}`, but that route only recognizes the fixture ids the mock `/sessions` list above uses — a real session id resolves to "Página no encontrada." See `active-session-detail-target.png`. This is a genuine defect introduced in Sprint 1 itself (the link target was wired to a page that was never real), not a pre-existing gap — worth fixing before this reaches an actual operator, even though this review's own scope is observation, not repair.
3. **The `Alertas` nav page looks fully functional and isn't.** Its "Reconocer"/"Resolver" buttons render exactly like real controls; only a small line of text states the actions don't persist to any backend. An operator who doesn't read that line, or reads it once and forgets, could reasonably believe they've acknowledged a real fault. This predates Sprint 1, but Sprint 1's dashboard also embeds a smaller version of the same fake alert list in its own "Alertas abiertas" card, which normalizes treating it as real.
4. **The same station gets two different verdicts on two different screens.** `BOG-CTR-02` reads "En línea" (fine) on the Sitios → Infraestructura card, and "Degradada" on the dashboard's Estado de estaciones widget — both correct, in the narrow sense that connectivity really is fine and health really is degraded, but nothing tells the operator these are two different questions about the same station rather than a contradiction.

## What would make an operator pay for MOVOS

Answered from what this exercise actually demonstrated, not from aspiration: the single gap Task 5 exposed — MOVOS can already tell an operator _that_ and, with real effort, _what_ is wrong, but offers no way to _act_ on it without leaving the product — is the exact gap a paying network operator would not tolerate for long. [CAPX_INVESTOR_DEMO.md](./CAPX_INVESTOR_DEMO.md) is right that the hardened data foundation (real sessions, real connectivity, real multi-tenant billing attribution) is a genuinely strong technical story to tell an investor tomorrow. But an operator doesn't pay for a foundation — they pay for not being the one who has to manually cross-reference three screens with two status vocabularies to find out their own equipment is broken, and then pick up a phone because the product can't take the next step for them. That is precisely Sprint 2's scope ([CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md) — detection → alert → assignment → resolution → closure), and this review found nothing that argues against that sequencing — if anything, Task 4 and Task 5 are a lived argument _for_ building it next, with a concrete example (`BOG-CTR-02`, EVSE 2) rather than a hypothetical one.

A second, smaller thing worth naming: a single station-level view that unifies connectivity, computed health, active sessions, and EVSE-level fault detail — today spread across the dashboard, the Sitios → Infraestructura tab, and the station detail page, in that order — would cut Task 4's three-screen diagnosis down to one. This doesn't require Sprint 2's new domain entities at all; it's a presentation-layer consolidation of data that's already real, in the same spirit [CAPX_DATA_MATRIX.md](./CAPX_DATA_MATRIX.md) used to classify Sprint 1's own widgets.

## Screenshots

`docs/product/screenshots-review/`:

- `dashboard-home.png` — the Resumen screen used for Tasks 1 and 3.
- `bogota-site-infraestructura.png` — the real per-station connectivity list used for Task 2.
- `station-02-detail.png` — the EVSE-level fault detail used for Task 4.
- `nav-sesiones.png` — the mock Sesiones page, evidence for confusion finding #1.
- `active-session-detail-target.png` — the 404, evidence for confusion finding #2.
- `nav-alertas.png` — the non-functional Alertas page, evidence for confusion finding #3.
- `nav-sitios.png`, `nav-estaciones.png`, `bogota-site-resumen.png`, `site-detail.png` — supporting navigation evidence.
