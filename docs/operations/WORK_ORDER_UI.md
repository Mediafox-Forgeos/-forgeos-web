# Work Order UI

**Work order:** WO-ARGOS-033 (Operational Work Orders)
**Status:** SCREEN DESIGN. No code, API, migration, or new component was created. The mission's deliverables list names `/work-orders` and `/work-orders/[id]` as routes to build only "if implementation is required" — this document designs them fully, in the same wireframe discipline as [KYLUM_CONSOLE_WIREFRAMES.md](../product/KYLUM_CONSOLE_WIREFRAMES.md), without concluding that implementation is required in this pass. See [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)'s closing section for why.
**Mission:** the two screens that let an operator answer "what problems are currently being solved" and "what exactly is happening with this problem."

## Where this fits in the existing console

[KYLUM_CONSOLE_NAVIGATION.md](../product/KYLUM_CONSOLE_NAVIGATION.md) deliberately capped primary navigation at four items, reasoning explicitly that a fifth item without a fifth real operator question to answer would repeat the "accretion, not architecture" problem the whole console redesign existed to fix. `WorkOrder` doesn't invalidate that reasoning — it extends **Operations**, the screen already built around "what needs attention today," rather than competing with it. This document proposes `/work-orders` as a **secondary** nav destination for now (alongside Estaciones, Sesiones, Equipo, Configuración), reached primarily _through_ Operations rather than as a cold-start destination — matching how a `WorkOrder` is conceptually downstream of an `Action`, not a parallel, unrelated concept an operator would think to check independently first.

## Screen 1 — `/work-orders`

**Question answered:** "What problems are currently being solved?"

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Órdenes de trabajo                                                       │
│  Qué problemas se están resolviendo ahora mismo.                          │
│                                                                            │
│  [ Abiertas ]  [ Asignadas ]  [ Vencidas ]  [ Resueltas ]   [+ Nueva OT]  │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  TÍTULO              ESTACIÓN         PRIORIDAD  ESTADO    TÉCNICO   SLA  ANTIG. ORIGEN │
│  ────────────────────────────────────────────────────────────────────────────────────── │
│  Estación sin        Bogotá Centro 03  Alta      Abierta   —         —    12 min  Pérdida│
│  conexión                                                                          conect.│
│                                                                                            │
│  Conector inactivo   Bogotá Centro 01  Alta      Asignada  Ana R.    1h 40m 22h  Recomend.│
│  tras finalizar                                             restante                      │
│                                                                                            │
│  Mantenimiento       Medellín El       Media     En        Carlos M. Vencido  3d  Manteni-│
│  preventivo          Poblado 01                  progreso           (2h)          miento  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Columns

| Column     | Source                                  | Notes                                                                                                                                                                                                                   |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Título     | `WorkOrder.title`                       |                                                                                                                                                                                                                         |
| Estación   | `WorkOrder.station.name` (joined)       | Links through to the Network drawer for that station                                                                                                                                                                    |
| Prioridad  | `WorkOrder.priority`                    | Same four-tone badge treatment as `Action.severity`, extended for `CRITICAL` and `LOW`                                                                                                                                  |
| Estado     | `WorkOrder.status`                      | See [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md) for the six values                                                                                                                                                   |
| Técnico    | `WorkOrder.technician.fullName`, or "—" | "—" is a real, common state — most rows start unassigned                                                                                                                                                                |
| SLA        | Computed from `dueAt` vs. now           | "X restante" while on track, "Vencido (Xh)" once breached — this is the same computed fact Rule 3 ([WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md)) flags, shown here as the reason, not a duplicate mechanism |
| Antigüedad | `now() - createdAt`                     | Distinct from the SLA column — a `WorkOrder` can be old but not yet overdue (a `LOW`-priority order with a 3-day SLA), and this table shows both facts rather than collapsing them                                      |
| Origen     | `WorkOrder.source`                      | The one column with no equivalent anywhere else in the console — see below                                                                                                                                              |

### Filters

Exactly the four named in the mission, each a real, precise query against real fields, not a vague label:

- **Abiertas** — `status = OPEN`
- **Asignadas** — `status IN (ASSIGNED, IN_PROGRESS, BLOCKED)`
- **Vencidas** — `dueAt < now() AND status NOT IN (RESOLVED, CANCELLED)` — the same condition [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) Rule 3 defines
- **Resueltas** — `status IN (RESOLVED, CANCELLED)`

### Why the "Origen" column matters more than it looks

This is the one place in the entire console where an operator can see, at a glance, _how_ a problem entered the system — a connectivity-loss automation, a recommendation, a manual entry, scheduled maintenance, or a customer report. Today, every case in Operations has exactly one origin (a live recommendation) because that's the only path `Action.create()` supports. `/work-orders` is the first screen in MOVOS where that's no longer true, and making the origin visible, not just the current state, is what lets an operator (or, later, [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)-style analysis) eventually ask "which origin produces the most reliable resolutions" — the same kind of question already asked of `RecommendationType`, now extended to a second, richer source dimension.

## Screen 2 — `/work-orders/[id]`

**Question answered:** "What exactly is happening with this problem?"

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ← Volver                                                                 │
│  Estación sin conexión                                    [Alta] [Abierta]│
│  Estación Bogotá Centro 03 · Origen: Pérdida de conectividad             │
│  ──────────────────────────────────────────────────────────────────────  │
│                                                                            │
│  ┌─ Resumen del incidente ─────────┐  ┌─ Estación ──────────────────┐    │
│  │ Sin conexión desde las 07:48.   │  │ Bogotá Centro 03             │    │
│  │ Sin órdenes de trabajo previas  │  │ Kempower · Satellite 200     │    │
│  │ para esta estación en los       │  │ Conectividad: Desconectado   │    │
│  │ últimos 30 días.                │  │ [Ver en Red →]                │    │
│  └──────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                            │
│  ┌─ Técnico asignado ──────────────┐  ┌─ Acciones ───────────────────┐    │
│  │ Sin asignar                      │  │ [Asignar técnico]            │    │
│  │ [Asignar técnico →]              │  │ [Cancelar]                   │    │
│  └───────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                            │
│  ── Línea de tiempo ──────────────────────────────────────────────────── │
│  07:48  Creada automáticamente — pérdida de conectividad > 15 min         │
│                                                                            │
│  ── Notas ────────────────────────────────────────────────────────────── │
│  (sin notas todavía)                                                      │
│                                                                            │
│  ── Evidencia ────────────────────────────────────────────────────────── │
│  · Última conexión: 2026-08-09 07:48:03                                  │
│  · Estado de conectividad: OFFLINE                                       │
│                                                                            │
│  ── Historial de estado ──────────────────────────────────────────────── │
│  Abierta — desde las 07:48 (hace 12 min)                                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### Section-by-section mapping to real (proposed) data

| Section               | Source                                                                                                                                                                                                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumen del incidente | `WorkOrder.description`, plus a real query for other `WorkOrder`s at the same station in a trailing window — the same "chronic station" framing [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) already designed, applied here for the first time against real per-case data instead of a rollup |
| Estación              | `WorkOrder.station` (joined `ChargingStation` fields), linking directly into the real `/network` drawer — reusing that component rather than rebuilding station detail a second time                                                                                                                             |
| Técnico asignado      | `WorkOrder.technician` (joined `Technician` fields — name, phone, zone, availability)                                                                                                                                                                                                                            |
| Acciones              | The real transitions from [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md), only the ones valid from the current status — exactly the same "only show what the state machine actually allows" discipline `ActionButtons` already follows                                                                           |
| Línea de tiempo       | `WorkOrderEvent[]`, ordered by `occurredAt` — the history log [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md) added specifically so this section could exist honestly                                                                                                                                             |
| Notas                 | `WorkOrder.notes` (current value) plus every `WorkOrderEvent{type: NOTE_ADDED}` in the timeline — the current field for "what's true right now," the timeline for "how we got here," matching [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)'s reasoning for keeping both                                        |
| Evidencia             | `WorkOrder.evidence` (JSON) — for an automated `WorkOrder`, this is exactly the structured fact that triggered creation (e.g., the connectivity timestamp), the same evidence-first discipline `Action.evidence` already established                                                                             |
| Historial de estado   | Derived from `WorkOrderEvent{type: STATUS_CHANGED}` rows — how long the order spent in each state, not just its current one                                                                                                                                                                                      |

### Why the drawer pattern from the rest of the console doesn't apply here

[KYLUM_CONSOLE_NAVIGATION.md](../product/KYLUM_CONSOLE_NAVIGATION.md) established a right-side drawer for every drill-down elsewhere in the console, specifically so the operator "never leaves the current screen." A `WorkOrder` detail is different in kind, not just degree: it has enough real content (timeline, notes, evidence, status history, plus two joined entities) that a drawer would either be cramped or would have to grow to the point of being a full screen wearing a drawer's chrome. A dedicated route also gives a `WorkOrder` something a drawer state cannot: a real, shareable, bookmarkable URL — useful the moment a technician's phone call references "the ticket," and an operator wants to pull up that exact record again later, or reference it in an external conversation. This is a deliberate exception to an established pattern, named and justified rather than silently inconsistent with it.

## Integration points with the existing console

- **From Operations:** a resolved-but-needs-a-truck-roll `Action` gets a "Crear orden de trabajo" action, pre-filling `stationId`, `source: RECOMMENDATION`, and `incidentId` from the originating `Action` — the concrete mechanism by which `Action` and `WorkOrder` connect in practice, not just in the domain model.
- **From Network:** a station's detail drawer gains a "Ver órdenes de trabajo" link, scoped to that `stationId` — directly closing the exact moment [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md) found the operator stuck (an offline station with nowhere to record or track the response).
- **From Command Center:** out of scope for this document, deliberately — [WIDGET_VALUE_ANALYSIS.md](../product/WIDGET_VALUE_ANALYSIS.md) already found Command Center accumulating duplicate previews of other screens' content; adding a seventh card here without evidence an operator needs it at that exact glance would repeat that pattern rather than learn from it. If work-order volume grows enough to justify a Command Center presence, that should be a deliberate, evidenced decision later, not an assumption made now.

## What remains undesigned, honestly

This document does not specify a technician-facing view (per [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)'s scope boundary, technicians have no product access in this version), a map view of open work orders (a plausible future addition to `/work-orders`, not designed here), or bulk-assignment tooling for an operator managing many open orders at once (relevant once volume exceeds what a single list view comfortably supports). All three are reasonable future extensions once a first version is real, not gaps in this design pass.
