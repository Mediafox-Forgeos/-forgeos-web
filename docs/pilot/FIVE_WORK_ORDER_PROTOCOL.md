# Five-Work-Order Pilot Protocol

**Work order:** WO-ARGOS-041
**Progress: 3 / 5 completed.** PILOT-WO-01 (Calima - Estación 01) resolved 2026-08-15 — `docs/pilot/PILOT_WO_01_EVIDENCE.md`. PILOT-WO-02 (Calima - Estación 02) resolved 2026-08-15 — `docs/pilot/PILOT_WO_02_EVIDENCE.md`. PILOT-WO-03 (Calima - Estación 03) resolved 2026-08-16 — `docs/pilot/PILOT_WO_03_EVIDENCE.md`. PILOT-WO-04 and PILOT-WO-05 not started.
**The success unit:** 5 real, resolved `WorkOrder`s — not five calendar days, not five clicks. A quiet pilot org might take longer to produce them; a busy one might produce them in a day. Duration follows the evidence, not the other way around (`docs/pilot/OPERATIONAL_PILOT_V1.md`).

> ## ⚠ Classification correction (WO-ARGOS-047)
>
> All three `WorkOrder`s counted toward the 3/5 above (`PILOT-WO-01`, `PILOT-WO-02`, `PILOT-WO-03`) belong to **`PRODUCT_SIMULATION_PILOT`** — real users, real production MOVOS, real workflow execution, but a **simulated** operational scenario, because Centro Comercial Calima has not yet been physically provisioned with the pilot charging stations. Progress toward 5 continues to count real `WorkOrder`s completed through the real product; it is not, on its own, evidence of 5 real field interventions. See each evidence document's own classification block, and `docs/pilot/OPERATIONAL_PILOT_V1.md`'s Phase A/B/C model, before treating this count as proof of physical operational readiness.

**Rule:** only real or legitimate controlled operational cases count. Nothing here is a script to follow — it's a record to fill in as real things actually happen. If a `WorkOrder` fails, gets confused, or exposes friction, that's exactly the evidence this pilot exists to collect — do not paper over it, and do not manufacture failures that wouldn't have happened otherwise.

## The record, per WorkOrder

Every field below has a real, traceable source in MOVOS — none of it needs to be estimated or remembered from memory, matching `docs/pilot/PILOT_MEASUREMENT_PLAN.md`'s own findings.

| Field                                  | Where it comes from                                                                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #                                      | 1 through 5, in the order they were resolved                                                                                                                                                                                     |
| Source/problem                         | `WorkOrder.source` (`MANUAL`/`RECOMMENDATION`/`CONNECTIVITY_LOSS`) + `WorkOrder.description`, both real                                                                                                                          |
| Detection timestamp                    | `WorkOrder.createdAt`                                                                                                                                                                                                            |
| Assignment timestamp                   | `WorkOrder.assignedAt`                                                                                                                                                                                                           |
| Technician start timestamp             | `WorkOrder.startedAt`                                                                                                                                                                                                            |
| Resolution timestamp                   | `WorkOrder.resolvedAt`                                                                                                                                                                                                           |
| Operator involved                      | The real name attached to the `ASSIGNED` event in the `WorkOrder`'s own timeline                                                                                                                                                 |
| Technician involved                    | The real name attached to `STARTED`/checklist/`RESOLVED` events                                                                                                                                                                  |
| External/manual communication required | Not tracked by MOVOS (named as a real gap in `PILOT_MEASUREMENT_PLAN.md`) — recorded by whoever was involved, honestly, right after it happens: did anyone have to call or message anyone to make this `WorkOrder` move forward? |
| MOVOS steps completed                  | Which of: created, assigned, started, arrival confirmed, diagnosis recorded, intervention recorded, validation recorded, resolved — read directly off the real event timeline                                                    |
| Failures/confusion                     | Free text — anything that didn't work, wasn't clear, or needed a workaround. This is the single most valuable field in this whole document                                                                                       |
| Final outcome                          | Resolved as expected / resolved with a workaround / not resolved through MOVOS at all                                                                                                                                            |

## Template (copy per WorkOrder)

```
WorkOrder #___
Source/problem:
Detection timestamp:
Assignment timestamp:
Technician start timestamp:
Resolution timestamp:
Operator involved:
Technician involved:
External/manual communication required:
MOVOS steps completed:
Failures/confusion:
Final outcome:
```

## What this protocol does not do

It does not set a deadline, does not require all 5 to look the same, and does not penalize a `WorkOrder` that needed a manual workaround — that outcome is itself the evidence `docs/pilot/PILOT_SUCCESS_CRITERIA.md` will weigh. Fill this in as the pilot happens, not backfilled from memory afterward — the closer to real time, the more trustworthy the record.
