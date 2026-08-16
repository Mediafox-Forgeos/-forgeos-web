# MOVOS API Outage — August 2026

**Work order:** WO-ARGOS-048 (Production API Recovery)
**Status:** RESOLVED. Root cause confirmed, billing gate cleared by ARGOS (Railway Hobby plan activated), service restored and independently verified live. No code, schema, or data change was made or needed.

## Symptom

Production `movos-api` (`https://movos-api-production.up.railway.app`) began returning `{"status":"error","code":404,"message":"Application not found"}` on every route, including `/api/v1/health`. This is Railway's edge-proxy response for a domain with zero active deployments — not an application-level error, and not a normal 401/404 from the NestJS app itself.

## Detected state

- `railway status`: `movos-api` — **Failed**; `Postgres` — **Offline**; the unrelated `-forgeos-web` service also **Failed**.
- `movos-api`: `activeDeployments: []`. Its most recent real deployment, `e4bb27ba-59a0-49c2-b9f3-5f15843d36d8`, was serving real pilot traffic (confirmed by request logs matching `PILOT_WO_02_EVIDENCE.md`'s timestamps exactly, 06:38:57–06:40:53 UTC on 2026-08-15) and ends with `Stopping Container`.
- `Postgres`: `activeDeployments: []`, `latestDeployment: null`. Its container logs show normal checkpoint activity up to `2026-08-15 06:40:53 UTC`, immediately followed by `sending signal SIGTERM to container` / `Stopping Container` — a clean shutdown signal, not a crash, OOM kill, or error trace.
- `railway deployment list --service Postgres` shows exactly **one** deployment ever created for the database (`af6bea12-...`, originally deployed 2026-07-15), now `REMOVED`. The persistent volume (`postgres-volume`) was not deleted — only the running container was stopped.
- Both services stopped within the same short window, immediately after `PILOT-WO-02`'s resolution — consistent with a single, workspace-wide cause rather than two independent failures.

## Root cause

**The Railway trial for the `mediafox-forgeos` workspace expired.** Confirmed directly and unambiguously:

```
$ railway redeploy --service Postgres --yes --from-source
Your trial has expired. Please select a plan to continue using Railway.
```

`railway usage` separately confirmed this is **not** a spend-cap issue — current usage for the billing period is $0.50, no soft or hard limit is set, and `Over limit: no`. The trial's time-based expiration, not resource consumption, stopped every service in the workspace simultaneously (movos-api, Postgres, and the unrelated `-forgeos-web` service all show `Failed`/no active deployment for the same reason).

This explains every observed symptom: no application crash, no migration failure, no bad deploy, no database corruption, no code defect. The application and database were healthy and serving real production traffic up to the moment the trial's underlying infrastructure was reclaimed.

## Recovery action

**None taken — none is possible without a billing decision.** Both `railway restart` and `railway redeploy` (with and without `--from-source`) were attempted for `Postgres` and `movos-api`, in that order, using only the already-approved, already-running deployment (no rebuild, no new source, no application-code change under consideration at any point). All attempts against `Postgres` failed before touching any container or data — either `No deployment found for service` (restart/redeploy-without-source, because the sole prior deployment is marked `REMOVED`, not merely stopped) or the trial-expiration error above (redeploy-with-source). No destructive command was run, and none would have succeeded regardless — the workspace has no way to run any service until a plan is selected.

Selecting/paying for a Railway plan is a financial/account transaction on ARGOS's own Railway account — outside VULCAN's authority to perform under any circumstance, independent of this engagement's own freeze rules.

## Human billing resolution

ARGOS activated the Railway **Hobby** plan directly in the Railway dashboard, clearing the blocker. Once active, `Postgres` and `movos-api` both came back online **automatically** — Railway auto-redeployed each service's most recent build the moment the plan was live; no `railway redeploy`/`restart` command from this session triggered it. This was independently confirmed rather than assumed from ARGOS's dashboard observation:

- `railway status` (re-run fresh): `movos-api` → **Online**; `Postgres` → **Online**, volume `postgres-volume` attached.
- `movos-api`'s active deployment (`56f1db09-b209-4655-a42c-39f5605bbb37`, status `SUCCESS`, created `2026-08-16T02:27:04.453Z`) was built from commit `a22fb3caae09ea87ae80e9d53fb39b85be24acf9` — an **older** commit than current `main` (`983b0c0`), because Railway redeployed the last successfully built image rather than pulling latest. Verified this is not a regression: `git diff a22fb3c..origin/main -- apps/movos-api packages prisma` is empty — every commit between them is docs-only, so the running application code is identical to current `main`'s application code. No redeploy-from-source was needed or performed.
- Startup logs are clean: all routes mapped, ending in `Nest application successfully started` / `MOVOS API listening on http://localhost:4000/api/v1` / `OCPP WebSocket transport attached` — no errors, no crash-loop, no failed Prisma connection.

## Downtime

Started: 2026-08-15, shortly after 06:40:53 UTC (last confirmed healthy request, `PILOT-WO-02`'s resolution).
Ended: 2026-08-16, ~02:27 UTC (movos-api's restored deployment timestamp). **Approximately 19.7 hours**, entirely attributable to the Railway trial expiration and the time to reach and act on the billing gate — no engineering recovery time once the plan was activated (Railway's own auto-redeploy handled it).

## Was data affected?

**No, confirmed twice over.** First, structurally: every recovery command that touched a service before the plan was activated failed before executing (validation/authorization failure preceded any container action), and the persistent volume (`postgres-volume`) was never deleted or resized. Second, empirically, post-recovery: a read-only production query (below) shows the exact organization, site, 3 stations, both users, and both `WorkOrder`s with `updatedAt` timestamps byte-identical to what `PILOT_WO_01_EVIDENCE.md`/`PILOT_WO_02_EVIDENCE.md` recorded, and event counts matching exactly (9 and 8). No `WorkOrder`, `User`, `ChargingStation`, or `Membership` row was created, modified, or deleted at any point during this incident, its investigation, or its recovery.

## Post-recovery verification

**Pilot data integrity (read-only query against restored production):**

| Check                      | Result                                                   |
| -------------------------- | -------------------------------------------------------- |
| Organization               | Kylum Energy (`cmrmkq9ok0000rcnfa7q0loxd`)               |
| Site                       | Centro Comercial Calima (`cmrq5sb71001xmo010tfp606p`)    |
| Stations                   | exactly 3 — Calima - Estación 01/02/03                   |
| Álvaro Pino                | `ACTIVE`, `OWNER`                                        |
| Javier Cabal Jr.           | `ACTIVE`, `TECHNICIAN`                                   |
| `WorkOrder` count          | exactly **2**, both `RESOLVED`                           |
| WO-01 `updatedAt`          | `2026-08-15T06:15:57.395Z` — unchanged from evidence doc |
| WO-02 `updatedAt`          | `2026-08-15T06:40:52.256Z` — unchanged from evidence doc |
| WO-01 / WO-02 event counts | 9 / 8 — unchanged from evidence docs                     |
| `PILOT-WO-03`              | does not exist                                           |

**Live smoke test** (real HTTP calls against `https://movos-api-production.up.railway.app`, using short-lived access tokens minted with the app's own `JWT_ACCESS_SECRET` for Álvaro's and Javier's real, existing user records — chosen specifically to avoid ever touching either participant's real password):

| Check                                              | Result                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `GET /health` (no auth)                            | 200                                                                |
| `GET /auth/me` (Álvaro)                            | 200                                                                |
| `GET /auth/me` (Javier)                            | 200                                                                |
| `GET /sites` (Álvaro)                              | 200, 6 sites (unchanged baseline — 1 real + 5 pre-existing QA)     |
| `GET /work-orders` (Álvaro)                        | 200, 2 items                                                       |
| `GET /work-orders/assignable-technicians` (Álvaro) | 200, 1 item (Javier)                                               |
| `GET /recommendations` (Álvaro)                    | 200, empty                                                         |
| `GET /actions` (Álvaro)                            | 200, empty                                                         |
| `GET /my-work` (Javier)                            | 200, 2 items (both assigned `WorkOrder`s)                          |
| `GET /work-orders` (Javier)                        | **403** — technician correctly forbidden from the operator surface |
| `GET /work-orders/assignable-technicians` (Javier) | **403**                                                            |
| `GET /sites` (no token)                            | **401**                                                            |
| `GET /work-orders` (no token)                      | **401**                                                            |

Role isolation (`TECHNICIAN` vs. `OWNER`/operator surface) and unauthenticated rejection both hold exactly as designed. Cross-organization isolation was not independently re-exercised in this pass — it's covered by the 11 e2e security tests from WO-ARGOS-037, which CI re-runs on every merge and passed on the current `main`.

## Was pilot evidence affected?

**No.** `PILOT-WO-01` and `PILOT-WO-02` both completed and were fully captured (`docs/pilot/PILOT_WO_01_EVIDENCE.md`, `docs/pilot/PILOT_WO_02_EVIDENCE.md`) **before** the outage began — the outage's first symptom (`Stopping Container`) appears in the logs immediately _after_ `PILOT-WO-02`'s last event, not during it. Nothing about the pilot's 2/5 evidence record is in question, and the post-recovery integrity check above confirms it directly. `PILOT-WO-03` has not started.

## `-forgeos-web` relevance

The Railway `-forgeos-web` service's historical "Build failed 1 month ago" status is **unrelated** to MOVOS production and was **not** repaired, per instruction. Verified rather than assumed: `-forgeos-web` corresponds to `apps/forgeos-web` (`@mediafox/forgeos-web`) — a separate application in this monorepo from the real MOVOS frontend (`apps/movos-web`). `apps/movos-web` has zero references to `forgeos-web` anywhere in its config, and is confirmed live and serving on Vercel (`https://movos-web.vercel.app`, HTTP 307 → login, a normal healthy response), independent of Railway entirely. `-forgeos-web`'s stale failure predates this incident by a month and does not affect MOVOS's frontend, API, or database.

## Final production status

- `movos-api`: **Online**, deployment `56f1db09-b209-4655-a42c-39f5605bbb37`, commit `a22fb3c` (app code identical to current `main`).
- `Postgres`: **Online**, `postgres-volume` attached, all pilot data intact and verified.
- `movos-web` (Vercel): live, unaffected by this incident throughout.
- No BLOCKER/HIGH issue remains. `PILOT-WO-03` may now proceed once ARGOS authorizes it.

## Preventive follow-up candidates (not implemented — named only, per instruction)

- Move the Railway workspace off the trial plan onto a paid plan before it can silently expire again mid-pilot.
- A basic uptime/health check (even a manual pre-session curl to `/api/v1/health`) before starting any work-order that depends on live production, so an outage is caught at session start rather than mid-verification.
- Investigate whether Railway offers any advance-expiration notice (email, dashboard banner) that could have surfaced this before it took the service down; if so, whether that notice channel reaches ARGOS or VULCAN in time to act.

None of the above is implemented in this work order — diagnosis and reporting only, per the freeze.
