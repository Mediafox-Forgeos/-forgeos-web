# Daily Operation Map

**Work order:** WO-ARGOS-034 (Operational Actors & Responsibility Model)
**Status:** DOMAIN DISCOVERY. No code, frontend, backend, migration, or API change.
**Mission:** the complete day of four actors — Operator, Dispatcher, Technician, Operations Manager — extending [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) (WO-ARGOS-032) rather than repeating it, since [OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) already found two of these four actors share one real account.

## Operator and Dispatcher — one day, two functions

[OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) found Operator and Dispatcher are the same `MemberRole.OPERATOR` account at current scale. Rather than write a second, nearly-identical day narrative, this section overlays the Dispatcher _function_ onto the Operator day [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) already mapped in detail — marking exactly which beats are the dispatcher function specifically, not the triage function.

| Time        | Operator function (already mapped)      | Dispatcher function (this document's addition)                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8:00        | Reads Command Center's verdict — triage | —                                                                                                                                                                                                                                                                                                                      |
| 8:05–9:00   | Works cases in Operations               | **Decides who gets each case** — matches a problem to a technician by zone/skill/availability ([TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)), the one decision in this whole day that has no equivalent in today's shipped product, since self-assign-only means the operator has never had anyone else to dispatch to |
| 9:00–12:00  | Monitors, fields calls                  | **Confirms dispatch happened** — the phone call to the technician _is_ the dispatch act; nothing in the product records it as its own event today                                                                                                                                                                      |
| 13:00–16:00 | Processes technician reports            | **Re-dispatches if needed** — [ESCALATION_MODEL.md](./ESCALATION_MODEL.md)'s reassignment rules, performed the same way, by phone, then reflected in the product after the fact                                                                                                                                        |

The honest finding from this overlay: **the Dispatcher function is real and happens every day, but today it has almost no product surface of its own** — it's implicit in who the operator calls, not a decision MOVOS records anywhere. `WorkOrder.assign` ([WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)) is the first place this function would become a real, logged event rather than an invisible phone call.

## Field Technician — a day described from outside

MOVOS has no inside view of this actor's day — everything here is inferred from what the product _assumes_ happens, cross-checked against [OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md)'s finding that a `Technician` has zero product access. This is the day MOVOS's design implicitly depends on, not one it can verify is actually happening this way.

- **Before any dispatch:** the technician's `shift` and `availability` ([TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md)) are assumed current — but nothing keeps them current automatically. If a technician calls in sick, `availability` only reflects it once an operator manually updates the record; there is no self-service way for the technician to do this themselves.
- **On dispatch:** receives a phone call or message describing the problem, station, and location — a real information transfer that happens entirely outside MOVOS, using whatever the operator remembers or reads off the screen in the moment (see [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md)'s dispatch beat).
- **En route and on-site:** invisible to MOVOS entirely. No location tracking, no "arrived" signal, no way to confirm the technician is even working the right case versus something else entirely.
- **Diagnosing and fixing:** happens with no product involvement — MOVOS never receives a fault code, a photo, a parts list, or any structured detail from this stage, only whatever the technician later summarizes verbally.
- **Reporting back:** a second phone call, translated by the operator into a `resolve`/`block` transition and a free-text note. This is the technician's only real "close the loop" moment, and it happens through a proxy, not directly.
- **Between jobs:** `availability` should read `AVAILABLE` again, but — same as the sick-day case — only if someone remembers to update it.

**The single clearest finding from mapping this day:** every stage of a technician's actual work is invisible to MOVOS except the two phone calls at the very beginning and very end. The entire physical job — the part that actually fixes the problem — happens in a gap the product has no way to see into, today or under [WORK_ORDER_DOMAIN.md](./WORK_ORDER_DOMAIN.md)'s design. Closing that gap would require the technician to have product access at all, which [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md) deliberately ruled out of scope for this version — an honest tradeoff, not an oversight, but one worth stating this plainly.

## Operations Manager — a different cadence entirely

Unlike the Operator/Dispatcher's continuous, reactive day, the Operations Manager's real day is periodic and supervisory — confirmed independently by [USER_DECISION_MATRIX.md](../product/USER_DECISION_MATRIX.md) and [ICP_AND_BUYER_PERSONAS.md](../commercial/ICP_AND_BUYER_PERSONAS.md), both of which found this same actor (there called the "economic buyer") checks in weekly, not daily.

- **Morning (occasional, not daily):** a quick glance at Command Center if something happened overnight worth knowing about — not the routine first stop the Network Operator makes.
- **Mid-week (real, recurring):** reviews Analytics — session/energy trends, station ranking ([WIDGET_VALUE_ANALYSIS.md](../product/WIDGET_VALUE_ANALYSIS.md) already found this is genuinely this persona's screen, at this persona's cadence) — and, once real, would review `WorkOrder` volume and SLA-breach trends the same way.
- **When escalated to (L2, per [ESCALATION_MODEL.md](./ESCALATION_MODEL.md)):** an SLA breach, an unassigned `CRITICAL` case, or an operator explicitly asking for help — the one moment this actor's day becomes reactive rather than periodic, and, per the same document's honest ceiling, currently reachable only by phone, not by any in-product alert.
- **Roster and policy work (real, but off-product entirely):** deciding `Technician.shift`/`active` status, setting SLA targets — decisions this actor makes that have a real field to land in ([TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md), [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)) once `WorkOrder` exists, but which happen as conversations and spreadsheets today, the same "outside MOVOS entirely" pattern [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) already found for reporting.
- **End of week/month (real, entirely outside MOVOS):** compiling whatever summary goes to ownership or a customer's own leadership — [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #7 (reporting/export), still unbuilt, still manual.

## What this map adds to the operator-only version

[OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) already found MOVOS is present only for screen-based work during business hours. This document sharpens that finding by actor: the Operator/Dispatcher's day is the one MOVOS actually serves reasonably well today; the Technician's day is almost entirely invisible to the product by design; and the Operations Manager's day is periodic enough that "does MOVOS support their daily workflow" is close to the wrong question to ask about them at all — a weekly or monthly cadence, not a daily one, is the honest frame for that actor, in this document as much as in [USER_DECISION_MATRIX.md](../product/USER_DECISION_MATRIX.md).
