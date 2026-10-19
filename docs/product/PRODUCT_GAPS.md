# Product Gaps

**Work order:** WO-ARGOS-032 (Product Reality Check)
**Status:** PRODUCT VALIDATION. No code, API, migration, or `schema.prisma` change.
**Mission:** every piece of information a real operator would expect that MOVOS cannot provide today — grounded in [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md)'s walk through an actual day, not a speculative feature wishlist.

## How to read impact / urgency / complexity

- **Impact** — how much a real operator's day is degraded by this gap's absence, independent of how easy it would be to fix.
- **Urgency** — how soon this gap becomes a blocker, not a nice-to-have, given MOVOS's current pilot-stage reality (one customer, Kylum Energy).
- **Complexity** — grounded in what's already known about the schema and architecture, not a guess. Several of these gaps were already named in prior discovery work; this document doesn't re-derive that analysis, it cites it.

## The gaps

### 1. Technician dispatch (identity, contact, assignment beyond self)

- **What's missing:** a `Technician` concept doesn't exist anywhere in the schema. `Action.assignedToUserId` accepts any user with an active membership, but the frontend control only offers "Asignarme" (self-assign) — [OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md](../implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md)'s own named limitation, because no members-list endpoint exists to populate a picker of teammates.
- **Impact:** High. [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md)'s 8:05–9:00 beat shows this directly — every real dispatch happens by phone, entirely outside the product, the moment a case needs a physical response.
- **Urgency:** Near-term. Not a pilot blocker (a single-operator pilot can work around it by phone), but the first real friction point the moment a customer has more than one field technician.
- **Complexity:** Medium. A members-list endpoint and a picker UI are small; a true dispatch/notification flow (getting the assignment to the technician, not just recording it) is a larger, separate capability.

### 2. SLA tracking (due-by timers, breach escalation)

- **What's missing:** `Action` has no due-date or SLA-target field — only `createdAt`/`updatedAt`/`resolvedAt`, from which elapsed time is derivable but a target to measure against is not, per [KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md)'s own "Not real yet" finding for Operations.
- **Impact:** Medium. Severity (`HIGH`/`MEDIUM`) already gives a coarse priority signal; SLA timers would sharpen it, not replace a currently-missing capability outright.
- **Urgency:** Long-term. Matters more as case volume grows past what one operator can track by memory — not a pilot-scale problem yet.
- **Complexity:** Low technically (one additional field and a countdown UI), but requires a real business decision first — what SLA, per recommendation type — that doesn't exist yet either.

### 3. Maintenance tickets independent of a recommendation

- **What's missing:** the fuller `Alert`/`Incident`/`MaintenanceTicket` architecture ([CAP-X_INCIDENT_FLOW.md](../domain/CAP-X_INCIDENT_FLOW.md)) — deliberately not built; `Action` only ever originates from `RecommendationService`'s five detectors, per WO-ARGOS-026's own scope boundary.
- **Impact:** Medium. A scheduled preventive-maintenance visit, or a problem an operator notices by phone call before the Recommendation Engine ever detects it, has nowhere to live in the product today.
- **Urgency:** Long-term. This is the same capability [FORGEOS_POSITIONING.md](../forgeos/FORGEOS_POSITIONING.md) and [LEARNING_STRATEGY.md](./LEARNING_STRATEGY.md) already deliberately deferred, twice, for good reason — it needs the missing status-history log first ([RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s central finding).
- **Complexity:** High. The largest schema investment on this list — a genuinely new entity and a status-transition history log, not an additive field.

### 4. Customer/driver contacts

- **What's missing:** no way to look up a session or credential by anything a driver would give an operator on the phone (a name, a phone number, a plate) — sessions are keyed to internal IDs and credential identifiers.
- **Impact:** Medium. Named directly in [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md)'s 9:00–12:00 beat — cross-referencing a phone call to a real session is manual, approximate work today.
- **Urgency:** Near-term for any customer whose drivers call in with problems directly, which is plausible even at pilot scale.
- **Complexity:** Medium. Would need a `Driver`/contact concept and a lookup surface — real schema work, but narrower than the maintenance-ticket gap.

### 5. Shift management / on-call rotation / handoff

- **What's missing:** no concept of who is on duty, no handoff mechanism between operators, no escalation path for a `HIGH`-severity condition appearing outside anyone's login session.
- **Impact:** High. [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md)'s 7:45 and 17:00 beats are the same gap seen from both ends — a 24-hour network with an 8-hour product.
- **Urgency:** Near-term the moment a customer runs the network outside business hours, which every charging network does by definition (EVs charge overnight).
- **Complexity:** Medium–High. Requires both a scheduling/roles concept and — see gap 6 — an actual notification-delivery mechanism, since a shift schedule with no way to alert the next person on it doesn't close the gap.

### 6. Notification delivery outside the app

- **What's missing:** the top bar's notification bell (WO-ARGOS-031) is real but in-app only — nothing pages, texts, or emails anyone who isn't already looking at the screen.
- **Impact:** High. This is arguably the single highest-impact gap on this list: every other gap here is about _what_ the product can show; this one is about whether anyone sees it at all outside business hours.
- **Urgency:** Immediate in spirit, though not a pilot blocker in practice — Kylum Energy's own pilot scale likely tolerates a human checking in periodically today, but this is the gap most likely to cause a real, visible incident once the network runs unattended overnight.
- **Complexity:** Medium. A push/SMS/email delivery integration is a well-understood category of work, not a novel one — the complexity is mostly in deciding rules (who gets notified, for what severity, how often) more than the mechanism itself.

### 7. Reporting / export

- **What's missing:** `/reports` has shown "Próximamente" with disabled downloads since before the Operator Control Center existed (`docs/product/MOVOS.md`'s own "Known constraints").
- **Impact:** Medium. Named directly in [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md)'s end-of-day beat — any external reporting today is manual, outside the product entirely.
- **Urgency:** Near-term, specifically because of its commercial weight, not its operational one — [COMMERCIAL_JOURNEY_MAP.md](../commercial/COMMERCIAL_JOURNEY_MAP.md) and [PRICING_AND_PACKAGING.md](../commercial/PRICING_AND_PACKAGING.md) both depend on being able to show an operator's own leadership real, exportable evidence of value.
- **Complexity:** Low–Medium for a first version (export what Analytics already computes), higher for anything beyond that (scheduled reports, custom formats).

### 8. Full intervention / transition history

- **What's missing:** already found by [LEARNING_SIGNALS.md](./LEARNING_SIGNALS.md) signal 5 — `Action` overwrites `status`/`assignedToUserId`/`snoozedUntil` in place, so only the final state of a case is knowable, not the sequence that produced it. [VERTICAL_BOUNDARIES.md](../forgeos/VERTICAL_BOUNDARIES.md) named the universal shape of this gap as a missing **Timeline** primitive.
- **Impact:** Medium. Doesn't block closing a case today, but blocks reconstructing _how_ it was closed — relevant for the "intervention history" [KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md](./KYLUM_CONSOLE_INFORMATION_ARCHITECTURE.md) already flagged as missing on Operations.
- **Urgency:** Long-term — a quality-of-record gap, not a blocking one, until the day someone needs to answer "who actually touched this case and when" and can't.
- **Complexity:** Low. Purely additive — a new append-only table logging each transition — no change to the entities it would sit alongside.

### 9. Real-time (push) data delivery

- **What's missing:** the entire console polls (`usePolledResource`, 15–60 second intervals) rather than pushes — a deliberate, documented choice ([CAPX_RISK_MATRIX.md](../implementation/CAPX_RISK_MATRIX.md): "start with polling... revisit push-based delivery only if polling proves visibly too slow").
- **Impact:** Low today. Nothing in [FIVE_MINUTE_OPERATOR_SIMULATION.md](./FIVE_MINUTE_OPERATOR_SIMULATION.md)'s scenario is meaningfully harmed by a 15–30 second delay.
- **Urgency:** Long-term, explicitly deferred by design until polling is shown to be insufficient.
- **Complexity:** Medium — a real architectural change (WebSocket or SSE delivery to the browser), not a small addition.

### 10. Backend search

- **What's missing:** the top bar's search input (WO-ARGOS-031) is real but not wired to any query — no search endpoint exists across stations, sessions, or actions.
- **Impact:** Low–Medium at current pilot scale (4 stations, small session volume); would grow directly with fleet size.
- **Urgency:** Near-term the moment a customer's station count makes browsing the Network table impractical.
- **Complexity:** Low–Medium — a straightforward query-and-filter endpoint over already-real data, not new data modeling.

## Summary table

| Gap                           | Impact     | Urgency               | Complexity                                      |
| ----------------------------- | ---------- | --------------------- | ----------------------------------------------- |
| 1. Technician dispatch        | High       | Near-term             | Medium                                          |
| 2. SLA tracking               | Medium     | Long-term             | Low (technically), gated on a business decision |
| 3. Maintenance tickets        | Medium     | Long-term             | High                                            |
| 4. Customer/driver contacts   | Medium     | Near-term             | Medium                                          |
| 5. Shift management / handoff | High       | Near-term             | Medium–High                                     |
| 6. Notification delivery      | High       | Immediate in spirit   | Medium                                          |
| 7. Reporting / export         | Medium     | Near-term             | Low–Medium                                      |
| 8. Intervention history       | Medium     | Long-term             | Low                                             |
| 9. Real-time data delivery    | Low        | Long-term (by design) | Medium                                          |
| 10. Backend search            | Low–Medium | Near-term             | Low–Medium                                      |

## What this means for what gets built next

Three gaps score High impact: technician dispatch, shift management, and notification delivery. All three are also the three gaps [OPERATOR_DAY_MAP.md](./OPERATOR_DAY_MAP.md) found clustered at the _edges_ of the operator's day — the start (overnight backlog), the handoff points (shift end), and the moments requiring a physical response (dispatch) — not in the middle of a normal working session, which the existing four screens already serve reasonably well. [FIVE_MINUTE_OPERATOR_SIMULATION.md](./FIVE_MINUTE_OPERATOR_SIMULATION.md) makes two of these three concrete inside a single scenario.
