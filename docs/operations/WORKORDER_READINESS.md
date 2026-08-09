# Work Order Readiness

**Work order:** WO-ARGOS-034 (Operational Actors & Responsibility Model)
**Status:** DOMAIN DISCOVERY. No code, frontend, backend, migration, or API change.
**Mission:** an honest answer — is `WorkOrder` (WO-ARGOS-033) ready to be implemented, now that [OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md), [RESPONSIBILITY_MATRIX.md](./RESPONSIBILITY_MATRIX.md), [ESCALATION_MODEL.md](./ESCALATION_MODEL.md), and [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md) exist to check it against.

## The answer, stated directly

**Partially ready — ready for three of its five sources, not ready for two, and one real design gap surfaced by this sprint should be closed before implementation, not after.**

This isn't a rejection of WO-ARGOS-033's design. Every entity, state, and rule in that work order holds up well against the actor model this sprint built — the honest problems are narrower and more specific than "start over."

## Source by source

| `WorkOrder.source`  | Actor chain complete?                                                                                                                                                                                                                                                                                                                  | Verdict       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `CONNECTIVITY_LOSS` | Yes — MOVOS detects, Operator acknowledges/assigns, Technician executes off-product, Operator closes. Every step has a real actor.                                                                                                                                                                                                     | **Ready**     |
| `RECOMMENDATION`    | Yes — identical chain, already proven in production by `Action` since WO-ARGOS-026.                                                                                                                                                                                                                                                    | **Ready**     |
| `MANUAL`            | Yes — an Operator-initiated case needs no actor this sprint didn't already account for.                                                                                                                                                                                                                                                | **Ready**     |
| `MAINTENANCE`       | **No** — [RESPONSIBILITY_MATRIX.md](./RESPONSIBILITY_MATRIX.md) row 3 found nothing in MOVOS detects a maintenance need; it depends entirely on an Operations Manager noticing something with no product support for that noticing. The `WorkOrder` itself would work once created — the problem is nothing today reliably creates it. | **Not ready** |
| `CUSTOMER_REPORT`   | **No** — [RESPONSIBILITY_MATRIX.md](./RESPONSIBILITY_MATRIX.md) row 4 found this is the one event type where _closing_ requires confirming with an actor (the customer) MOVOS cannot reach at all, and detection depends on a Customer Support actor with a real `MemberRole` but zero shipped product surface.                        | **Not ready** |

**Concrete recommendation:** implement `WorkOrder` scoped to `CONNECTIVITY_LOSS`, `RECOMMENDATION`, and `MANUAL` sources first. Ship `MAINTENANCE` and `CUSTOMER_REPORT` as real enum values (so the schema doesn't need to change twice) but treat them as **manually-triggered only** until their respective actor gaps close — an Operations Manager or Support agent can still open a `MANUAL`-sourced `WorkOrder` today to cover both cases in practice, without the product pretending it can detect either automatically yet.

## Actors missing or incomplete

- **Dispatcher has no product surface of its own.** [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md) found the dispatch decision — who gets assigned what — happens entirely by phone today, with `WorkOrder.assign` as the first place it would become a real, logged event. This isn't a blocker (the same account performs both functions), but it means "dispatch" as a distinct, measurable step only starts existing the moment `WorkOrder` ships — worth setting expectations on rather than assuming dispatch-quality metrics exist from day one.
- **Field Technician remains fully outside the product**, by design ([TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)). [DAILY_OPERATION_MAP.md](./DAILY_OPERATION_MAP.md)'s finding stands: the entire physical-work stage of every `WorkOrder` is invisible to MOVOS, visible only at its two endpoints (dispatch call, resolution call). `WorkOrder` as designed does not fix this — it structures the _record_ of what happened, not MOVOS's _visibility_ into it happening. That's a legitimate v1 scope boundary, not a flaw in the design, but it should be stated to ARGOS as a known ceiling, not discovered later as a surprise.
- **Customer Support has a real role and zero real workflow.** The `SUPPORT` `MemberRole` has existed since early in this engagement and has never been exercised by a shipped feature ([OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md)). Building `CUSTOMER_REPORT` as a first-class automated source before this actor has any real product surface would be building the downstream half of a workflow whose upstream half doesn't exist.
- **Operations Manager's escalation trigger has no delivery mechanism.** [ESCALATION_MODEL.md](./ESCALATION_MODEL.md) already named this honestly — the L2 escalation _decision_ is well-defined; the L2 escalation _reaching someone_ depends on [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6, unbuilt and undesigned.

## Workflows that are incomplete

- **SLA tracking has no owner for the numbers themselves.** [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)'s proposed `slaMinutes` defaults are explicitly a starting proposal; [ESCALATION_MODEL.md](./ESCALATION_MODEL.md) assigns their ownership to the Operations Manager — but no product surface for that actor to actually set and tune them was designed in either work order. A `WorkOrder` implementation without that surface would ship with hardcoded defaults nobody can adjust, which is a real, avoidable gap given it's now identified before the fact.
- **Reassignment has real rules ([ESCALATION_MODEL.md](./ESCALATION_MODEL.md)) but no product trigger.** All three reassignment conditions this sprint found are detected by a human noticing, not by MOVOS — consistent with the rest of this sprint's findings, but worth listing explicitly as an incomplete workflow rather than a finished one.
- **The `createdBy` question from [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) is still open.** This sprint's actor model doesn't resolve it — it's a question about system-vs-human identity for automated creation, not an actor-responsibility question. Still unresolved, named again here so it isn't lost between work orders.

## A gap this sprint found that WO-ARGOS-033 did not

[OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) found `ActionController` enforces no `@Roles()` restriction on any of its write routes — every `MemberRole`, including `VIEWER` and `ANALYST`, can currently acknowledge, assign, resolve, or dismiss an `Action`. `WorkOrder`'s design ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)) doesn't specify role restrictions on its own transitions either. **This document recommends closing that gap in `WorkOrder`'s implementation rather than repeating it a second time**: at minimum, `WorkOrder` write transitions should require `OPERATOR` or above, matching the actor model this sprint just spent five documents establishing. Whether to _also_ retrofit `Action`'s existing routes is a separate decision (real production behavior change, out of scope for a design sprint to decide unilaterally) but should be raised to ARGOS as a related, adjacent finding.

## What assumptions remain

- That Operator and Dispatcher stay the same account indefinitely. [OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) named the scaling trigger (case volume exceeding one person's tracking capacity) without evidence it's been reached — an assumption, not a certainty, worth revisiting once real `WorkOrder` volume exists to check it against.
- That the proposed SLA defaults ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)) are reasonable starting points. Untested against any real technician response-time data, because none exists yet.
- That `External Contractor` needs no product distinction from `Technician` yet ([OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md)) — plausible, unverified.
- That closing the `ActionController` role-enforcement gap for `WorkOrder` alone (without touching `Action`) is safe and sufficient. It's internally consistent with this sprint's findings, but a real security/product decision, not just a documentation one.

## Answering ARGOS's five success-criteria questions directly

- **Who owns every problem?** The Network Operator, structurally, for every source except `CUSTOMER_REPORT`, where ownership of the _technical_ fix and ownership of _closing the loop with the customer_ are two different actors — a real distinction this sprint surfaced that WO-ARGOS-033's design didn't yet have language for.
- **Who executes every task?** The Field Technician, for anything physical — invisible to the product throughout, by design, per [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md).
- **Who supervises the operation?** The Operations Manager, on a weekly cadence for the routine case and an escalation basis for the exceptional one — never a daily presence, and correctly so.
- **Who closes the loop?** The Network Operator, in four of five event types this sprint mapped — the single most consistent finding across [RESPONSIBILITY_MATRIX.md](./RESPONSIBILITY_MATRIX.md)'s entire matrix.
- **Is MOVOS coordinating infrastructure or people?** Both, but asymmetrically: infrastructure detection is mature and largely automated; people-coordination is real but manual almost everywhere it isn't already covered by `Action`'s existing self-assign flow — `WorkOrder`, scoped as this document recommends, is a genuine step toward the second half, not a completed one.
