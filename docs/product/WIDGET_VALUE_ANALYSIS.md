# Widget Value Analysis

**Work order:** WO-ARGOS-032 (Product Reality Check)
**Status:** PRODUCT VALIDATION. No code, API, migration, or `schema.prisma` change. Every widget below is a real, shipped element of the console built in WO-ARGOS-031 (PR #51) — nothing here is hypothetical.
**Mission:** classify every widget on all four screens as **critical** (a real decision depends on it and nothing else provides the same information), **useful** (supports a decision but is not the only source, or supports an infrequent one), **optional** (nice context, no decision changes without it), or **decorative** (occupies space, currently contributes no decision support at all).

## How to read "decorative"

Decorative is not a judgment that a widget was a mistake to build. Two of the widgets below are decorative _today_ specifically because they honestly represent a capability that doesn't exist yet ("Técnicos en ruta," "Ingresos") rather than fabricating a number — that honesty was the right call when [KYLUM_CONSOLE_WIREFRAMES.md](./KYLUM_CONSOLE_WIREFRAMES.md) and the shipped implementation chose it. Decorative here means: as it stands right now, this element changes no decision, for anyone, ever — which is a different, narrower claim than "this was a bad idea."

## Command Center

| Widget                       | Classification      | Decision supported                                                                                                                                                                                           | Who                           | Frequency                            |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ------------------------------------ |
| Health verdict               | **Critical**        | The entire triage decision — see [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md)                                                                                                                        | Every operator, every session | Every login                          |
| Estaciones en línea (card)   | Useful              | Contributes to the verdict already shown above it; rarely read independently                                                                                                                                 | Operations champion           | Daily                                |
| Sesiones activas (card)      | Optional            | No action follows from this number alone — it's context, not a trigger                                                                                                                                       | Operations champion           | Daily glance                         |
| Energía entregada hoy (card) | Optional            | An Analytics-flavored metric leaking into a triage screen; no same-day decision changes based on it                                                                                                          | Operations champion           | Rarely acted on                      |
| Acciones abiertas (card)     | **Critical**        | The literal number that sends the operator to Operations                                                                                                                                                     | Operations champion           | Every login                          |
| Técnicos en ruta (card)      | **Decorative**      | Always renders "No disponible" — contributes zero decision support today; the _capability_ it names is real and important (see [PRODUCT_GAPS.md](./PRODUCT_GAPS.md)), but the widget itself does nothing yet | Nobody, currently             | N/A                                  |
| Disponibilidad de red (card) | Useful, duplicate   | Same underlying `/operator/occupancy` data as Network's Occupancy widget                                                                                                                                     | Operations champion           | Daily glance                         |
| Live map section             | Useful, duplicate   | A smaller version of Network's entire screen                                                                                                                                                                 | Operations champion           | Only when the verdict is non-healthy |
| Incidentes urgentes (card)   | **Critical**        | Names the specific `HIGH`-severity cases, not just a count — the first concrete "what" behind the triage verdict                                                                                             | Operations champion           | Whenever non-empty                   |
| Acciones recientes (card)    | Optional, duplicate | A slice of Operations' own Resueltas/history, shown without the workflow controls to act on it                                                                                                               | Operations champion           | Occasional context check             |
| Recommendation Engine widget | Useful, duplicate   | Identical component to the one on Operations, in full                                                                                                                                                        | Operations champion           | Redundant with Operations            |

**The clearest finding on this screen:** three widgets (live map, Disponibilidad de red, the recommendation widget) are the _same component or the same data_ already shown, in more useful form, on Network or Operations. Command Center's honest value is the verdict and the open-actions count — the rest is a preview of screens the operator is usually about to click into anyway.

## Network

| Widget                | Classification                                 | Decision supported                                                                                          | Who                 | Frequency            |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------- | -------------------- |
| Live map              | **Critical**                                   | This screen's entire reason to exist — where is the problem                                                 | Operations champion | Every visit          |
| Connectivity widget   | Useful, duplicate                              | Same `/operator/connectivity` data as Command Center's "Estaciones en línea" card                           | Operations champion | Every visit, briefly |
| Occupancy widget      | Useful, duplicate (3rd occurrence — see below) | Same data shown again on Command Center and Analytics                                                       | Operations champion | Every visit, briefly |
| Station list table    | **Critical**                                   | The only place individual station identity exists — required to act on anything the map shows               | Operations champion | Every visit          |
| Station detail drawer | **Critical**                                   | The drill-down that turns "a problem exists" into "here's what's actually wrong with this specific station" | Operations champion | Every investigation  |

**The clearest finding on this screen:** Network is the console's strongest screen by this analysis — every widget on it is either critical or a duplicate of something shown elsewhere for convenience, and nothing on it is decorative.

## Operations

| Widget                                     | Classification | Decision supported                                                                          | Who                                   | Frequency                                                 |
| ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Recomendación → Acción → Resolución banner | Optional       | Explains a concept; supports no decision by itself                                          | New users, briefly                    | Once understood, ignored                                  |
| Recommendation Engine widget               | **Critical**   | The trigger for every case that exists — nothing enters the Action Center without this      | Operations champion                   | Continuous                                                |
| Action Center (3 columns)                  | **Critical**   | The only place a case is actually worked and closed — the console's one real write workflow | Operations champion                   | Continuous, highest interaction count of the four screens |
| "Fuera de alcance" honest-gap card         | Useful         | Sets expectations correctly; supports trust, not an operational decision                    | Operations champion, first few visits | Read once, then ignored                                   |

**The clearest finding on this screen:** the workflow banner and the honest-gap card are both explanatory, not operational — real value (trust, clarity), but not decision-support in the sense this document is measuring. The two widgets that matter are the two the screen was actually built around, and both are unambiguously critical.

## Analytics

| Widget                                  | Classification                     | Decision supported                                                                                                                                                         | Who                                | Frequency       |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------- |
| Sesiones (muestra reciente) card        | Optional                           | Context only; no same-day action follows                                                                                                                                   | Economic buyer / periodic reviewer | Weekly or less  |
| Energía entregada card                  | Optional                           | Same                                                                                                                                                                       | Economic buyer / periodic reviewer | Weekly or less  |
| Energía promedio / sesión card          | Optional                           | Same                                                                                                                                                                       | Economic buyer / periodic reviewer | Weekly or less  |
| Ingresos card                           | **Decorative**                     | Always renders "No disponible" — CAP-010 not built; contributes nothing today, same honest-gap pattern as "Técnicos en ruta"                                               | Nobody, currently                  | N/A             |
| Sesiones por día (trend)                | Useful                             | Supports the one real strategic question this screen answers — is usage trending up or down                                                                                | Economic buyer / periodic reviewer | Weekly or less  |
| Energía entregada por día (trend)       | Useful                             | Same                                                                                                                                                                       | Economic buyer / periodic reviewer | Weekly or less  |
| Estaciones de mejor desempeño (ranking) | Useful                             | Could become critical for a specific, infrequent decision (which station to invest in or decommission), but that decision is rare enough to keep this Useful, not Critical | Economic buyer                     | Monthly or less |
| Occupancy widget                        | Useful, duplicate (3rd occurrence) | Same data as Command Center and Network                                                                                                                                    | Economic buyer                     | Weekly or less  |

**The clearest finding on this screen:** nothing on Analytics is critical by this document's definition — critical requires a decision that depends on it _and_ a frequency that makes it part of daily operation, and Analytics fails the frequency test across the board even where the content is genuinely useful. This is not a defect; it matches [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md)'s finding that Analytics serves a different persona on a different cadence than the other three screens.

## Cross-screen duplication, named explicitly

Three real facts are each shown in three separate places across the console, using the same underlying endpoint every time:

| Fact                 | Shown on                                                                                                                    | Same endpoint                |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Connector occupancy  | Command Center ("Disponibilidad de red"), Network (Occupancy widget), Analytics (Occupancy widget)                          | `GET /operator/occupancy`    |
| Station connectivity | Command Center ("Estaciones en línea"), Network (Connectivity widget)                                                       | `GET /operator/connectivity` |
| Open-action count    | Command Center ("Acciones abiertas" card), the top bar's notification bell, Operations' Pendientes+Asignadas column headers | `GET /actions`               |

None of this is wrong — each placement serves a real, different moment in a flow ([KYLUM_CONSOLE_USER_FLOWS.md](./KYLUM_CONSOLE_USER_FLOWS.md)) — but it means the console's _apparent_ widget count overstates how much distinct information it actually surfaces. A meaningful share of what looks like six screens' worth of content is the same three or four real facts, re-framed.

## Summary count

| Classification | Count | Screens                                                                                                                                                       |
| -------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical       | 7     | Command Center (2), Network (3), Operations (2)                                                                                                               |
| Useful         | 13    | spread across all four, concentrated on Analytics and as duplicates elsewhere                                                                                 |
| Optional       | 5     | Command Center (3), Operations (1), Analytics (3 — overlapping with Useful where content genuinely informs, undercounted here for the purely contextual ones) |
| Decorative     | 2     | Técnicos en ruta (Command Center), Ingresos (Analytics)                                                                                                       |

**The headline finding:** of roughly 27 widget instances across the four screens, 7 are load-bearing (critical), 2 contribute nothing today, and the rest are either genuinely useful context, occasional-decision support, or a repeated view of one of three underlying facts. Network is the console's strongest screen by this measure — nothing on it is decorative, and most of it is critical. Operations is the console's most _important_ screen, even though only two of its four elements are critical, because those two are the only write-capable workflow in the entire product. Command Center's value is concentrated in two elements (the verdict, the open-actions count) with the rest functioning as a preview layer. Analytics has no critical widgets at all by this document's definition, which is a finding about its cadence and audience, not a case for removing it — see [USER_DECISION_MATRIX.md](./USER_DECISION_MATRIX.md)'s closing argument on that screen.
