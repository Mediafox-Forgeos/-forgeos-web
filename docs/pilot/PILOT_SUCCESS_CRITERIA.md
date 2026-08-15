# Pilot Success Criteria

**Work order:** WO-ARGOS-041
**Status:** a decision **framework** for the review checkpoint after 5 real resolved `WorkOrder`s (`docs/pilot/FIVE_WORK_ORDER_PROTOCOL.md`). **The pilot has not happened yet — no verdict is issued in this document.**

## A. Closed loop

Evaluate, from the 5 evidence write-ups (`PILOT_EVIDENCE_TEMPLATE.md`): for each `WorkOrder`, did `Problem → Assignment → Technician execution → Resolution → Operator visibility` complete entirely inside MOVOS, or did any link in that chain require stepping outside it? A single `WorkOrder` requiring a phone call to get assigned is different from all 5 requiring one — count both the rate and the specific link that broke, not just a yes/no per item.

## B. Platform dependence

For each `WorkOrder`, count the essential steps that required leaving MOVOS (from `FIVE_WORK_ORDER_PROTOCOL.md`'s "external/manual communication required" field), then classify the pattern:

- **ACCEPTABLE_MANUAL_PROCESS** — a step already known and named before the pilot started (`docs/pilot/PILOT_RISK_REGISTER.md`'s "no notifications" gap, for instance) that happened roughly as expected and didn't block anything.
- **PRODUCT_FRICTION** — a step that worked but was clunky, confusing, or slower than it should have been, and would be worth fixing, but didn't stop the loop from closing.
- **PILOT_FAILURE** — a step where MOVOS itself was the obstacle: an error, a dead end, a boundary that shouldn't have existed, something that forced the `WorkOrder` to be finished entirely outside the system.

A pilot with only the first category is a strong result. Any instance of the third category is the single most important thing to review in detail.

## C. Operational clarity

For each `WorkOrder`, from the operator's and technician's own observations: could each of them tell, without asking anyone else, **what happened, who owned it, what to do next, and whether it was resolved**? If either person ever had to guess, ask a third party, or double-check outside MOVOS to answer one of those four questions, that's a real clarity gap — record which question and why.

## D. Reliability

Tally, across all 5: real errors, access failures, authorization failures, broken workflows, data inconsistencies (a note that doesn't match a timestamp, an event that doesn't appear where expected). Zero is the bar this software has already cleared in every automated test and every prior live validation (WO-ARGOS-037 through WO-ARGOS-040) — a real pilot with real people is the first time it's tested under conditions this engagement doesn't fully control, so this section matters even if the number is small.

## E. Value

After `WorkOrder` #5, answer directly: **did MOVOS make coordination materially clearer, faster, or more traceable than the existing operating method** (the phone call/spreadsheet status quo `docs/operations/TECHNICIAN_WORKFLOW.md` and others already described)? Not "is it a complete product" — specifically, is the one loop it implements better than what existed before it.

## Verdict framework (for the review checkpoint, not now)

- **VALIDATED** — the loop closed inside MOVOS for all or nearly all 5, no `PILOT_FAILURE`-classified friction, operational clarity held for both people, reliability was clean, and the answer to E is a clear yes.
- **VALIDATED_WITH_GAPS** — the loop worked and closed, value was real, but one or more concrete `PRODUCT_FRICTION` or clarity gaps were found — worth naming specifically, not worth treating as disqualifying.
- **NOT_VALIDATED** — any `PILOT_FAILURE`-classified breakdown, a clarity failure either person couldn't resolve on their own, or the honest answer to E is "no better than before."

This framework is the instrument. The 5 real write-ups are the measurement. Neither exists yet.
