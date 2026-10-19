# Kylum Console — Navigation Model

**Work order:** WO-ARGOS-030 (Kylum Console Foundation)
**Status:** PRODUCT DESIGN. No code, API, migration, or `schema.prisma` change. This document proposes a reorganization of the real, shipped `MovosSidebar` component's item list — it does not implement it.
**Mission:** how an operator moves through the console — grounded in the real navigation shell already in production, not a new nav pattern invented from scratch.

## The current state, honestly

`MovosSidebar` today is a flat list of eleven items — Resumen, Sitios, Estaciones, Cargadores, Conectores, Sesiones, Usuarios, Tarifas, Alertas, Reportes, Configuración — all equal visual weight, in the order the original demo-data module map defined them, before the Operator Control Center (WO-ARGOS-022 onward) existed. Two items are visible legacy debt worth naming plainly: **Estaciones** and **Cargadores** are near-duplicates of each other, a leftover from before CAP-002 retired "Charger" as a persisted entity (`docs/domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md`) — the nav was never updated to match. This navigation model is the first deliberate redesign of that list since it was first written.

## The new model: primary command nav + secondary reference nav

Enterprise operational tools (the mission's own "enterprise-grade" principle) consistently separate **what you check** from **what you configure** — a small, fixed set of operational destinations up top, and administrative/reference screens demoted below a visual divider, reached rarely and deliberately. The Kylum Console adopts that split directly.

```
┌──────────────┐
│  Kylum        │
│──────────────│
│ ▸ Centro de   │  ← primary (4 items — the whole mission)
│   mando       │
│ ▸ Mapa de     │
│   red         │
│ ▸ Centro de   │
│   operaciones │
│ ▸ Negocio     │
│──────────────│  ← divider
│  Sitios       │  ← secondary (reference / administrative)
│  Sesiones     │
│  Tarifas      │
│  Configuración│
│──────────────│
│  [user]    ⏻  │
└──────────────┘
```

### Primary nav — the four screens, and nothing else

| Item                  | Route (proposed)                                                                                      | Replaces                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Centro de mando       | `/dashboard` (kept — this is the existing landing route, repointed to the new Command Center content) | Resumen                                                                                 |
| Mapa de red           | `/map`                                                                                                | The map portion of `OperatorLive`, promoted to its own screen                           |
| Centro de operaciones | `/operations`                                                                                         | Alertas (which was demo-only/placeholder) + the Action Center section of `OperatorLive` |
| Negocio               | `/business`                                                                                           | New — no equivalent exists today                                                        |

This is deliberately exactly four items, matching the mission's four screens one-to-one. No fifth primary item is proposed — adding one without a fifth real operator question to answer would repeat the exact "accretion, not architecture" problem this whole work order exists to fix.

### Secondary nav — reference and administration

| Item           | What changes                                                    | Rationale                                                                                                                                                                                                                                                                                        |
| -------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sitios         | Unchanged                                                       | Site creation/management is a provisioning task (add a new location), not a daily monitoring task — belongs in reference nav, not primary.                                                                                                                                                       |
| Sesiones       | Unchanged                                                       | "Look up what happened to this specific session" is a real, distinct job from fleet-wide monitoring — a search/lookup tool, not a dashboard.                                                                                                                                                     |
| Tarifas        | Unchanged                                                       | Pricing configuration is administrative, touched occasionally, not daily.                                                                                                                                                                                                                        |
| Configuración  | Unchanged                                                       | Org/brand/locale settings — administrative by definition.                                                                                                                                                                                                                                        |
| **Estaciones** | **Removed as a standalone nav item**                            | Station-level detail is now reached by drilling into Network Map or Operations Center, in context — a bare CRUD list of stations with no health or case context attached is the exact "dashboard, not command center" pattern this work order rejects.                                           |
| **Cargadores** | **Removed**                                                     | The near-duplicate of Estaciones named above — retired outright, not merged, since CAP-002 already retired "Charger" as a concept everywhere except commercial/UI terminology.                                                                                                                   |
| **Conectores** | **Removed as a standalone nav item**                            | Connector-level detail is reached via station drill-down on the Network Map, in context — same reasoning as Estaciones.                                                                                                                                                                          |
| **Usuarios**   | **Removed as a standalone nav item, folded into Configuración** | Operator directory management is administrative and infrequent enough not to need its own top-level slot.                                                                                                                                                                                        |
| **Alertas**    | **Removed, fully superseded by Centro de operaciones**          | Alertas was demo-only placeholder data (`docs/product/MOVOS.md`'s own "Known constraints"); Operations Center is its real, working replacement — keeping both would mean two different "what needs attention" screens telling potentially different stories.                                     |
| **Reportes**   | **Removed as a standalone nav item for this MVP**               | Still "Próximamente" per the product's own existing state — this design does not invent report content to fill it; when report generation is real, it likely belongs as an export action from Business Overview rather than its own nav destination, but that's a future decision, not this one. |

**Net effect:** eleven flat items become four primary + four secondary — a smaller, not larger, navigation surface, even after adding the entirely new Negocio screen.

## The content-area header — new, and minimal

Today, `OperatorLive` and other pages render their own inline heading with no persistent chrome above it. This design introduces one small, consistent element across all four primary screens: a slim header bar carrying the **screen title** and a **data-freshness indicator** ("Actualizado hace 12 s," reflecting the real 30-second poll interval `use-polled-resource.ts` already uses). It does not duplicate org/user identity — that stays exactly where it already lives, anchored in the sidebar, avoiding the redundancy of showing the same identity twice on screen.

## The drill-down pattern

Both Network Map (site → station → connector) and Operations Center (case list → case detail) use the same interaction: a **right-side drawer**, not a navigation to a new route. This is a deliberate, repeated choice, not independently invented per screen: opening a drawer keeps the operator's place on the underlying screen (the map stays visible, the case columns stay visible), which matters specifically for the morning health-check flow ([KYLUM_CONSOLE_USER_FLOWS.md](./KYLUM_CONSOLE_USER_FLOWS.md) Flow A) — a full navigation away and back would break the "scan, then act" rhythm the whole console is designed around.

## Cross-screen links

The four primary screens are not isolated — [KYLUM_CONSOLE_USER_FLOWS.md](./KYLUM_CONSOLE_USER_FLOWS.md) defines exactly two real hand-offs, and navigation should support only those two, not a dense web of cross-links invented for their own sake:

- **Network Map → Operations Center**, when a station drill-down reveals an already-open case (Flow C).
- **Business Overview → Network Map**, when a top/bottom-performing station is clicked (Flow D).

No other screen-to-screen link is proposed. A console with every screen linking to every other screen is a maze, not a command center — the mission's "calm under pressure" principle applies to the navigation graph itself, not just visual styling.

## What this means for `MovosSidebar`

This document proposes reordering and trimming `navigation` in `apps/movos-web/src/components/layout/movos-sidebar.tsx` from eleven flat items to the four-plus-four structure above, and adding a visual divider between the two groups. No new component architecture is required — `MovosSidebar` already supports an ordered list of `{ label, href, icon }` items; this is a content and grouping change, not a rebuild. Consistent with this work order's restrictions, that change is described here, not made.
