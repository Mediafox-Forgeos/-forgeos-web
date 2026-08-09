# Technician Workflow

**Work order:** WO-ARGOS-036 (Field Technician Console)
**Status:** DESIGN. No code, API, migration, or `schema.prisma` change.
**Mission:** the technician's day, told from the inside — the direct reversal of [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md) (WO-ARGOS-034), which described this same actor's day entirely from the outside because they had no product access at all. Everything in that document remains true until [FIELD_TECHNICIAN_CONSOLE.md](./FIELD_TECHNICIAN_CONSOLE.md)'s identity question is actually resolved and built — this document describes what changes once it is.

## The reversal, stated plainly

[DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md)'s closing finding: "every stage of a technician's actual work is invisible to MOVOS except the two phone calls at the very beginning and very end." This document exists because that finding is the problem this work order is trying to solve — not by adding a third phone call, but by giving the technician a screen instead of the first and last one.

## The workflow, phone-call by phone-call, replaced or not

### Before: login and orientation

**Old (outside):** the technician has no way to know what's assigned to them except being told, verbally, at the start of the day or as each job comes up.

**New (inside):** the technician logs in — real authentication, per [FIELD_TECHNICIAN_CONSOLE.md](./FIELD_TECHNICIAN_CONSOLE.md)'s recommended `MemberRole.TECHNICIAN` — and lands on `/my-work`. The "My Day" summary strip answers the first question without a single click: how many tasks are already done, how many are active, what's the workload. This is the first moment in this entire engagement's history that a technician has looked at a MOVOS screen.

### Dispatch: what changes, and what honestly doesn't

**Old (outside):** the operator calls or messages the technician, reading the station name and problem description off their own screen, translating it manually.

**New (inside), partially:** once assigned (`WorkOrder.assign`, unchanged — still the operator's action, from `/work-orders`), the assignment is immediately visible on the technician's own `/my-work` the next time they check it. The manual, verbal translation step is gone — the technician reads the real title, description, and priority themselves, in the technician's own words as recorded, not as remembered from a phone call.

**What doesn't change, honestly:** nothing in this design gives the technician a way to _know_ a new assignment exists without checking. [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6 (notification delivery) is still unbuilt and out of scope here. The phone call doesn't disappear — it shrinks. "Here's the station, here's the problem, here's what to check for" becomes "you've got a new one, check your queue." That's real progress, not the whole gap closed, and this document says so rather than overclaiming the console solves dispatch outright.

### Arrival: what happened before I arrived

**New (inside):** the technician opens `/my-work/[id]` before or on arrival. Station summary tells them what they're walking up to (connectivity, administrative status, manufacturer/model — the same real data the operator's own detail page already shows). Incident summary and timeline tell them what's already known — including, honestly, only as much as [FIELD_TECHNICIAN_CONSOLE.md](./FIELD_TECHNICIAN_CONSOLE.md) already flagged: the `WorkOrder.description` snapshot, not the full evidence array behind whatever recommendation may have triggered it, since V1 doesn't link the two.

### Execution: the checklist

**New (inside):** the technician works through arrival confirmation, diagnosis, intervention, and validation — see [WORK_ORDER_CHECKLISTS.md](./WORK_ORDER_CHECKLISTS.md) for the full model — using `start`, `pause`, and `comment` to keep the record current as they go, not reconstructing it from memory during a callback at the end.

### Closure: the second phone call, replaced

**Old (outside):** the technician calls back, describes what they did, and the operator types a `resolve` transition with a note built from that conversation.

**New (inside):** the technician performs `resolve` themselves, with their own note, at the moment the work is actually finished — the same event, performed by the person who actually has the information, instead of relayed through a second party. This is the single clearest, most concrete improvement this design makes over the current state: **the person closing the loop is now the person who did the work**, not an operator transcribing a phone call.

### End of day

**New (inside):** "My Day" shows the technician (and, if they check the equivalent operator-side view, the Operations Manager) a real, computed average resolution time and a real completed-task count — the first time either actor has had this number without manually counting.

## What this means for the Operator/Dispatcher role

[OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) found Operator and Dispatcher are the same account, and that "dispatch" had almost no product surface of its own — an invisible decision made by phone. This workflow doesn't change who decides who gets assigned what (still the operator, still `WorkOrder.assign`), but it does change what happens _after_ that decision: today it requires a phone call to even communicate; under this design, the assignment itself is the communication, and the phone call becomes optional context instead of the only channel. The dispatcher's job gets narrower and more valuable — deciding who's right for the job — instead of also being the manual relay for every detail of it.

## What this workflow does not attempt to solve

- **Overnight/off-shift assignment.** If a `CONNECTIVITY_LOSS` work order is auto-created at 2 AM ([WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) Rule 1), a technician with no active shift has no way to know until they next log in — the same shift-management gap [ESCALATION_MODEL.md](./ESCALATION_MODEL.md) already named, unresolved by giving technicians a screen.
- **Multi-job routing/routing efficiency.** This design gives a technician visibility into their own queue; it does not optimize which job they should do first beyond a priority/age sort, and it does not consider travel time or geographic clustering at all.
- **Anything for `CUSTOMER_REPORT` or `MAINTENANCE` sources** — still excluded from `WorkOrder` entirely, per [WORKORDER_READINESS.md](./WORKORDER_READINESS.md)'s scope recommendation, unchanged by this document.
