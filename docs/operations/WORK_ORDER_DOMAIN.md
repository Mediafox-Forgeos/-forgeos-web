# Work Order Domain

**Work order:** WO-ARGOS-033 (Operational Work Orders)
**Status:** DOMAIN DESIGN. No code, API, migration, or `schema.prisma` change. Every field below is a proposal, written in Prisma-like notation for precision, not a diff against the real schema. See the note at the end of this document on why implementation was not attempted this round.
**Mission:** the `WorkOrder` entity — the object that finally lets MOVOS coordinate a person around a problem, not just detect and record the problem.

## Where this sits relative to what already exists

The mission's target flow — `Asset → Problem → Incident → Work Order → Technician → Resolution → Learning` — is not a replacement for what CAP-004/CAP-005/WO-ARGOS-025/WO-ARGOS-026 already built. It's the missing back half of it. Mapped onto real entities:

```
ChargingStation/Connector  →  (a fault, or connectivity loss)  →  RecommendationService  →  Action  →  ???
        Asset                          Problem                      "Incident" (informal)   Incident   Work Order → Technician → Resolution → Learning
```

`Action` (WO-ARGOS-026) already plays the informal role of "Incident" in this flow — it's the one real, persisted record of "an operator is aware of and tracking this." What `Action` cannot do, by design, is coordinate a physical response: it has no technician concept, no SLA target, no way to represent "someone needs to drive to this station," and — per [OPERATOR_EXECUTION_LAYER_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md)'s own limitation — assignment is scoped to self-assign only. `WorkOrder` is a new, separate entity for exactly that missing half — not a rebuild of `Action`, not a merge into it.

## The naming tension, named honestly

The mission's flow diagram and the `WorkOrder.incidentId` field both use the word **Incident** — but MOVOS has no `Incident` entity. The full `Alert`/`Incident`/`MaintenanceTicket` architecture ([CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)) has been evaluated and deliberately deferred four times now (WO-022, WO-025, WO-026, and implicitly again here, since this work order does not ask for it either). Building `WorkOrder.incidentId` as a foreign key to a table that doesn't exist would be dishonest schema design. This document resolves the tension the same way earlier work resolved a similar one for `Action.recommendationType`: **`incidentId` is defined as an optional reference, and until a real `Incident` entity exists, its real-world referent is `Action.id`.** A `WorkOrder` created from an operator's existing case points at that `Action`; a `WorkOrder` created with no upstream case (source `MANUAL`, `MAINTENANCE`, or `CUSTOMER_REPORT` — see below) leaves it null. If `Incident` is ever built as its own entity, this field's target would migrate to it; nothing about `WorkOrder`'s own design depends on that happening first.

## The `WorkOrder` entity

```prisma
enum WorkOrderStatus {
  OPEN
  ASSIGNED
  IN_PROGRESS
  BLOCKED
  RESOLVED
  CANCELLED
}

enum WorkOrderPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum WorkOrderSource {
  CONNECTIVITY_LOSS
  RECOMMENDATION
  MANUAL
  MAINTENANCE
  CUSTOMER_REPORT
}

model WorkOrder {
  id          String @id @default(cuid())
  title       String
  description String

  status   WorkOrderStatus   @default(OPEN)
  priority WorkOrderPriority
  source   WorkOrderSource

  stationId   String
  connectorId String?
  // See "the naming tension, named honestly" above — points at Action.id
  // today, not a real Incident entity.
  incidentId  String?

  assignedTechnicianId String?
  assignedAt           DateTime?

  dueAt      DateTime?
  resolvedAt DateTime?
  slaMinutes Int?

  notes    String?
  evidence Json?

  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  station     ChargingStation @relation(fields: [stationId], references: [id])
  connector   Connector?      @relation(fields: [connectorId], references: [id])
  technician  Technician?     @relation(fields: [assignedTechnicianId], references: [id])
  creator     User            @relation(fields: [createdBy], references: [id])
  events      WorkOrderEvent[]

  @@index([organizationId, status])
  @@index([stationId])
}
```

**A field this document adds beyond the mission's literal list, and why:** `organizationId` is required on every real business entity in this schema (the whole multi-tenant isolation model — [VERTICAL_BOUNDARIES.md](../forgeos/VERTICAL_BOUNDARIES.md) already found `Organization`/`Membership` to be the cleanest, most consistently-applied boundary in the codebase). A `WorkOrder` without it would be the first tenant-scoped entity in MOVOS without direct tenant scoping, an inconsistency, not a simplification. It's omitted from the mission's literal field list but included here as a correction, the same way earlier work corrected `RecommendationSeverity`'s casing rather than compounding an inconsistency.

## Field-by-field notes

- **`title`/`description`** — human-authored (or, for automated sources, template-generated — see [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md)) summary of the problem. Distinct from `Action.explanation`, which is a snapshot of a recommendation's computed reasoning — a `WorkOrder`'s description is written for a technician to act on, not for an operator to evaluate a detector's evidence.
- **`status`** — see [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md) for the full state machine.
- **`priority`** — four levels, not `Action`'s two (`HIGH`/`MEDIUM`). `CRITICAL` has no equivalent in `RecommendationSeverity` today — see [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) Rule 2 for the open question this creates.
- **`source`** — maps directly onto real gaps [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) already catalogued: `CONNECTIVITY_LOSS` closes the exact gap [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md) found ("a station going offline never becomes a tracked case"); `RECOMMENDATION` is the existing `RecommendationService`→`Action` path, now able to spawn a `WorkOrder` when physical dispatch is needed; `MANUAL` is a genuinely new capability — today an operator cannot open a case without a live, matching recommendation ([action.service.ts](../../apps/movos-api/src/recommendations/action.service.ts)'s `create()` requires one); `MAINTENANCE` and `CUSTOMER_REPORT` map directly to [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gaps #3 and #4.
- **`stationId`/`connectorId`** — real foreign keys to `ChargingStation`/`Connector` (CAP-002), `connectorId` optional because not every problem is connector-scoped (a fully offline station has no single faulted connector to point at).
- **`assignedTechnicianId`/`assignedAt`** — see [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md). `assignedAt` is distinct from `createdAt` specifically so time-to-assignment is measurable on its own, not conflated with time-to-resolution.
- **`dueAt`/`slaMinutes`** — `slaMinutes` is the target (e.g., 120 for a `CRITICAL` priority); `dueAt` is `assignedAt + slaMinutes` once assigned, null before assignment — an unassigned `WorkOrder` has no SLA clock running yet, a deliberate choice, not an oversight (see [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) Rule 2 for why an unassigned `CRITICAL` order is itself the more urgent problem).
- **`notes`/`evidence`** — a single current-value field each, mirroring `Action`'s own shape. **This repeats a known limitation on purpose, addressed structurally instead:** [LEARNING_SIGNALS.md](../product/LEARNING_SIGNALS.md) signal 5 already found that `Action.notes` being a single overwritten field loses history. Rather than repeat that loss silently, `WorkOrder` gets a real companion history entity — see below — so the _current_ `notes` field stays simple while the full history is never lost.
- **`createdBy`** — the real `User` (operator) who opened it, whether directly (`MANUAL`) or as the human trigger of an otherwise-automated source.

## The companion entity the UI requirements actually require: `WorkOrderEvent`

[WORK_ORDER_UI.md](./WORK_ORDER_UI.md)'s detail screen asks for a **timeline** and a **status history**, distinct from the current `notes` field. Neither is possible from the `WorkOrder` fields the mission specified alone — they're both current-value fields, per [LEARNING_SIGNALS.md](../product/LEARNING_SIGNALS.md)'s already-documented gap. This document adds one companion entity, not requested explicitly but required to honestly satisfy what was explicitly requested elsewhere in the same work order:

```prisma
enum WorkOrderEventType {
  CREATED
  ASSIGNED
  STATUS_CHANGED
  NOTE_ADDED
  EVIDENCE_ADDED
  SLA_BREACHED
}

model WorkOrderEvent {
  id          String             @id @default(cuid())
  workOrderId String
  type        WorkOrderEventType

  fromStatus WorkOrderStatus?
  toStatus   WorkOrderStatus?
  note       String?

  actorUserId String?
  occurredAt  DateTime @default(now())

  workOrder WorkOrder @relation(fields: [workOrderId], references: [id])
  actor     User?     @relation(fields: [actorUserId], references: [id])

  @@index([workOrderId, occurredAt])
}
```

Append-only, one row per real change — the same **Event** primitive [UNIVERSAL_PRIMITIVES.md](../forgeos/UNIVERSAL_PRIMITIVES.md) already named as MOVOS's clearest existing gap ("solved independently four times... never unified under one shared shape"). This is a fifth independent instance of that same primitive, which is worth ARGOS weighing directly: building `WorkOrderEvent` as its own bespoke table continues that pattern one more time; building it against a shared `Event` shape (if that extraction is ever authorized — see [FORGEOS_POSITIONING.md](../forgeos/FORGEOS_POSITIONING.md)) would not. This document specifies it as its own table because no shared primitive exists to build against yet, not because that's the ideal end state.

## Why this document doesn't include a migration

The mission's own deliverables list is five documents; the two frontend routes are explicitly conditional ("if implementation is required"); and the automation rules section is explicit that rules are to be **defined, not implemented**. Read together, and matched against this engagement's own established two-step pattern — WO-ARGOS-030 designed the Kylum Console before WO-ARGOS-031 built it — this work order reads as the design counterpart to a future implementation work order, not a request to migrate the database in the same pass. A `WorkOrder`/`Technician`/`WorkOrderEvent` migration is real, meaningful schema surface — three new tables, several new enums, foreign keys into `ChargingStation`, `Connector`, and `User` — exactly the kind of change this engagement has consistently gated on an explicit, separate authorization rather than bundling into a design sprint. If ARGOS intends this domain to be implemented now rather than designed now and built next, that should be a clear, explicit instruction — the same way WO-ARGOS-031 explicitly authorized building what WO-ARGOS-030 designed.
