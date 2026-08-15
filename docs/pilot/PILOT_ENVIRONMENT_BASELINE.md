# Pilot Environment Baseline

**Work order:** WO-ARGOS-040 (Pilot Environment Release)
**Date:** 2026-08-15
**Method:** every claim below is a live, verified result against the real production environment (`movos-api-production.up.railway.app`, `movos-web.vercel.app`) — not a local or staging simulation. No secret values appear anywhere in this document.

## Deployed commit

**`a22fb3caae09ea87ae80e9d53fb39b85be24acf9`** — `main`, merge of PR #60 (WO-ARGOS-039 docs). This is the exact commit both production services now run.

## Environment topology (verified, not assumed)

| Component | Platform | Project/service                                         | Verified identifier                                                                      |
| --------- | -------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| API       | Railway  | `movos-platform` → `movos-api` (production environment) | Deployment `e4bb27ba-59a0-49c2-b9f3-5f15843d36d8`, commit `a22fb3c`                      |
| Web       | Vercel   | `mediafox/movos-web`                                    | Deployment `dpl_2mV42tmqM5qNjjrf6rhe5d8og6s4`, aliased to `https://movos-web.vercel.app` |
| Database  | Railway  | `Postgres` (managed, `postgres-volume`)                 | Same instance production has always used — not replaced, not reset                       |

Both services are connected to `Mediafox-Forgeos/-forgeos-web` on GitHub but **auto-deploy is not enabled** — this release was triggered manually (`railway redeploy --from-source`, `vercel --prod`), matching the project's established, pre-existing deployment process. No architecture, build configuration, or deployment mechanism was changed to accomplish this.

## Previous deployed versions (for the record)

- API: deployment `821b71df-baca-437f-92df-519e359b559a`, live since **2026-07-15** (a commit ~2 weeks before CAP-002 even started)
- Web: deployment `dpl_Gdn8SBZSTxcAjrn88TfqkqVaXjvV`, live since **2026-07-19**

Both were confirmed stale via live `404`s on `/work-orders`, `/my-work`, `/charging-stations`, `/actions`, and `/recommendations` before this release — see `docs/pilot/PILOT_DEPENDENCY_AUDIT.md` (WO-ARGOS-039) for the original finding.

## Migration status

Before this release, production was missing all 12 migrations from `20260724120000_add_charging_core_domain` through `20260813070000_add_technician_role_and_checklist_events`. Every one was inspected before deploying:

- 11 of 12 are purely additive (new tables, columns, enums, indexes, foreign keys).
- Exactly one (`20260804024402_backfill_and_require_billing_account`) mutates existing rows — an idempotent, `WHERE`-guarded backfill. Verified before running: production had **zero** `ChargingSession` rows at migration time (the table itself didn't exist yet), so the backfill affected zero real rows.
- No `DROP`, `TRUNCATE`, or unguarded `DELETE` exists in any of the 12 migrations (grepped, not assumed).

Migrations are applied automatically by the API container's own startup command (`prisma migrate deploy && node dist/main`, baked into `apps/movos-api/Dockerfile`) — this release triggered that existing mechanism, nothing new. All 14 migrations are now applied. Verified via `prisma migrate status` against the real production database (public proxy connection) both before and after: 12 pending → 0 pending.

**Pre-existing production data was not touched.** Verified before and after: the same 1 `Organization` ("Kylum Energy"), the same 1 original `User`, the same 6 `Site` rows, byte-for-byte unchanged — only new rows were added (the schema's new tables, empty until this release's own controlled test, described below).

## Live route verification

| Route                                          | Before                 | After                                   |
| ---------------------------------------------- | ---------------------- | --------------------------------------- |
| `GET /work-orders` (unauthenticated)           | `404`                  | `401` (route exists, correctly rejects) |
| `GET /my-work` (unauthenticated)               | `404`                  | `401`                                   |
| `GET /charging-stations/:id` (unauthenticated) | `404`                  | `401`                                   |
| `GET /actions` (unauthenticated)               | `404`                  | `401`                                   |
| `GET /recommendations` (unauthenticated)       | `404`                  | `401`                                   |
| `GET /sites` (unauthenticated)                 | `401` (already worked) | `401` (unchanged)                       |

## Auth verification

- Real login against production, real credentials already configured in Railway's environment (never read into this report) — `200`, real access token issued, real organization ("Kylum Energy") and real `OWNER` membership resolved correctly.
- `GET /auth/me` — `200`.
- Unauthenticated request to a protected route — `401`.
- Forged/nonexistent `X-Organization-Id` header on an otherwise-valid token — `403`, `OrgContextGuard` correctly re-validates against the real database rather than trusting the header.

## Operator verification

- `GET /sites` — `200`, all 6 real production sites returned correctly.
- `GET /work-orders` — `200` (empty before the controlled test, since no `WorkOrder` existed in production before this release).
- `GET /work-orders/assignable-technicians` — `200` (empty before the controlled test — no `TECHNICIAN` membership existed in production yet, consistent with WO-ARGOS-039's onboarding findings).
- `GET /recommendations`, `GET /actions` — both `200`.
- Full assignment flow verified live via the controlled test below: real `WorkOrder` creation, real technician appearing in the assignable list, real assignment through the exact WO-ARGOS-038 picker's backend path.

## Technician verification

- A real technician login (from the controlled test) — `200`.
- `GET /my-work` — `200`, correctly showed exactly the one `WorkOrder` assigned to that technician.
- The technician's token, used against the operator-facing `GET /work-orders` — `403`. Self-scoping and role separation hold in the real production environment, not just in tests.

## Security verification

All of the following were confirmed live, in production, not inferred from the test suite:

- Unauthenticated access to protected routes: rejected (`401`).
- Forged organization context: rejected (`403`).
- A technician calling the operator-facing endpoint: rejected (`403`).
- A technician's `/my-work` correctly self-scoped to their own assignment only.

## Controlled closed-loop test

Executed once, safely, because production had zero real `WorkOrder`s and zero real technicians at release time — there was no live customer operation to interfere with. Every created row is clearly marked `[WO-ARGOS-040 TEST]` in its name/title and listed below for identification (and removal, at ARGOS's discretion — nothing was deleted automatically, per the instruction not to perform destructive operations without being asked):

| Record                                                                    | ID                          |
| ------------------------------------------------------------------------- | --------------------------- |
| Test `Site` — "[WO-ARGOS-040 TEST] Pilot Smoke Test Site"                 | `cmstwuyev000do001zyvswj9w` |
| Test `ChargingStation` — "[WO-ARGOS-040 TEST] Estación de prueba"         | `cmstwuyp5000ho001ajwz6bjt` |
| Test `WorkOrder` — "[WO-ARGOS-040 TEST] Controlled operational loop test" | `cmstwuyv3000lo001h93oo75n` |
| Test technician `User` — `wo-argos-040-test-technician@kylum.co`          | `cmstwuxpw0000rcz395zmwtkw` |

**Full loop result, all real, all live:** operator creates `WorkOrder` (`201`) → technician appears in `assignable-technicians` (`true`) → operator assigns (`200`, `ASSIGNED`) → technician logs in (`200`) → `/my-work` shows it (`true`) → technician cannot reach the operator endpoint (`403`, correctly blocked) → `start` (`200`, `IN_PROGRESS`) → all 4 checklist events recorded (`201` each) → `resolve` (`200`, `RESOLVED`) → operator's event feed shows the complete, real, 8-event canonical history: `CREATED, ASSIGNED, STARTED, ARRIVAL_CONFIRMED, DIAGNOSIS_RECORDED, INTERVENTION_RECORDED, VALIDATION_RECORDED, RESOLVED`.

The real production deployment, end to end, behaves exactly as verified in local/dev testing throughout WO-ARGOS-037/038.

## Known manual processes (unchanged from WO-ARGOS-039)

No signup, invite, membership-management, or station-creation UI exists. Onboarding a real pilot organization still requires the same script/DB-access steps documented in `docs/pilot/PILOT_ONBOARDING_REQUIREMENTS.md` — this release did not add any onboarding UI, per instruction.

## Known accepted limitations (unchanged from WO-ARGOS-038/039)

`VIEWER` write-route behavior, no SLA/`dueAt`, no notifications, no photo/file evidence, no routing, no technician availability scheduling, `WorkOrder` resolution as human attestation rather than verified device recovery. None of these were touched by this release, and none are newly introduced by it.

## Remaining deployment risks

- The controlled test data above remains in production, clearly marked, pending ARGOS's decision on whether to remove it before real pilot onboarding begins.
- No error monitoring exists (unchanged, previously documented) — the only visibility into a production issue today is Railway's own platform logs.
- The three older, still-orphaned migrations noted in earlier work orders (`20260802055353_add_connector_nonterminal_unique_index`, `20260802065541_add_tenant_fields`, `20260803044621_add_refresh_session_grace_window` — applied to local `movos_dev` in a past session but never committed as real migration files) do **not** exist in production's migration history, and were never applied here — production's migration history is clean and matches the repository's actual 14 committed migrations exactly.

## Release verdict

**PILOT_ENVIRONMENT_READY.**
