# Technician Model

**Work order:** WO-ARGOS-033 (Operational Work Orders)
**Status:** DOMAIN DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** the minimum `Technician` entity — deliberately minimum, per the mission's own framing, not a full field-services platform.

## The scope decision this document has to make explicit

The mission's field list for `Technician` — `fullName`, `phone`, `email`, `city`, `zone`, `active`, `shift`, `skills`, `availability` — contains no `userId`, no `passwordHash`, nothing tying a technician to an authenticated MOVOS session. That's not an omission this document is filling in; it's the correct reading of "minimum." **A `Technician` in this design is a directory record, not a login-capable actor.** Technicians do not open MOVOS, do not see a `WorkOrder`, and do not change its status themselves in this version. Every status transition on a `WorkOrder` assigned to a technician is still performed by an authenticated `User` (the operator), on the technician's behalf — exactly the workflow [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md) already found actually happening today (a phone call, then a manually-typed note), now given structured fields to land in instead of free text.

This is a deliberate, not an accidental, scope boundary. A technician-facing mobile app or portal is a real, plausible future capability — but it's a different kind of build (a second authenticated surface, a second set of permissions, likely a second application entirely) from what "minimum technician model" asks for here, and nothing in this work order's mission or constraints calls for it. Naming the boundary explicitly here means a future work order can extend `Technician` into a real actor without this document having quietly assumed it already was one.

## The entity

```prisma
enum TechnicianShift {
  MORNING
  AFTERNOON
  NIGHT
  ROTATING
}

model Technician {
  id       String  @id @default(cuid())
  fullName String
  phone    String
  email    String?

  city String
  zone String?

  active Boolean @default(true)
  shift  TechnicianShift?

  // Free-form today, deliberately not an enum — see "Why skills is a string
  // array, not a taxonomy" below.
  skills String[]

  // See "Why availability is a status, not a calendar" below.
  availability TechnicianAvailability @default(AVAILABLE)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id])
  workOrders     WorkOrder[]

  @@index([organizationId, active])
  @@index([organizationId, zone])
}

enum TechnicianAvailability {
  AVAILABLE
  ON_JOB
  OFF_SHIFT
  UNAVAILABLE
}
```

**`organizationId` added for the same reason as `WorkOrder`** ([WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)) — every real business entity in this schema is tenant-scoped, and a technician directory is an organization's own roster, never shared across tenants (a white-label operator's field staff are exactly the kind of data [MOVOS.md](../product/MOVOS.md)'s white-label boundary exists to keep separate).

## Field-by-field notes

- **`fullName`/`phone`/`email`** — the minimum contact information needed for an operator to actually reach someone, which is the entire point named in [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #1 ("no technician contact list... the operator picks up a phone... and relays it manually"). `phone` required, `email` optional — matches how dispatch actually happens today per [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) (a call or a message, not email).
- **`city`/`zone`** — the geographic-matching fields the mission asked for. `zone` is a free-form string, not a foreign key to `Site`, deliberately: a technician's coverage area is usually broader or differently-shaped than MOVOS's own site boundaries (a technician might cover "north Bogotá," not a specific enumerated list of sites), and forcing it into `Site` references would overfit the model to today's fleet size.
- **`active`** — a simple roster toggle (still employed/contracted, distinct from `availability`'s moment-to-moment state below).
- **`shift`** — an enum with four values, including `ROTATING` for anyone not on a fixed pattern. This is the field [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #5 (shift management) partially addresses — partially, because knowing _when_ someone's shift is supposed to be is not the same as a real on-call rotation with handoff and escalation, which remains a named, separate gap.

### Why `skills` is a string array, not a taxonomy

A fixed enum of skills (`ELECTRICAL`, `NETWORKING`, `MECHANICAL`, ...) would require deciding a complete, correct taxonomy before a single technician record could be created — exactly the kind of premature structure this engagement has consistently avoided (see, for a direct parallel, `AuthorizationCredential.metadata`'s deliberate `Json` looseness for reasons never fully enumerable up front). A string array lets an organization describe their own technicians in their own words from day one; a controlled taxonomy is a reasonable future migration once real data shows what vocabulary operators actually use, not a guess made now.

### Why `availability` is a status, not a calendar

A real scheduling calendar (specific busy/free time blocks) is a materially bigger feature than "minimum technician model" asks for, and duplicates work a real calendar/dispatch product would do better. `availability` as a simple four-state enum answers the one question the Work Order flow actually needs answered at assignment time — "can I hand this to them right now" — without pretending to be a scheduling system. `ON_JOB` is set (by the operator, not automatically) when a technician is actively working a `WorkOrder`; nothing enforces that only one `WorkOrder` can be `IN_PROGRESS` per technician at a time in this version, which is an honest, named limitation, not an oversight — see [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md).

## What this model deliberately does not do

- **No login, no permissions, no `User`/`Membership` relationship.** Stated above; repeated here because it's the single most consequential scope boundary in this document.
- **No historical assignment log on the `Technician` record itself.** "Which work orders has this person handled" is answerable by querying `WorkOrder.assignedTechnicianId`, not by a redundant list maintained on `Technician` — the same avoid-denormalization discipline the rest of this schema follows.
- **No performance/rating field.** A `Technician`'s real track record (resolution time, recurrence rate of their closed work orders) is exactly the kind of metric [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) already designed for `Action` — extending that discipline to `WorkOrder`/`Technician` is a natural future step, not something to bolt onto the directory record itself as a mutable "rating" number.

## Relationship to `WorkOrder`

One `Technician` can be `assignedTechnicianId` on many `WorkOrder` rows, over time — a plain one-to-many, no join table needed since a `WorkOrder` has exactly one assigned technician at a time (reassignment overwrites the field, logged via `WorkOrderEvent` — see [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md) and [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)).
