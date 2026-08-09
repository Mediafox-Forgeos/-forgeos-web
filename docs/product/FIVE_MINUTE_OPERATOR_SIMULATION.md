# Five-Minute Operator Simulation

**Work order:** WO-ARGOS-032 (Product Reality Check)
**Status:** PRODUCT VALIDATION. No code, API, migration, or `schema.prisma` change. Every screen, widget, and interaction below is real — the same console captured in [KYLUM_CONSOLE_VISUAL_GUIDE.md](./KYLUM_CONSOLE_VISUAL_GUIDE.md). Nothing is invented for the sake of the story except the specific scenario numbers.

## The scenario

Monday, 8:00 AM. One station is offline. Two incidents (`Action` rows) are open — one `HIGH` severity, one `MEDIUM`. One technician is en route to a job. Twenty charging sessions are active.

## 0:00 — Login, Command Center loads

The operator lands on Command Center. The health verdict reads **"Problema de conectividad"** — not "degraded," not a count-based warning, the connectivity-failure state specifically, because `StationHealthService.computeHealth()`'s precedence rule puts any offline station ahead of everything else, fleet-wide. **First honest observation:** this verdict cannot distinguish one offline station from twenty. The operator knows something is disconnected; they don't yet know the scope.

## 0:15 — Scanning the six cards

- **Estaciones en línea:** one fewer than the total — consistent with the scenario.
- **Sesiones activas:** 20 — matches the scenario, but the operator moves past it in about a second. Nothing about this number, on its own, requires a decision. (This matches [WIDGET_VALUE_ANALYSIS.md](./WIDGET_VALUE_ANALYSIS.md)'s "Optional" classification for this card — the simulation confirms it in real time, not just on paper.)
- **Acciones abiertas: 2** — matches the scenario, and this is the number that actually moves the operator's attention.
- **Técnicos en ruta: "No disponible."** The operator already knows, from a WhatsApp message before login, that a technician is en route — this is real information they have and the product does not. The one card built for this exact fact is the one card that can't show it. This is not a hypothetical gap; it is the gap actually present the moment this scenario starts.
- **Disponibilidad de red:** a supporting number, glanced at, not acted on.

## 0:45 — Incidentes urgentes card

Only **one** of the two open Actions appears here — the `HIGH`-severity one. The `MEDIUM` one exists (it's real, it's in `/actions`) but doesn't meet this card's severity filter. **Second honest observation:** an operator who only reads the urgent-incidents card and doesn't go to Operations will not learn the second incident exists at all in these first minutes. Whether that's the right filtering choice or too aggressive a cut is exactly the kind of question this reality-check sprint exists to surface — see [WIDGET_VALUE_ANALYSIS.md](./WIDGET_VALUE_ANALYSIS.md).

## 1:15 — The offline station isn't an incident

The operator, reading the drop in "Estaciones en línea," goes looking for the offline station specifically — and finds it is **not** one of the two open Actions. `RecommendationService`'s five detectors (`ENERGY_ANOMALY`, `AUTH_FAILURE_SPIKE`, `IDLE_CONNECTOR`, `COMPARATIVE_UNDERPERFORMANCE`, `EFFICIENCY_DRIFT`) have no "station offline" trigger — connectivity loss alone never produces an `Action`. **Third, and sharpest, honest observation:** the single fact driving the entire fleet health verdict is invisible to the one screen built to manage problems. The operator has to go find it manually.

## 2:00 — Network, station list, drawer

The operator clicks **Red** in the sidebar, scans the station list for the `Desconectado` badge, finds it, and opens the drawer. Real information appears: manufacturer, model, and — critically — "Última conexión," from which the operator can work out how long it's actually been down. What the drawer cannot say: _why_. No fault code, no last-known error, nothing from the raw OCPP protocol event log surfaces in this view. The operator knows a station stopped talking to MOVOS; they don't know if that's a power outage, a network issue, or a dead device.

## 3:00 — The cross-reference problem

The operator now holds two separate facts from two separate places: _a technician is en route_ (known only from a phone/WhatsApp message) and _this specific station is offline_ (known from the product). **Nothing connects them.** Is the technician already headed to this exact station, or to something else entirely? MOVOS has no way to answer that question — there is no technician record, no destination field, no link between a dispatch conversation that happened outside the product and any case inside it. The operator either remembers the earlier conversation well enough to be sure, or picks up the phone again to confirm. This single moment is the clearest, most concrete instance of [PRODUCT_GAPS.md](./PRODUCT_GAPS.md) gap #1 (technician dispatch) actually happening, not just described abstractly.

## 3:30 — Operations, working the two real cases

The operator moves to **Operaciones** and sees both cases now — the `HIGH` one already seen on Command Center, and the `MEDIUM` one that wasn't. Two real actions, taken with the real, server-enforced transition controls:

- The `MEDIUM` case: **Reconocer** (acknowledge) — seen, not urgent enough to act on in these five minutes.
- The `HIGH` case: **Asignarme**, then a note — and here is where the outside-channel information from step 3:00 finally enters the product, the only way it can: typed into the `notes` field by hand. Something like _"Técnico en camino, confirmado por WhatsApp 7:52am."_ This is the operator manually bridging a gap the product doesn't close on its own — a real workaround, not a feature.

## 4:15 — Analytics is not opened

At no point in this five minutes does the operator open **Analítica.** Nothing in this scenario calls for it — no same-day decision depends on a weekly trend or a station ranking. This isn't an oversight in the walkthrough; it's the same finding [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md) and [WIDGET_VALUE_ANALYSIS.md](./WIDGET_VALUE_ANALYSIS.md) already made on paper, now confirmed by walking an actual five minutes rather than asserting it abstractly.

## 5:00 — Where things stand

- **Screens visited:** Command Center → Network → Operations. Never Analytics.
- **Real product actions taken:** one case acknowledged, one case self-assigned with a note.
- **What the operator still doesn't know, five minutes in:** whether the technician they know is en route is actually headed to the offline station they just found, or somewhere else — because nothing in MOVOS can tell them.
- **What the twenty active sessions had to do with any of this:** nothing. The number was seen once, at 0:15, and never referenced again.

## What this simulation demonstrates

Every screen the operator actually used in this scenario earns its place — Command Center for the first glance, Network for the one piece of information Command Center couldn't provide (identity), Operations for the one thing the whole console can actually _do_ (change a case's state). Analytics correctly sat unused, exactly matching its documented cadence. But the walkthrough surfaces something none of the other four documents in this sprint state as sharply: **the single most disruptive fact in this whole scenario — a station going offline — never becomes a tracked case in the product at all**, and the single most useful piece of outside information the operator has — a technician's real destination — has nowhere to live except a free-text note, typed after the fact, on a case that may not even be the right one. Those two gaps, not a missing screen or a missing widget, are what actually slowed this operator down.
