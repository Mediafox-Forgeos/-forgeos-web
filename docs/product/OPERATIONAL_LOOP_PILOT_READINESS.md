# Operational Loop Pilot Readiness

**Work order:** WO-ARGOS-038 (Operational Loop Pilot Hardening)
**Scope:** evaluates only the operator → technician → resolution loop this and the two preceding work orders (WO-ARGOS-035, WO-ARGOS-037) built — not MOVOS as a whole.
**Method:** every claim below was verified, not assumed — real database, real authorization boundaries, real browser sessions for both roles, and the exact reproduction scenario from `docs/product/OPERATIONAL_LOOP_CHECKPOINT.md` re-run against the fixed code. Screenshots in `docs/product/screenshots-pilot-hardening-validation/`.

## What changed since the checkpoint

`OPERATIONAL_LOOP_CHECKPOINT.md` found exactly 1 BLOCKER, 1 HIGH, and 2 MEDIUM findings. All four were addressed:

| #   | Finding                                                                              | Severity | Resolution                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | No UI path to assign a `WorkOrder` to anyone but yourself                            | BLOCKER  | New `GET /work-orders/assignable-technicians` (ACTIVE `TECHNICIAN` memberships, org-scoped, role-gated) + a real picker on `/work-orders/[id]`, wired to the existing `assign` transition — no new assignment capability invented, only exposed                                                                     |
| 2   | Resolving a `WorkOrder` could produce a duplicate for the same still-offline station | HIGH     | `WorkOrderAutomationService`'s idempotency check now compares against `ChargingStation.lastDisconnectedAt` (a genuine, single-writer transition timestamp) instead of `WorkOrder.status` — one continuous offline episode can now only ever produce one `WorkOrder`, regardless of that `WorkOrder`'s own status    |
| 3   | Operator's timeline didn't understand the 4 checklist event types                    | MEDIUM   | Extracted one shared `WorkOrderEventTimeline` component, used by both `/work-orders/[id]` and `/my-work/[id]` — one canonical rendering, not two that can drift again                                                                                                                                               |
| 4   | A technician's note could silently contradict the system's own captured evidence     | MEDIUM   | The same shared component now renders the real, server-computed station snapshot next to diagnosis/validation notes on **both** pages — the contradiction is visible, not fabricated away, and never blocks resolution (a `WorkOrder` resolution is a human attestation, never a claim about physical device state) |

## A. Objective 1 — assignee picker, verified

- Eligibility list is scoped to ACTIVE `MemberRole.TECHNICIAN` memberships in the caller's own organization — verified via `work-order-assignment.e2e-spec.ts` to correctly exclude a suspended technician and a technician from a different organization.
- The endpoint and the `assign` transition itself both remain behind the existing `@Roles()`/`OrgContextGuard` stack — a `TECHNICIAN` cannot call either (403, verified).
- Verified live in a real browser (`02-operator-detail-assigned-via-picker.png`): operator selects "Camilo Restrepo" from the dropdown, clicks "Asignar técnico," the `WorkOrder` moves to `ASSIGNED`, and the assignment appears in `/my-work` for that technician within one poll cycle (`03-technician-my-work-shows-assignment.png`) with no re-authentication.

## B. Objective 2 — duplicate prevention, verified

- New invariant: a `CONNECTIVITY_LOSS` `WorkOrder` already covers the station's current offline episode if one exists with `createdAt >= station.lastDisconnectedAt`, regardless of status. `lastDisconnectedAt` is written in exactly one place in this codebase (`ConnectivityCoordinator.handleConnectionClosed`), only on a genuine disconnect transition — never re-stamped while already offline, never touched by a reconnect.
- 7 new unit tests (`work-order-automation.service.spec.ts`) and 4 new real-database e2e tests (`work-order-automation.e2e-spec.ts`), including the exact regression case ("resolving while still offline must not create a duplicate") and the exact recovery case ("reconnect then a genuinely new loss must become eligible").
- Verified live against the real 60-second sweep, not just the test suite: created a real offline station, let the real automation create one `WorkOrder`, resolved it while the station remained genuinely offline, and watched **three consecutive real sweep cycles** (~3 minutes of real wall-clock time) confirm the count stayed at exactly 1. Then reconnected the station for real, disconnected it again, and watched the real automation create a second, distinct `WorkOrder` — `06-operator-list-resolved-plus-new-episode.png` shows both side by side: one `Resuelta` (2 hours old), one `Abierta` (18 minutes old), correctly not conflated.

## C. Objective 3 — timeline parity, verified

`05-operator-detail-canonical-timeline.png` shows the operator's `/work-orders/[id]` rendering real Spanish labels ("Diagnóstico registrado," "Intervención registrada," "Validación registrada") and the real detail text the technician entered — identical to what `/my-work/[id]` has always shown, because both pages now render the exact same `WorkOrderEventTimeline` component over the exact same `WorkOrderEvent` data. No second history model was created.

## D. Objective 4 — honest snapshot visibility, verified

Same screenshot shows, directly beneath the diagnosis and validation entries: "Estado real de la estación en ese momento: Desconectado" — the live, server-computed connectivity state at the moment each event was recorded, sourced from the same never-client-trusted `stationSnapshot` `MyWorkService` already computed in WO-ARGOS-037 and simply never displayed until now. This is visible to **both** the operator and the technician, on both pages, for every diagnosis/validation event. Nothing was invented to make a resolved `WorkOrder` imply the station itself recovered — the real state sits right next to whatever was claimed, honestly, and resolution remains ungated by it (per instruction).

## E. Security validation

16 new tests, all passing against a real database:

- `work-order-assignment.e2e-spec.ts` (6 tests): eligible-technician list correctly scoped by org and ACTIVE status; a technician cannot list technicians or assign anything (403); an operator can assign an eligible technician; an operator cannot assign a member from a different organization (400); an operator cannot assign a suspended member (400).
- `work-order-automation.e2e-spec.ts` (4 tests): exactly one `WorkOrder` per episode; repeated sweeps don't duplicate; resolving mid-episode doesn't trigger a duplicate; a genuinely new episode is eligible.
- `work-order-automation.service.spec.ts` (7 unit tests): the same invariant unit-tested with full control over timestamps, including the exact regression scenario.
- Every WO-ARGOS-037 security guarantee re-verified unchanged: technician self-scoping, cross-org isolation, invalid-transition rejection, immediate access loss on membership revocation (`technician-isolation.e2e-spec.ts`, still 11/11 passing).

## F. Test results

- Backend unit: **337/337 passing** (36 suites)
- Backend e2e, real PostgreSQL: **43/43 passing** (6 suites)
- Backend typecheck: clean
- Frontend typecheck: clean
- Frontend production build: clean
- No regressions in any pre-existing suite

## G. Complete end-to-end validation

Exercised on real, main-compatible code with two separately authenticated real browser sessions:

1. A real station forced offline; the real 60-second automation sweep created exactly one `WorkOrder` — verified by direct database query, not assumed.
2. Operator opened it and assigned it to an eligible technician **through the new picker** — no API shortcuts.
3. Technician logged in, saw the assignment on `/my-work` without any manual refresh, opened it, started work, recorded all four checklist stages, and resolved it — entirely inside MOVOS.
4. Operator observed the complete canonical timeline, with real labels, real detail text, and the real (honest) station snapshot, indistinguishable in structure from what the technician saw.
5. With the station still genuinely offline, three real sweep cycles (~3 minutes) confirmed no duplicate `WorkOrder` was created.
6. The station was then genuinely reconnected and disconnected again; the next real sweep correctly created a second, distinct `WorkOrder` for the new episode.

Every step used real authorization boundaries — no test-only bypass, no mocked identity.

## H. Remaining findings

No BLOCKER or HIGH findings remain in this loop.

**MEDIUM:** none new. The two MEDIUM findings from the checkpoint are resolved (C, D above).

**LOW (pre-existing, explicitly out of this work order's scope, does not invalidate the pilot):**

- `WorkOrderController`'s `assign` transition (and every other write route) still permits every `OPERATOR_FACING_ROLES` member, including `VIEWER` — a gap first named in WO-ARGOS-034, never in scope to fix in WO-ARGOS-035/037/038. A pilot's `VIEWER` users are expected to be read-only stakeholders; this is a role-granularity hardening item for a future pass, not a blocker for a small pilot.
- The assignee picker only lists `TECHNICIAN`-role members, matching this work order's explicit instruction ("technician role/policy"). An operator can still self-assign via the separate "Asignarme" control, unchanged.
- SLA/`dueAt`, notifications, photo/file evidence, routing, technician availability, incident abstraction, customer-originated reports — all evaluated already in `OPERATIONAL_LOOP_CHECKPOINT.md` section D and explicitly excluded from this work order's scope. That evaluation stands unchanged: none are required for a credible pilot at small scale; each has a workable manual fallback.
- A `WorkOrder` resolution is, and will remain, a human attestation — MOVOS cannot and does not force the physical station to reconnect. This is now honestly surfaced (D above) rather than hidden, but it is a permanent characteristic of what a software platform can validate, not a defect.

## I. Pilot-readiness verdict

**PILOT_READY.**

- No BLOCKER findings. ✓
- No HIGH findings. ✓
- Operator can assign without external tooling — the picker is real, tested, and verified live. ✓
- Technician can execute without external tooling — unchanged, still real and verified live. ✓
- Shared operational history is coherent — one canonical timeline component, verified identical on both actors' screens. ✓
- Duplicate `WorkOrder`s cannot arise from one continuous connectivity-loss condition — verified by unit test, real-database e2e test, and three real 60-second sweep cycles against a live, unresolved offline station. ✓
- Organization/role boundaries remain enforced — verified by 6 new e2e tests plus the 11 pre-existing technician-isolation tests, all passing. ✓
- Remaining limitations are explicitly documented (H above) and are either pre-existing, out-of-scope, or permanent characteristics of the platform — none invalidate a small, business-hours pilot with a handful of technicians.
