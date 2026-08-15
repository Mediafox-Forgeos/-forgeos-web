# Operational Loop Checkpoint

**Trigger:** ARGOS authorization following the WO-ARGOS-037 (Technician Identity & My Work) merge — a read/validate/document checkpoint on `main` after the merge, not a new work order. No code changed to produce this document.
**Method:** the loop below was driven live — real login, real database, real authorization boundaries, two real browser sessions (an operator and a technician, separately authenticated) — not inspected component-by-component in isolation. Screenshots in `docs/product/screenshots-operational-loop-checkpoint/`. Full event/state evidence pulled directly from `movos_dev` via Prisma, not summarized from memory.
**Scenario used:** a real `WorkOrder` already sitting in the database — `Estación sin conexión: Estación Bogotá Centro 03`, `source: CONNECTIVITY_LOSS`, created six days earlier by `WorkOrderAutomationService`'s own sweep, genuinely unassigned and untouched since. This is stronger evidence than manufacturing a fresh one: it proves Rule 1 detection already happened for real, independent of this checkpoint.

## A. Operator experience

**Where does the operator discover the problem?** Three real, already-shipped paths, not one: (1) `WorkOrderAutomationService`'s Rule 1 — a station offline >15 minutes auto-creates a `WorkOrder`, zero operator action, the path this checkpoint used; (2) Rule 2 — a `HIGH`-severity `Recommendation` surfaces a real "Crear orden de trabajo" button on the dashboard's `OperationalIntelligenceWidget`; (3) manual creation via `/work-orders`'s own form. All three converge on the same list.

**How does the operator reach the WorkOrder?** `/work-orders` in the sidebar, filterable by status (`01-operator-work-orders-list.png`), or directly from a dashboard recommendation card.

**How is a technician assigned?** This is the sharpest finding in this checkpoint. `/work-orders/[id]`'s only assignment control is **"Asignarme"** — assign to the currently logged-in operator, and nothing else. There is no UI for assigning to anyone else. The backend fully supports it — `PATCH /work-orders/:id` with `transition: assign` and any `assignedMemberId` that holds an active membership, verified working in this checkpoint via a direct API call — but **an operator using the actual product today cannot dispatch a technician other than themselves.** This is a UI gap sitting directly on top of a working backend capability, not a missing feature end to end.

**Can the operator understand current responsibility?** Yes, once assigned by whatever means — the list's "Técnico" column and the detail page's "Técnico asignado" panel both show the real assignee (`07-operator-detail-after-resolution.png`).

**Can the operator see when work is resolved?** Yes for the terminal fact — a `Resuelta` badge and the resolution note. Only partially for the story behind it — see the timeline finding under C.

## B. Technician experience

**Can the technician log in and immediately understand what they must do?** Yes. Login now routes a `TECHNICIAN` membership straight to `/my-work` (added specifically because the default `/dashboard` redirect would otherwise land them on a wall of routes they have no access to). `/my-work` shows exactly their own queue, prioritized, nothing else (`03-technician-my-work-list.png`).

**Can the complete execution flow happen without changing identity manually?** Yes — one authenticated session, one role, login through resolve. No re-authentication, no org switch, no parallel technician-only auth system, verified live.

**Can they record meaningful field progress?** Yes — all four checklist stages recorded for real in this run, each with a real, live-computed station snapshot for diagnosis and validation (never client-supplied), each attributed to the real technician with a real timestamp.

**Can they resolve the work entirely inside MOVOS?** Yes — start → checklist → resolve, fully self-service, verified live end to end (`06-technician-detail-resolved.png`).

## C. Closed loop

`Problem → Decision → Assignment → Execution → Resolution → Operational visibility`

| Transition                          | Status                                                                                                                                              | Severity    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Problem → Decision                  | Closed. Automation can decide with zero human input (Rule 1); an operator can decide from a recommendation or manually. Multiple real paths.        | —           |
| Decision → Assignment               | **Broken in the UI.** Backend transition works; no product surface exposes it to assign anyone but self.                                            | **BLOCKER** |
| Assignment → Execution              | Closed, verified live. (Pre-existing, unrelated gap: no notification tells the technician a new item landed — they must think to check `/my-work`.) | —           |
| Execution → Resolution              | Closed, verified live — real server-enforced state machine, real checklist, real evidence capture.                                                  | —           |
| Resolution → Operational visibility | **Partially broken**, two distinct findings below.                                                                                                  | **HIGH**    |

**Finding 1 — the operator's timeline doesn't render checklist detail.** `/work-orders/[id]`'s `EVENT_LABEL` map was never extended for the four new checklist event types, so the operator's timeline shows the raw enum (`ARRIVAL_CONFIRMED`, `DIAGNOSIS_RECORDED`, …) instead of Spanish labels. Worse: the sub-text renderer only checks `event.payload?.comment` — never `.finding`, `.description`, or `.outcomeNote` — so the operator sees _that_ four things happened, by whom, and when, but never _what_ the technician actually found, did, or validated, without reading the raw API. The technician's own `/my-work/[id]` page renders all of this correctly; the operator's page was simply never updated to match. Severity: **MEDIUM** (data is fully captured and correct — this is a read-path gap, not data loss).

**Finding 2 — resolving a `WorkOrder` doesn't touch the condition that triggered it, and Rule 1 will recreate a duplicate.** Verified live: within about a minute of resolving the connectivity-loss `WorkOrder`, `WorkOrderAutomationService`'s next sweep created a **new** `WorkOrder` for the identical station and problem (`08-operator-work-orders-list-after.png` shows both — one `Resuelta`, one freshly `Abierta`, one minute apart). This isn't a bug in Rule 1's logic — it correctly checks "no open `WorkOrder` already exists for this station" and the old one is now `RESOLVED`, so a fresh one is exactly what its own rule specifies — but nothing in the data model links the two, so from the operator's list it reads as a second, unrelated incident. `WorkOrder.resolve` is a human attestation, not a verification against live device state. Severity: **HIGH** — this is exactly the kind of thing that erodes an operator's trust in "resolved" as a real signal during an actual pilot.

**Finding 3 (bonus, evidence-based) — a technician's own narrative can silently contradict the system's own honest evidence.** In this run, the technician's `VALIDATION_RECORDED` note read "La estación reporta conexión estable tras el reinicio" — but that same event's server-computed `stationSnapshot` (never client-trusted, exactly as designed) recorded `connectivityStatus: OFFLINE` at that exact instant. The live "Desconectado" badge sat directly next to the technician's own claim on screen the entire time (`06-technician-detail-resolved.png`), and nothing — not the technician's page, not the operator's page, not the data model — flags or reconciles the contradiction. The checklist's entire premise (`WORK_ORDER_CHECKLISTS.md`) was capturing honest, unmodified evidence specifically so it wouldn't have to trust the narrative alone; this run shows that evidence can be captured faithfully and still pass through the whole loop, past a human, unused. Severity: **MEDIUM**.

## D. Missing capabilities

| Capability                                                             | Required for credible pilot?                                              | Required later?                                                           | Manual workaround at pilot scale?                                                    | Concrete problem it solves                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| SLA / `dueAt`                                                          | No                                                                        | Yes, once volume exceeds what a dispatcher can eyeball                    | Yes — priority + conversation                                                        | Stops an assigned WorkOrder from silently aging past an acceptable threshold |
| Notifications                                                          | Not strictly, if technicians are trained to check `/my-work` periodically | Yes, this is the most likely real pilot friction point                    | Yes — the same phone call, just shrunk (`TECHNICIAN_WORKFLOW.md` already named this) | Removes the one remaining phone call from dispatch                           |
| Photo/file evidence                                                    | No                                                                        | Yes — field service is culturally expected to include photos              | Yes — free-text fields already capture some of this, honestly labeled incomplete     | Proves work was done beyond a text claim (stakeholder/warranty credibility)  |
| Routing / travel time                                                  | No, at pilot scale (few technicians, few stations)                        | Only once technician count and geographic spread both grow                | Yes — technicians self-prioritize                                                    | —                                                                            |
| Technician availability / shift state                                  | No, for a business-hours-only pilot                                       | Yes, before any 24/7 claim (`ESCALATION_MODEL.md` already found this gap) | Yes — restrict pilot scope to business hours                                         | Prevents an unattended 2 AM auto-created WorkOrder from going nowhere        |
| Incident abstraction (WorkOrder ↔ originating Recommendation evidence) | No                                                                        | Yes, once an analyst wants to trace outcomes back to the detector         | Yes — the description snapshot is enough for a small pilot                           | Closes the loop back to `LEARNING_METRICS.md`'s learning goals               |
| Customer-originated reports                                            | No                                                                        | Out of scope by design (`WORKORDER_READINESS.md`)                         | N/A                                                                                  | —                                                                            |

None of these are assumed to need building — each is evaluated strictly against what a real pilot needs to function, not against a hypothetical mature product.

## E. Pilot readiness

**Verdict: DEMO_READY. Not yet PILOT_READY.**

Every step of the loop is real, live, and was just proven end to end — real authorization boundaries, a real database, real UI, nothing mocked. It demonstrates the product's thesis convincingly and is a strong demo.

It is not yet PILOT_READY because a real pilot requires a real operator to dispatch a real technician and trust the "resolved" signal that comes back, and two concrete things stand in the way of exactly that claim:

1. **No in-product way to assign a technician other than yourself** (Finding under A/C — BLOCKER).
2. **A resolved WorkOrder can be silently duplicated moments later** with no link back to its predecessor (Finding 2 under C — HIGH).

### Minimum changes to reach PILOT_READY

Named from evidence gathered in this checkpoint, not proposed as a new work order:

1. An assignee picker on `/work-orders/[id]` (or the creation form) — the backend transition already supports arbitrary assignment; this is a UI-only gap.
2. Something that makes a re-created `WorkOrder` explainable rather than mysterious — linking it to its predecessor, suppressing re-creation within a short post-resolution window, or surfacing an explicit "this station may still be offline" signal at resolution time (the system already computes the live connectivity state and currently discards it).
3. Extend the operator's `/work-orders/[id]` timeline to render the four checklist event types' real labels and detail text, matching what the technician's own page already does correctly.

All three are narrow, read-path or logic fixes on already-shipped code — not new capabilities — but all three are directly load-bearing for the one claim this entire capability exists to make: that an operator can dispatch and trust a technician's work.
