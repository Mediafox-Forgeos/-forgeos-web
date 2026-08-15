# Operational Pilot V1

**Work order:** WO-ARGOS-039 (Operational Pilot Baseline & Real-World Pilot Definition)
**Baseline:** `OPERATIONAL_LOOP_V1_PILOT_READY` tag, `main` at `4d6e575`
**Status:** Documentation and inspection only — no code, schema, or API changed to produce this document or the rest of `docs/pilot/`.

## The one scoping decision everything else follows from

The operational loop this pilot tests has **three ways a `WorkOrder` comes into existence**: manual creation by an operator, a button on a `HIGH`-severity recommendation, and fully-automatic creation when a station's real connectivity data shows it offline for 15+ minutes (Rule 1). Only the third depends on live OCPP device connectivity — and that dependency is not yet credible for a real pilot: MOVOS's OCPP engine has only ever reached `SIMULATOR_VALIDATED` (see `docs/engineering/OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md`), no physical charger has ever connected to it, and `docs/product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md` — the questionnaire that would tell us what hardware the actual pilot customer even runs — is still unanswered.

**This pilot is therefore scoped around manual and recommendation-triggered `WorkOrder`s as the primary, required path.** Automatic connectivity-loss detection (Rule 1) is real, tested, and welcome to run in the background — if a real charger happens to be connected, or if MOVOS's own OCPP simulator (`apps/movos-api/simulator/`) is used to exercise it — but it is **not a requirement for pilot success**, because requiring it would make the pilot's outcome depend on an unvalidated, out-of-this-work-order's-control variable (real hardware behavior) rather than on the software this engagement actually built and verified.

## WHO

| Role                 | Real MOVOS role                                                                       | Who fills it                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Operator**         | `MemberRole.OPERATOR` (or `OWNER`/`ADMIN`, which have the same `/work-orders` access) | A real person at the pilot organization responsible for noticing a problem and dispatching it — the dispatcher role `docs/operations/OPERATIONAL_ACTORS.md` already mapped                                                        |
| **Technician**       | `MemberRole.TECHNICIAN`                                                               | A real field technician who will physically act on assigned work                                                                                                                                                                  |
| **Pilot supervisor** | `MemberRole.OWNER` (practically, whoever holds the seeded admin account)              | Whoever provisions the organization, sites, stations, and the operator/technician accounts before the pilot starts — necessarily technical, since none of that provisioning has a UI yet (see `PILOT_ONBOARDING_REQUIREMENTS.md`) |

**Permissions each requires**, exactly as already enforced in code, nothing assumed:

- **Operator**: an ACTIVE `Membership` with role `OWNER`/`ADMIN`/`OPERATOR` in the pilot organization. Gains: `/work-orders` (list, detail, create, transition, assignable-technicians), `/charging-stations`, `/sites` reads. Cannot self-provision — someone with `OWNER`/`ADMIN` and API access must create this membership before the pilot starts.
- **Technician**: an ACTIVE `Membership` with role `TECHNICIAN`. Gains only `/my-work` and its own assigned `WorkOrder`s — verified self-scoped in `technician-isolation.e2e-spec.ts`. Cannot see or touch anything else in MOVOS.
- **Pilot supervisor**: needs `OWNER` (the only role that can provision OCPP credentials, per `ocpp-provisioning.controller.ts`'s `@Roles(OWNER, ADMIN)`) plus, in practice, direct database or Railway CLI access, since organization/user/membership/station creation has no UI or self-service API today (see `PILOT_ONBOARDING_REQUIREMENTS.md` for the full, verified list).

## WHAT

**Exact workflow under test:** the same loop validated live in WO-ARGOS-038 —

`WorkOrder exists (manual or recommendation-triggered) → operator assigns an eligible technician via the real picker → technician authenticates → /my-work shows the assignment → technician opens it, starts work, records checklist evidence, resolves it → operator observes the complete, real, canonical history.`

**What begins the workflow:** an operator, looking at a real MOVOS station and a real problem (something they'd otherwise handle by phone or spreadsheet today), clicks "Nueva orden de trabajo" on `/work-orders` and describes it. This is the one workflow entry point that requires nothing beyond what's already fully built, tested, and running — no hardware dependency, no unproven capability.

**What constitutes successful completion:** a `WorkOrder` reaches `RESOLVED` with a real resolution note, having passed through a real assignment and at least a `start` transition performed by the assigned technician — i.e., the loop closed end to end, by a real technician, without anyone needing to fall back to a phone call or a spreadsheet to actually get the work assigned or confirmed done.

**Deliberately outside this pilot** (per WO-ARGOS-038's own constraints, still in force): SLA/due dates, notifications, photo/file evidence, GPS/routing, technician availability scheduling, billing, customer-originated reports, any new UI or capability. Also outside this pilot specifically: proving OCPP hardware compatibility (a separate, already-named, unstarted piece of work — see `KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md`) and relying on Rule 1's automatic detection as the pilot's primary evidence source, for the reason stated above.

## WHERE

- **Sites:** 1 is sufficient. The `WorkOrder` loop operates per-station, not per-site; a second site adds no new evidence about whether the loop itself works, only about `Site` CRUD, which is already a mature, separately-verified module.
- **Stations:** 2–3 minimum — one is enough to prove the mechanics, but a technician needs more than one real assigned item to test that `/my-work`'s prioritization and multi-item handling behave sensibly, and an operator needs more than one open item to confirm `/work-orders` filtering is actually useful rather than trivially empty.
- **Connectors/EVSEs:** not required by the loop at all. `WorkOrder.stationId` points at `ChargingStation` directly — `Evse`/`Connector` rows exist in the schema for other MOVOS capabilities (sessions, OCPP) but the operational loop never reads them.
- **Real charger connectivity:** **not required**, per the scoping decision above. The pilot's required path (manual `WorkOrder` creation) needs a `ChargingStation` row to exist — it does not need that station to ever have spoken OCPP to anything.
- **Existing integration/data prerequisites that must be true:** a real `Organization`, at least one `OWNER`/`ADMIN` membership, at least one `TECHNICIAN` membership, and 2–3 `ChargingStation` rows under one `Site` — all created before pilot day, by the process documented in `PILOT_ONBOARDING_REQUIREMENTS.md` (none of it self-service today).

## WHEN

No commercial or arbitrary calendar dates are assumed here — durations below are sized to the minimum needed to generate real operational evidence, for ARGOS to schedule against an actual calendar.

| Phase                        | Minimum duration                                                                                                                                                                                                               | What it's for                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Preparation**              | However long it takes to complete every item in `PILOT_ONBOARDING_REQUIREMENTS.md` once (organization, memberships, stations, OCPP secrets if used) — a few hours of hands-on work for one technical person, not a project     | Get the organization, its two real users, and its stations into a real, pilot-ready state                                                                                    |
| **Onboarding**               | One session per participant                                                                                                                                                                                                    | Operator and technician each log in for the first time, are shown their respective screen (`/work-orders`, `/my-work`), and complete one supervised dry-run `WorkOrder` each |
| **Observation**              | At minimum enough real days for **5 real `WorkOrder`s to reach `RESOLVED`** through the full loop — not a fixed number of calendar days, since a quiet pilot org might take longer to generate 5 real problems than a busy one | The actual evidence-generation period; see `PILOT_MEASUREMENT_PLAN.md` for what gets measured during it                                                                      |
| **Review checkpoint**        | One session, after the 5th resolution (or after a pre-agreed maximum elapsed time, whichever comes first, so a quiet pilot doesn't run forever)                                                                                | Walk through `PILOT_MEASUREMENT_PLAN.md`'s evidence with the operator and technician directly — what worked, what needed a workaround, what they'd want next                 |
| **Success/failure decision** | Made at the review checkpoint, by ARGOS, from the evidence gathered — not predetermined here                                                                                                                                   | Decide whether to continue, expand, or stop the pilot                                                                                                                        |

Five resolved `WorkOrder`s is the minimum, not a target: it's the smallest number that shows the loop working more than once (ruling out a one-off fluke) while staying achievable in a small pilot's realistic volume.
