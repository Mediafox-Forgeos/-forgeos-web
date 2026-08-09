# Work Order Checklists

**Work order:** WO-ARGOS-036 (Field Technician Console)
**Status:** DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** the checklist model a technician works through on `/my-work/[id]` — arrival confirmation, diagnosis, intervention, validation, closure — answering "what evidence must I provide?" honestly, including where the honest answer is "not yet possible."

## The design principle: no new table

`WorkOrderEvent.payload` (WO-ARGOS-035) is already a loosely-typed `Json` field, deliberately — the same reasoning `AuthorizationCredential.metadata` already established for this schema, extended once for exactly this kind of future need. This document proposes the checklist as **new `WorkOrderEventType` values with stage-specific payload shapes**, not a new table. Each checklist stage is one more real, queryable event in the same timeline `/work-orders/[id]` and `/my-work/[id]` already render — not a parallel structure competing with it.

```
enum WorkOrderEventType {
  CREATED
  ASSIGNED
  STARTED
  COMMENTED
  RESOLVED
  CANCELLED
  ARRIVAL_CONFIRMED      // new
  DIAGNOSIS_RECORDED     // new
  INTERVENTION_RECORDED  // new
  VALIDATION_RECORDED    // new
}
```

Four new enum values, zero new tables — additive in exactly the low-risk way [WORK_ORDER_V1_TECHNICAL_NOTES.md](../implementation/WORK_ORDER_V1_TECHNICAL_NOTES.md)'s own migration already was.

## The five stages

### 1. Arrival confirmation

- **Purpose:** establish, on the record, that the technician is physically at the station — the moment "assigned" becomes "actually being worked," distinct from `start` (which today can be pressed from anywhere).
- **Required input:** a single confirmation tap.
- **Evidence captured:** a timestamp (automatic) and, optionally, browser geolocation (`navigator.geolocation`, a standard web API — no native app required, consistent with this work order's "desktop-responsive web, not a mobile app" instruction). Geolocation is opt-in and gracefully degrades if denied — the same honest-fallback pattern `FleetMap` already uses when no Google Maps key is configured, applied here to a different missing input.
- **Payload shape:** `{ latitude?: number, longitude?: number, accuracy?: number }`.
- **Maps to:** logged alongside (not instead of) the existing `start` transition — arrival confirmation is evidence, not a new `WorkOrderStatus`.
- **Honest gap:** without geolocation permission (likely common — technicians may reasonably decline), this stage is just a timestamped confirmation, no stronger a proof of presence than the technician's own word. Named, not hidden.

### 2. Diagnosis

- **Purpose:** what the technician actually found, compared to what the `WorkOrder` description said to expect — the moment the record either confirms or corrects the original trigger.
- **Required input:** a free-text finding (required, non-empty — mirroring `Action`'s own discipline of requiring real text at meaningful checkpoints, not just at closure).
- **Evidence captured:** the finding text, and — reused, not re-entered — the station's live status at this moment (`connectivityStatus`, connector/EVSE status), pulled fresh from the same `GET /charging-stations/:id` call the detail screen already makes. This is real, automatic, zero-effort evidence: the technician doesn't type "connector shows FAULTED," the screen shows it live and the event payload snapshots it.
- **Payload shape:** `{ finding: string, stationSnapshot: { connectivityStatus, connectorStatuses } }`.
- **Maps to:** a new event, `WorkOrder.status` unchanged (still `IN_PROGRESS`).

### 3. Intervention

- **Purpose:** what was actually done — the specific, physical action taken to address the diagnosed problem.
- **Required input:** a free-text description of the action (required).
- **Evidence captured:** the description, and optionally a structured `actionType` if a short, non-exhaustive set of common interventions proves useful once real data exists (e.g., "reset," "replaced part," "cleaned contact") — deliberately not designed as a fixed enum here, the same "don't invent a taxonomy before real data justifies one" restraint [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md) already applied to `skills`.
- **Payload shape:** `{ description: string, actionType?: string }`.
- **The honest gap this stage exposes most sharply:** field service work is normally documented with photos — before/after shots of a repaired connector, a replaced cable, a burnt component. **MOVOS has no file or image upload capability anywhere in the system today** — no blob storage integration, no attachment field on any entity in this entire schema. This is not a checklist-design gap; it's a platform capability that doesn't exist. Naming it here, at the exact stage where its absence is most felt, is more honest than pretending a text field is an adequate substitute for a photo.

### 4. Validation

- **Purpose:** confirming the intervention actually worked — the stage that turns "I think I fixed it" into "I can show it's fixed."
- **Required input:** a confirmation tap, plus a short outcome note (required).
- **Evidence captured:** the same reused-live-data pattern as Diagnosis — the station's _current_ status, fetched fresh a second time, so the record shows a real before/after: the Diagnosis stage's snapshot (the problem) and the Validation stage's snapshot (the state after intervention), both real, both automatic, no manual re-entry.
- **Payload shape:** `{ outcomeNote: string, stationSnapshot: { connectivityStatus, connectorStatuses } }`.
- **Honest limit:** this validates _device state_ (does the connector now report available, is the station now online) — it cannot validate a full charging cycle actually working end-to-end without a real test session, which this design does not propose orchestrating.

### 5. Closure

- **Purpose:** the existing `resolve` transition ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)/[WORK_ORDER_V1_TECHNICAL_NOTES.md](../implementation/WORK_ORDER_V1_TECHNICAL_NOTES.md)), unchanged in mechanism, now informed by the four stages before it.
- **Required input:** the resolution note `resolve` already requires.
- **Evidence captured:** nothing new at this stage — the value is that `RESOLVED`'s event, and everything above it in the timeline, now tells a complete, structured story: arrived, found X, did Y, confirmed Z, closed. A future reviewer (an Operations Manager, or a future [LEARNING_METRICS.md](../product/LEARNING_METRICS.md)-style analysis) reads a real sequence, not a single terminal note.
- **Should closure be gated on the other four stages being complete?** This document recommends **not enforcing it as a hard requirement in V1** — a technician who can genuinely resolve a simple problem without a formal diagnosis step (e.g., a connector that was simply left in a bad state and just needed a reset) shouldn't be blocked by process for a case that didn't need it. The checklist is scaffolding for thoroughness, not a mandatory gate — the same "soft-checked, not hard-blocked" philosophy [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md) already chose for assignment-to-an-unavailable-technician.

## Summary table

| Stage                | Required?                 | Automatic evidence                         | Manual evidence                             | New event type          |
| -------------------- | ------------------------- | ------------------------------------------ | ------------------------------------------- | ----------------------- |
| Arrival confirmation | Recommended, not enforced | Timestamp, optional geolocation            | —                                           | `ARRIVAL_CONFIRMED`     |
| Diagnosis            | Recommended, not enforced | Live station status snapshot               | Finding text (required if stage used)       | `DIAGNOSIS_RECORDED`    |
| Intervention         | Recommended, not enforced | —                                          | Action description (required if stage used) | `INTERVENTION_RECORDED` |
| Validation           | Recommended, not enforced | Live station status snapshot (second read) | Outcome note (required if stage used)       | `VALIDATION_RECORDED`   |
| Closure              | Already required today    | —                                          | Resolution note (`resolve`, unchanged)      | `RESOLVED` (existing)   |

## What this model deliberately does not solve

- **Photo/attachment evidence** — named above as a real platform gap, not a checklist gap; solving it means designing file storage for this codebase for the first time, a separate and substantial piece of work.
- **Enforcement/gating** — every stage is scaffolding, not a hard requirement, by deliberate choice in this version.
- **A fixed taxonomy for intervention types** — left open, per the same restraint already applied elsewhere in this domain, until real data justifies one.
