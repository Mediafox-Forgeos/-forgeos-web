# Pilot Provisioning Runbook

**Work order:** WO-ARGOS-041
**Status:** every mechanism below was proven live in WO-ARGOS-040's controlled production test (real site, real station, real technician, real memberships, real credentials, real login) — this is not a theoretical procedure. No onboarding UI was built; every step is deliberately manual, per instruction.
**Prerequisite:** the real inputs identified as `NEEDS_REAL_INPUT` in `docs/pilot/PILOT_INSTANCE_PLAN.md` — this runbook cannot be executed to completion without them.

## 1. Organization provisioning

- **Who:** Technical lead
- **Mechanism:** Database — no `POST /organizations` exists. Either confirm the existing "Kylum Energy" organization (`kylum-energy`) is the pilot organization, or create a new one via a one-off Prisma script (`prisma.organization.create`)
- **Required input:** Decision from ARGOS on which organization to use; if new, its real name
- **Expected result:** Exactly one `Organization` row, `status: ACTIVE`
- **Verification:** `prisma.organization.findMany()` returns exactly the intended row

## 2. User provisioning

- **Who:** Technical lead
- **Mechanism:** Database — no signup/invite endpoint exists. `prisma.user.create()` with a `bcrypt`-hashed password (12 rounds, matching every existing user in this system)
- **Required input:** Real email and display name for the operator (if different from the existing account) and the technician
- **Expected result:** One `User` row per real person, `status: ACTIVE`
- **Verification:** `prisma.user.findUnique({ where: { email } })` resolves

## 3. Membership creation

- **Who:** Technical lead
- **Mechanism:** Database — `prisma.membership.create()`, linking each `User` to the pilot `Organization`
- **Required input:** The `User` and `Organization` ids from steps 1–2
- **Expected result:** One `Membership` row per person, `status: ACTIVE`
- **Verification:** `prisma.membership.findUnique({ where: { userId_organizationId } })` resolves

## 4. Role assignment

- **Who:** Technical lead
- **Mechanism:** Set directly on the `Membership` row created in step 3 — `role: OPERATOR` (or `OWNER`/`ADMIN`, which have identical `WorkOrder` access) for the operator, `role: TECHNICIAN` for the technician
- **Required input:** None beyond step 3
- **Expected result:** Each `Membership.role` set correctly
- **Verification:** Re-query the `Membership` row and confirm `role`

## 5. Site provisioning

- **Who:** The operator, once logged in — **the one fully self-service step in this entire runbook**
- **Mechanism:** Real UI — `/sites` → "Nueva sede" modal → `POST /sites`
- **Required input:** The real site's name, city, and address (or confirmation of an existing site to reuse)
- **Expected result:** One real `Site` row
- **Verification:** The site appears on `/sites` immediately; confirm via `GET /sites`

## 6. Station provisioning

- **Who:** Technical lead
- **Mechanism:** Direct API call (no UI exists) — `POST /sites/:siteId/charging-stations` with an `OWNER`/`ADMIN` bearer token
- **Required input:** 2–3 real station names/identifiers
- **Expected result:** 2–3 `ChargingStation` rows under the pilot site
- **Verification:** `GET /sites/:siteId/charging-stations` returns them; each is visible from `/work-orders`' station picker

## 7. Credential setup

- **Who:** Technical lead, then the pilot supervisor for delivery
- **Mechanism:** Passwords are set at `User` creation (step 2) — generated once, used to log in immediately to confirm, then communicated to the real operator and technician through a real, secure channel (verbally, or via whatever secure channel the pilot supervisor already uses with them). **No email/invite system exists** — this is intentionally manual, matching a two-person pilot's actual needs
- **Required input:** A real, secure channel to each real person
- **Expected result:** Both people can log in with credentials only they and the technical lead know
- **Verification:** Step 8/9 below

## 8. Operator access verification

- **Who:** Technical lead (dry run), then the real operator
- **Mechanism:** Log in at `https://movos-web.vercel.app/login`, land on `/dashboard`, navigate to `/work-orders`
- **Required input:** Operator credentials from step 7
- **Expected result:** Real login succeeds; `/work-orders` loads (empty until the first real problem); the operator's own organization and role are correct
- **Verification:** `GET /auth/me` returns the expected user/org/role; visually confirm `/work-orders` renders

## 9. Technician access verification

- **Who:** Technical lead (dry run), then the real technician
- **Mechanism:** Log in — a `TECHNICIAN` membership routes straight to `/my-work` (no manual navigation needed)
- **Required input:** Technician credentials from step 7
- **Expected result:** Real login succeeds; `/my-work` loads, empty until something is assigned; the technician cannot reach any operator-facing route
- **Verification:** `GET /auth/me` correct; attempt `GET /work-orders` directly and confirm `403`

## 10. Final pre-pilot smoke test

- **Who:** Technical lead, with both real accounts already provisioned
- **Mechanism:** Exactly the controlled closed-loop test already proven in WO-ARGOS-040 (`docs/pilot/PILOT_ENVIRONMENT_BASELINE.md`), but using the real operator and technician accounts instead of throwaway test ones, and a real (not `[TEST]`-marked) `WorkOrder` if the pilot org and supervisor agree the first real problem can serve as this proof — otherwise, one clearly-marked dry run, cleaned up afterward the same way WO-ARGOS-041 (this work order) just cleaned up WO-ARGOS-040's
- **Required input:** Nothing beyond steps 1–9 completed
- **Expected result:** A `WorkOrder` created → assigned via the real picker → started → checklisted → resolved → visible in the operator's canonical timeline, all by the real people, once
- **Verification:** The same checks used throughout this engagement — `GET /work-orders/:id/events` shows the complete real history, attributed to the real accounts

## After this runbook completes

The pilot is provisioned. `docs/pilot/OPERATOR_PILOT_PLAYBOOK.md` and `docs/pilot/TECHNICIAN_PILOT_PLAYBOOK.md` take over from here — this runbook's job ends the moment both real people can log in and see their real screen.
