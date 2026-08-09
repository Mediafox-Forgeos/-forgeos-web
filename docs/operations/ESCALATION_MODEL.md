# Escalation Model

**Work order:** WO-ARGOS-034 (Operational Actors & Responsibility Model)
**Status:** DOMAIN DISCOVERY. No code, frontend, backend, migration, or API change.
**Mission:** escalation levels, SLA ownership, reassignment rules, and emergency protocols — who owns a problem when the normal path isn't fast enough.

## Escalation levels, mapped to the real role hierarchy

`MemberRole`'s own declared order (`OWNER`, `ADMIN`, `OPERATOR`, `SUPPORT`, `ANALYST`, `VIEWER`) already implies a seniority structure MOVOS has never made operationally explicit. This document proposes reading it that way rather than inventing a parallel one:

| Level  | Actor                                                                                            | When reached                                                                                                                                                                                                                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L1** | Network Operator / Dispatcher                                                                    | The default level — every case starts and, in the large majority, ends here                                                                                                                                                                                                                                         |
| **L2** | Operations Manager (`ADMIN`)                                                                     | An SLA is at risk or breached ([WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) Rule 3), a `CRITICAL`-priority case sits unassigned past its grace period (Rule 2), or an L1 actor explicitly asks for help (a technician reports something outside their skill set, a customer complaint L1 can't resolve) |
| **L3** | Organization Owner, or an external party (the device manufacturer, a utility, a roaming partner) | An L2 actor cannot resolve it internally at all — a genuine outage affecting multiple sites, a legal/safety matter, or a hardware failure requiring manufacturer support                                                                                                                                            |

This is deliberately a three-level model, not a deeper one — [OPERATIONAL_ACTORS.md](./OPERATIONAL_ACTORS.md) already found that Dispatcher and Operator are the same real account at current scale; a five-or-six-level escalation ladder would describe an organizational structure no real MOVOS customer has evidence of needing yet.

## SLA ownership

Three distinct facts, each owned by a different actor, and conflating them is the single most common way an SLA model goes wrong in practice:

- **Who sets the SLA target** (`slaMinutes` per priority) — the Operations Manager. [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)'s proposed defaults (120/480/1440/4320 minutes) are explicitly a starting proposal, not a fixed fact, because tuning them is this actor's real job, not a value baked into the product.
- **Who is accountable for hitting it** — the assigned Field Technician, in the sense that they're doing the physical work the clock is measuring — but see below, since they have no visibility into the clock at all.
- **Who is accountable for _tracking_ it** — the Network Operator/Dispatcher who made the assignment, since they're the only actor with product access to the SLA timer in the first place. This is a real, structural asymmetry worth naming plainly: the person the SLA clock is measuring (the technician) cannot see it, and the person who can see it (the operator) isn't the one doing the timed work. Every SLA breach in this model is, in a real sense, a communication failure between these two actors before it's anything else — which is exactly why [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #1 (technician dispatch/visibility) and this escalation model are the same underlying problem seen from two angles.

## Reassignment rules

A `WorkOrder` moves to a different technician (via `unassign` then `assign` again — [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)) under three real conditions:

1. **Availability conflict** — the assigned `Technician.availability` becomes `UNAVAILABLE` or `OFF_SHIFT` before the work starts. Detectable today only because [TECHNICIAN_MODEL.md](./TECHNICIAN_MODEL.md) makes `availability` a real, queryable field, not because anything automatically checks it — reassignment remains an operator decision, not a system-triggered one, matching [WORK_ORDER_STATES.md](./WORK_ORDER_STATES.md)'s own "soft-checked, not hard-blocked" assignment philosophy.
2. **Skill mismatch discovered mid-job** — the technician arrives and determines the problem is outside their `skills`. Reported by phone, logged as a `block` transition with a note, then reassigned — the same manual bridge [FIVE_MINUTE_OPERATOR_SIMULATION.md](../product/FIVE_MINUTE_OPERATOR_SIMULATION.md) already found for every other technician-to-product information flow.
3. **SLA-driven reassignment** — an L2 escalation (Operations Manager) decides the current technician is too far from breaching to make it, and reassigns to whoever's actually available, prioritizing the deadline over continuity.

None of these are proposed as automated rules in this document — [WORK_ORDER_AUTOMATIONS.md](./WORK_ORDER_AUTOMATIONS.md) already defined the three automation rules this sprint's predecessor authorized, and reassignment logic wasn't among them. Automating reassignment is a plausible future rule, not one this document adds unilaterally.

## Emergency protocols

**The honest ceiling on this section:** an "emergency protocol" implies someone gets reached urgently, regardless of whether they're looking at MOVOS at that moment. [PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6 already found that no such channel exists — the console's notification bell is in-app only. Everything below describes the _decision_ structure for an emergency; none of it describes a mechanism that reaches anyone who isn't already logged in, because that mechanism doesn't exist yet.

- **What qualifies:** a `CRITICAL`-priority `WorkOrder` (or a station-down condition affecting a large share of a site's capacity) that has bypassed the normal L1 triage entirely — the case is severe enough that it should reach an Operations Manager (L2) immediately, not wait for the normal SLA-breach escalation path.
- **What happens today, honestly:** the same thing [OPERATOR_DAY_MAP.md](../product/OPERATOR_DAY_MAP.md) already found happens for every after-hours event — a phone call. There is no in-product emergency path faster than the normal `Action`/`WorkOrder` flow, because urgency inside the product doesn't yet translate into urgency reaching a person.
- **What this model recommends once notification delivery exists:** a `CRITICAL` priority should skip the normal escalation ladder's timing and page an Operations Manager (L2) directly on creation, not wait for an SLA breach at L1 first — the one place this document recommends a genuinely different rule shape from the graduated levels above, because a true emergency shouldn't wait through a tier it's already known to exceed.

## What this model depends on that isn't built yet

Every real mechanism in this document — SLA tracking, reassignment, true emergency paging — ultimately depends on two things this sprint didn't build and isn't authorized to: `WorkOrder` itself (WO-ARGOS-033, designed, not implemented) and notification delivery ([PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6, not designed at all yet). This document describes the _decision structure_ those two prerequisites would run on, so that when either is built, the roles and rules around it don't have to be invented from scratch under time pressure.
