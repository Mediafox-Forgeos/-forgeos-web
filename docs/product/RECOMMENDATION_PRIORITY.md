# Recommendation Priority Taxonomy

**Work order:** WO-ARGOS-024 (Operational Recommendation Discovery)
**Status:** PRODUCT DISCOVERY. Classification only.
**Built from:** [RECOMMENDATION_CATALOG.md](./RECOMMENDATION_CATALOG.md)'s 20 recommendations.

## Two different axes — do not conflate them

This document classifies **how urgently an operator should act once a recommendation fires** — P0/P1/P2, exactly as the work order named them. This is a deliberately different question from **whether MOVOS can generate that recommendation today**, which the catalog already tagged (_Available today_ / _Needs occupancy trend_ / _Needs status-history log_).

The two axes are independent on purpose: recommendation #1 (recurring station fault) is P0-urgent _if it fires_ — a flapping connector needs a technician now — but it cannot fire at all yet, because the status-history log it depends on doesn't exist. Conflating "how urgent is this" with "can we build it this sprint" would either wrongly demote a genuinely urgent insight because it's hard to build, or wrongly promote an easy-to-build one because it happens to be available. [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md) is where the two axes are deliberately crossed to make a sequencing call — this document keeps them separate.

## P0 — Immediate action

Something is actively costing the operator money, availability, or trust _right now_; the expected response is same-day, not scheduled.

| #   | Recommendation                               |
| --- | -------------------------------------------- |
| 1   | Recurring station fault (flapping connector) |
| 6   | Suspicious session interruption pattern      |
| 7   | Energy delivery anomaly within a session     |
| 8   | Idle connector after session completion      |
| 9   | Authorization failure spike                  |

**Why these five:** each describes a condition that is either actively happening (#7, #8 — a session degrading or a connector stuck right now) or has already crossed a threshold that, by definition, means the problem has recurred enough times to no longer be noise (#1, #6, #9). None of these are "worth knowing eventually" — they are "worth knowing before the next affected driver shows up."

## P1 — Optimization

Real, valuable, worth acting on within the week or the next maintenance cycle — but nothing breaks further by waiting a few days.

| #   | Recommendation                               |
| --- | -------------------------------------------- |
| 2   | Unusual disconnect pattern                   |
| 3   | Overloaded station                           |
| 4   | Low utilization                              |
| 5   | Occupancy spike (recurring peak)             |
| 11  | Comparative underperformance vs. peers       |
| 12  | Congestion redistribution                    |
| 14  | Connector-type demand mismatch               |
| 16  | Firmware/protocol version outlier            |
| 17  | Credential nearing expiry, high recent usage |
| 18  | Site connectivity degradation trend          |
| 20  | Efficiency drift (predictive maintenance)    |

**Why these eleven:** each is a genuine, actionable signal, but the action is a scheduling decision (dispatch a technician this week, not tonight; rebalance pricing next cycle; renew a credential before its expiry date, which is itself the natural deadline) rather than a same-day response. #20 (efficiency drift) sits here specifically _because_ it's a leading indicator of a future #1 or #7 — the entire point of catching it here is that it hasn't become urgent yet.

## P2 — Strategic insights

Correct, valuable, and reviewed on a planning cadence (monthly/quarterly) rather than acted on individually.

| #   | Recommendation                  |
| --- | ------------------------------- |
| 10  | Station approaching end-of-life |
| 13  | Seasonal/trend demand pattern   |
| 15  | Peak/off-peak pricing signal    |
| 19  | Idle fleet-wide capacity window |

**Why these four:** each feeds a decision with its own separate planning cycle that isn't MOVOS's to make — a capital budget (#10), a staffing/marketing calendar (#13, #19), or a future Tariffs design (#15, Architecture Backlog #24). MOVOS's job here is to have the evidence ready when that cycle comes around, not to prompt an out-of-cycle response.

## Reading the two axes together

|        | Available today                  | Needs occupancy trend  | Needs status-history log |
| ------ | -------------------------------- | ---------------------- | ------------------------ |
| **P0** | #6, #7, #8, #9 (4 of 5)          | —                      | #1 (1 of 5)              |
| **P1** | #4, #11, #14, #17, #20 (5 of 11) | #3, #5, #12* (3 of 11) | #2, #16*, #18 (3 of 11)  |
| **P2** | #13, #15, #19 (3 of 4)           | —                      | #10 (1 of 4)             |

*#12 and #16 are the two "mixed" entries from the catalog — counted once here under their more-blocked half.

The concentration is not evenly spread: **P0 is 4/5 buildable today**, and the one P0 exception (#1) is the single sharpest argument in this whole discovery for prioritizing the status-history log, independent of which Sprint 2 path ARGOS chooses — see [RECOMMENDATION_STRATEGY.md](./RECOMMENDATION_STRATEGY.md).
