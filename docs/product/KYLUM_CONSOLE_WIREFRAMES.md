# Kylum Console — Wireframes

**Work order:** WO-ARGOS-030 (Kylum Console Foundation)
**Status:** PRODUCT DESIGN. No code, API, migration, or `schema.prisma` change. Text wireframes only — no visual mockup tool was used; layout intent is expressed structurally, detailed enough to build against.
**Mission:** the literal screen layout for each of the four screens in [KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md), reusing the real shell (`MovosSidebar`, 256px fixed left rail) already in production.

## Shared shell, every screen

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  [Screen title]                    [org name ▾] [user ▾] │
│  Kylum       │──────────────────────────────────────────────────────────│
│  (org name)  │                                                          │
│              │                                                          │
│  ▸ Centro de │                                                          │
│    mando     │                    [ screen content ]                   │
│  ▸ Mapa de   │                                                          │
│    red       │                                                          │
│  ▸ Centro de │                                                          │
│    operac.   │                                                          │
│  ▸ Negocio   │                                                          │
│  ────────    │                                                          │
│  Sitios      │                                                          │
│  Sesiones    │                                                          │
│  Tarifas     │                                                          │
│  Config.     │                                                          │
│              │                                                          │
│  [user]  ⏻   │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

The left rail is the existing `MovosSidebar` component, reorganized per [KYLUM_CONSOLE_NAVIGATION.md](./KYLUM_CONSOLE_NAVIGATION.md) — this document only specifies the content area to its right.

## Screen 1 — Command Center

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│    ●  RED SALUDABLE                                                      │
│       Todas las estaciones operando con normalidad.                      │
│                                                                            │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                            │
│   ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ │
│   │ ESTACIONES     │ │ SESIONES      │ │ ENERGÍA HOY   │ │ ACCIONES     │ │
│   │ EN LÍNEA       │ │ ACTIVAS       │ │               │ │ ABIERTAS     │ │
│   │                │ │               │ │               │ │              │ │
│   │   42 / 45      │ │      18       │ │   612 kWh     │ │      3       │ │
│   └───────────────┘ └───────────────┘ └───────────────┘ └──────────────┘ │
│                                                                            │
│   ┌───────────────┐ ┌──────────────────────────────────────────────────┐ │
│   │ INGRESOS       │ │ TÉCNICOS EN RUTA                                 │ │
│   │ ESTIMADOS      │ │                                                   │ │
│   │                │ │  No disponible — requiere módulo de despacho     │ │
│   │ No disponible  │ │  (no construido).                                │ │
│   │ (no construido)│ │                                                   │ │
│   └───────────────┘ └──────────────────────────────────────────────────┘ │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**

- The health verdict (`●  RED SALUDABLE`) is the single largest element on the screen — a colored status dot plus one short sentence, nothing more. Its color is the only saturated color allowed to dominate the screen (see [KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md)).
- The four real-data tiles (Estaciones, Sesiones, Energía, Acciones) sit in one row, equal size, equal weight — no tile is visually more important than another.
- The two not-yet-real tiles (Ingresos, Técnicos) are visually present — Objective 1's mission explicitly asked for them — but rendered in a muted, clearly-disabled state with an honest inline label, never a fabricated number. This is a deliberate design decision, not an oversight: it tells ARGOS and any future viewer exactly what's real without silently omitting what was asked for.

## Screen 2 — Network Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [Todos los sitios ▾]                              ● Saludable ● Degradado│
│                                                       ● Sin conexión ● N/D │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │                                                                    │    │
│  │                                                                    │    │
│  │                       ●  ●     ●                                  │    │
│  │                  ●         ●                                      │    │
│  │            ●                        ●                             │    │
│  │                                                                    │    │
│  │                     ●  ← selected, drawer opens right             │    │
│  │                                                                    │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**On selecting a site pin, a drawer slides in from the right** (does not navigate away — the map stays visible underneath):

```
                                                          ┌─────────────────┐
                                                          │ Sitio Norte      │✕│
                                                          │ 6 estaciones     │
                                                          │──────────────────│
                                                          │ ● Estación A1    │
                                                          │   Saludable      │
                                                          │ ● Estación A2    │
                                                          │   2/4 conectores │
                                                          │   en falla       │
                                                          │ ● Estación A3    │
                                                          │   Sin conexión   │
                                                          │ ...              │
                                                          │──────────────────│
                                                          │ [Ver en Centro   │
                                                          │  de operaciones] │
                                                          └─────────────────┘
```

**Layout notes:**

- The map fills the entire content area — no summary tiles compete with it (see [KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md)'s explicit warning against this).
- The legend is the only fixed overlay, top-right, small.
- Drilling into a station with an open Action surfaces a direct link into Operations Center (Flow C → Flow B handoff, [KYLUM_CONSOLE_USER_FLOWS.md](./KYLUM_CONSOLE_USER_FLOWS.md)) rather than duplicating the case-detail UI inside the map screen.

## Screen 3 — Operations Center

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PENDIENTES (2)          ASIGNADAS (1)           RESUELTAS (4)           │
│  ──────────────────      ──────────────────      ──────────────────     │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐     │
│  │ ⬤ Alta          │      │ ⬤ Media         │      │ ⬤ Alta          │     │
│  │ Pico de fallos  │      │ Conector        │      │ Anomalía de     │     │
│  │ de autent.      │      │ inactivo        │      │ energía         │     │
│  │ Estación B3     │      │ Estación C1     │      │ Estación A2     │     │
│  │                 │      │ Asignada a:     │      │ "Se reinició    │     │
│  │ [Ver caso]      │      │  Ana R.         │      │  el firmware"   │     │
│  └────────────────┘      │ [Ver caso]      │      │ [Ver caso]      │     │
│                           └────────────────┘      └────────────────┘     │
│  ┌────────────────┐                                ┌────────────────┐     │
│  │ ⬤ Media         │                                │ ⬤ Media         │     │
│  │ Bajo rendim.    │                                │ Conector        │     │
│  │ Estación D4     │                                │ inactivo        │     │
│  │ [Ver caso]      │                                │ [Ver caso]      │     │
│  └────────────────┘                                └────────────────┘     │
└──────────────────────────────────────────────────────────────────────────┘
```

**On "Ver caso," a detail panel opens** (drawer, same pattern as the map's site drawer — consistency across screens is deliberate):

```
                                          ┌───────────────────────────────┐
                                          │ Pico de fallos de autent.   ✕ │
                                          │ Estación B3 · Alta            │
                                          │────────────────────────────────│
                                          │ Explicación:                   │
                                          │ Estación B3 rechazó 72% de     │
                                          │ los intentos de autorización   │
                                          │ en los últimos 7 días.         │
                                          │                                 │
                                          │ Evidencia:                     │
                                          │ · Intentos totales: 40         │
                                          │ · Rechazados: 29                │
                                          │                                 │
                                          │ Acción sugerida:                │
                                          │ Revisar el lector RFID.         │
                                          │────────────────────────────────│
                                          │ [Reconocer] [Asignarme]         │
                                          │ [Posponer]  [Resolver]          │
                                          │             [Descartar]         │
                                          └───────────────────────────────┘
```

**Layout notes:**

- Three columns, fixed order (Pendientes → Asignadas → Resueltas) — this mirrors `OperationalActionsSection`'s existing grouping exactly, just given a full screen instead of a cramped bottom-of-dashboard section.
- The case detail panel exposes the full evidence and the complete real transition set (`ActionButtons`'s five real actions), not a truncated summary — this is the one screen where the operator is expected to spend real time, not just scan.

## Screen 4 — Business Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Período: [Últimos 30 días ▾]                                            │
│                                                                            │
│   ┌────────────────────────────┐  ┌────────────────────────────┐        │
│   │ SESIONES (tendencia)        │  │ ENERGÍA VENDIDA (tendencia) │        │
│   │                              │  │                              │        │
│   │   ╱╲    ╱╲___╱╲             │  │        ___╱‾‾╲___            │        │
│   │  ╱  ╲__╱      ╲___          │  │   ___╱‾            ╲__       │        │
│   │                              │  │                              │        │
│   └────────────────────────────┘  └────────────────────────────┘        │
│                                                                            │
│   ┌────────────────────────────┐  ┌────────────────────────────┐        │
│   │ INGRESOS                    │  │ UTILIZACIÓN                 │        │
│   │                              │  │                              │        │
│   │ No disponible — requiere     │  │ No disponible — requiere     │        │
│   │ módulo de facturación        │  │ historial de ocupación       │        │
│   │ (no construido)              │  │ (no construido)              │        │
│   └────────────────────────────┘  └────────────────────────────┘        │
│                                                                            │
│  ESTACIONES DE MEJOR DESEMPEÑO                                            │
│  ──────────────────────────────                                          │
│  1. Estación A1 — 1,240 kWh este mes                                     │
│  2. Estación C3 —   980 kWh este mes                                     │
│  3. Estación B2 —   870 kWh este mes                                     │
│                                                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**

- This is the only screen with charts at all — two real trend lines, both simple, no dual-axis or stacked-series complexity.
- Revenue and Utilization are shown in the same honest, muted, explicitly-labeled disabled state as Command Center's not-yet-real tiles — consistent treatment of the same underlying gap across screens.
- The top-performing list is plain text, ranked, not another chart — a ranked list is the right density for this data, a bar chart would not add clarity ([KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md)'s "avoid excessive charts" principle applied concretely).

## Cross-screen consistency

Two structural patterns repeat across all four screens on purpose: a **slide-in drawer from the right** for any drill-down (site detail on the map, case detail in Operations Center) rather than a full navigation away from the current screen, and a consistent **status-color vocabulary** (the same four-state health palette on Command Center's verdict, the Map's legend, and Operations Center's severity badges) — see [KYLUM_CONSOLE_DESIGN_PRINCIPLES.md](./KYLUM_CONSOLE_DESIGN_PRINCIPLES.md) for the exact palette.
