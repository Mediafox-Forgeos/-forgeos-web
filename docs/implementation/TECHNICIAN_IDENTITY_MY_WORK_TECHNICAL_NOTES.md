# Technician Identity & My Work — Technical Notes

**Work order:** WO-ARGOS-037 (Technician Identity & My Work Implementation)
**Status:** IMPLEMENTED. Real schema, real migration, real API, real UI, real security tests against a real database, real screenshots — not a prototype.
**Mission:** close the identity gap [FIELD_TECHNICIAN_CONSOLE.md](../operations/FIELD_TECHNICIAN_CONSOLE.md) (WO-ARGOS-036) named and left unresolved, and — because the identity hypothesis held up under verification — build the first real authenticated technician experience: `/my-work` and `/my-work/[id]`.

## Objective 1 — the identity model, verified

`User → Membership → MemberRole.TECHNICIAN` was checked against the real schema and auth stack, not assumed:

- **Identity/org isolation.** `OrgContextGuard` already re-validates an ACTIVE `Membership` server-side on every request (`X-Organization-Id` header or the JWT's `orgId` claim, never trusted alone) — no change needed, and no caching, so a revoked membership loses access on the very next request (verified in the e2e suite below).
- **`assignedMemberId`.** `WorkOrderService.assertAssignee()` already requires an active `Membership` in the organization, regardless of role — a `TECHNICIAN` can be assigned with zero code change. This confirms `assignedMemberId` is the correct canonical assignment identity; a separate `Technician` entity (as WO-ARGOS-033 designed but never built) is not needed.
- **DEC-022.** Its formal decision record is still unmerged, but the mechanism it documents — single active org via header/claim, re-validated per request — is already shipped and required no change for this work order.
- **The one real gap.** `WorkOrderController` had **zero `@Roles()` decorators** (confirmed by reading the controller, matching what WO-ARGOS-034/036 already flagged). Adding `TECHNICIAN` without addressing this would silently grant technicians full org-wide `WorkOrder` read/write through the existing operator routes — the opposite of Objective 2's requirement. This is the one thing this work order had to fix, not a reason to stop.

**Conclusion: hypothesis valid.** Proceeded to implementation rather than returning `BLOCKED_FOR_ARGOS_DECISION`.

## A basing decision, flagged explicitly

Work Order V1 (WO-ARGOS-035, PR #55) is **not merged into `main`** — `WorkOrder`/`WorkOrderEvent` exist only on the still-open `feat/work-order-v1` branch. Since this work order is entirely built on top of that schema, this branch (`feat/technician-identity-my-work`) is based on `feat/work-order-v1`, not `main`, and this PR's base branch is `feat/work-order-v1` accordingly. It will need a rebase (or a re-target to `main`) once PR #55 merges.

## Objective 2 — authorization boundary

Two structural choices, not one conditional bolted onto the existing controller:

1. **`WorkOrderController` locked down.** Every existing route now carries `@Roles(OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER)` — i.e., every role that already had access, minus the one new role. No other behavior changed for any existing role.
2. **`MyWorkController` — new, separate, self-scoped.** No `@Roles()` restriction at all: identity comes from the authenticated JWT + the ACTIVE `Membership` `OrgContextGuard` already re-validates, and every query additionally filters on `assignedMemberId = self`. That scoping is structural (baked into every Prisma `where` clause in `MyWorkService`), not a conditional an operator route could drift out of. Any authenticated org member can therefore see their own assigned work exactly as safely as a `TECHNICIAN` can — and never anyone else's.

A technician substituting another `workOrderId` gets the same `404` a cross-organization lookup already gets elsewhere in this codebase — existence is never revealed.

## Schema (migration `20260813070000_add_technician_role_and_checklist_events`)

Additive on top of `feat/work-order-v1`'s own migration — verified on a scratch DB (`movos_scratch_037`), then applied to `movos_dev` and `movos_test`:

- `MemberRole` gains `TECHNICIAN` (7th value — the role vocabulary anticipating a real actor before the feature existed, the same pattern [OPERATIONAL_ACTORS.md](../operations/OPERATIONAL_ACTORS.md) already found for `SUPPORT`/`ANALYST`).
- `WorkOrderEventType` gains `ARRIVAL_CONFIRMED`, `DIAGNOSIS_RECORDED`, `INTERVENTION_RECORDED`, `VALIDATION_RECORDED` — [WORK_ORDER_CHECKLISTS.md](../operations/WORK_ORDER_CHECKLISTS.md)'s design, exactly as specified: zero new tables, reusing `WorkOrderEvent.payload`.

## Backend (`apps/movos-api/src/work-orders/`)

- **`my-work.service.ts`** — `MyWorkService`. `list()`/`getOwnWorkOrder()`/`listEvents()` all filter on `assignedMemberId`; `transition()` restricts the technician-usable set to `start`/`comment`/`resolve` (no `assign`, no `cancel`) and **delegates the actual transition to `WorkOrderService.transition()`** — no second, client-side state machine, no re-implemented validation. `recordChecklistEvent()` validates the required field per stage server-side (a `finding`, a `description`, an `outcomeNote`) and, for `DIAGNOSIS_RECORDED`/`VALIDATION_RECORDED`, computes the station snapshot itself from the live `ChargingStation`/`Evse`/`Connector` rows — **never accepted from the client**, which cannot be trusted to report its own evidence.
- **`my-work.controller.ts`** — `GET /my-work`, `GET /my-work/:id`, `GET /my-work/:id/events`, `PATCH /my-work/:id`, `POST /my-work/:id/checklist-events`.
- **`work-order.controller.ts`** — the `@Roles()` lockdown described above.

## Objective 7 — security tests (mandatory, all passing against a real database)

`apps/movos-api/test/technician-isolation.e2e-spec.ts`, mirroring `tenant-isolation.e2e-spec.ts`'s real-Postgres pattern (skips cleanly without one). 11 tests, all 6 required scenarios covered:

1. A technician reads their own assigned `WorkOrder` — `200`.
2. Substituting a colleague's `WorkOrder` id (same org) — `404`, and it's absent from their own `/my-work` list too.
3. A technician from another organization, `X-Organization-Id` set to their own org — `404`. With a forged header pointing at the first technician's org — `403` from `OrgContextGuard` itself (no ACTIVE membership there).
4. A technician calling the operator-facing `GET /work-orders` at all — `403`. Attempting `assign` or `cancel` via `/my-work` — `400` (not in the allowed transition set).
5. `resolve` from `ASSIGNED` (skipping `start`) — `409`, rejected by `WorkOrderService`'s own `VALID_TRANSITIONS` map, not a separate check.
6. Suspending the technician's `Membership` mid-session blocks the very next request — `403` — no caching, matching `OrgContextGuard`'s existing DEC-022-consistent behavior.

Also: 19 new `my-work.service.spec.ts` unit tests (mock-Prisma, mirroring `work-order.service.spec.ts`'s pattern) covering ownership checks, the restricted transition set, and per-stage checklist validation including the server-computed-snapshot behavior. Full suite: **330 unit tests + 33 e2e tests, all passing.**

## Frontend (`apps/movos-web`)

- **`/my-work`** — Screen 1. A "My Day" summary strip (completed today, active tasks, average resolution time computed from real `startedAt`/`resolvedAt`, today's total) folded into the header rather than a separate route, per the mission's own two-route deliverables list. Four sections: **Overdue**, honestly empty/disabled — V1 `WorkOrder` has no `dueAt`/`slaMinutes` (a limitation named, not faked); **In progress**; **Assigned**; **Completed today** — each a client-side slice of one `GET /my-work` call, sorted by priority then age.
- **`/my-work/[id]`** — Screen 2. Station summary, incident summary, execution controls (`start`/`resolve` only), notes, the field checklist, and the same event timeline `/work-orders/[id]` renders. The checklist UI records each of the four stages via `POST /my-work/:id/checklist-events`, opportunistically requesting browser geolocation for arrival confirmation (opt-in, gracefully degrades if denied or unavailable) and leaving diagnosis/validation's station snapshot entirely server-computed. Photo/file evidence is named as unavailable — MOVOS has no upload capability anywhere in the system, called out directly in the UI rather than faked with a text field.
- **`movos-sidebar.tsx`** — a `TECHNICIAN` membership now sees a narrower nav (`Mi trabajo`, `Configuración`) instead of the full operator navigation, which would otherwise be mostly `403`s for this role. Every other role's navigation is unchanged.
- **`login/page.tsx` + `auth-context.tsx`** — login always redirected to `/dashboard` regardless of role; for a `TECHNICIAN` that would land them on a screen built entirely out of routes they can't use. `login()` now returns the raw `LoginResponse` (reading role back from context state would race the render), and the login page routes a `TECHNICIAN`'s active-org membership straight to `/my-work` instead. Every other role's redirect is unchanged.

## Product validation (real browser, real technician)

Seeded a real, login-capable technician (`tecnico@kylum.co`, dev-only, added to `prisma/seed.ts` under the existing `NODE_ENV === 'development'` guard) with one real `WorkOrder` pre-assigned in `ASSIGNED` status. Drove the complete loop through the actual UI with Playwright — login → `/my-work` → open → start → arrival confirmed → diagnosis recorded → intervention recorded → validation recorded → resolve → verified `WorkOrderEvent` history — screenshots in `docs/implementation/screenshots-my-work/`. Every timeline entry in the final screenshot is attributed to the real technician (`Camilo Restrepo`) with a real timestamp; no fabricated data anywhere in the UI.

## What this deliberately does not solve

- **SLA/due dates** — V1 `WorkOrder` still has neither; the Overdue section stays honestly disabled rather than approximating one.
- **Notification delivery** — a technician still has to check `/my-work`; nothing pushes a new assignment to them ([PRODUCT_GAPS.md](../product/PRODUCT_GAPS.md) gap #6, unchanged).
- **Photo/file evidence** — named as a real platform gap, not solved here; solving it means designing file storage for this codebase for the first time.
- **Route optimization / travel time** — `/my-work` sorts by priority and age only.
