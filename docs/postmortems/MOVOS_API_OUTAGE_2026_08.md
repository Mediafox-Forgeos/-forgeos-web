# MOVOS API Outage — August 2026

**Work order:** WO-ARGOS-048 (Production API Recovery)
**Status:** ROOT CAUSE CONFIRMED. Recovery **blocked** — requires a Railway billing/plan decision only ARGOS can make. No code, schema, or data change was made or is needed.

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

## Downtime

Started: 2026-08-15, shortly after 06:40:53 UTC (last confirmed healthy request, `PILOT-WO-02`'s resolution).
Ended: **not yet — ongoing** as of this report. Duration is indeterminate until ARGOS selects a plan and service is restored.

## Was data affected?

**No.** Every recovery command that touched a service failed before executing (validation/authorization failure preceded any container action). The database's persistent volume (`postgres-volume`) was never deleted, resized, or otherwise touched — only the compute container attached to it was stopped, by Railway's own trial-expiration mechanism, not by any action taken in this or any prior VULCAN session. No `WorkOrder`, `User`, `ChargingStation`, or `Membership` row was created, modified, or deleted during this incident or its investigation.

## Was pilot evidence affected?

**No.** `PILOT-WO-01` and `PILOT-WO-02` both completed and were fully captured (`docs/pilot/PILOT_WO_01_EVIDENCE.md`, `docs/pilot/PILOT_WO_02_EVIDENCE.md`) **before** the outage began — the outage's first symptom (`Stopping Container`) appears in the logs immediately _after_ `PILOT-WO-02`'s last event, not during it. Nothing about the pilot's 2/5 evidence record is in question. `PILOT-WO-03` has not started and cannot start until the API is restored, which is exactly why WO-ARGOS-048 blocks it explicitly.

## Preventive follow-up candidates (not implemented — named only, per instruction)

- Move the Railway workspace off the trial plan onto a paid plan before it can silently expire again mid-pilot.
- A basic uptime/health check (even a manual pre-session curl to `/api/v1/health`) before starting any work-order that depends on live production, so an outage is caught at session start rather than mid-verification.
- Investigate whether Railway offers any advance-expiration notice (email, dashboard banner) that could have surfaced this before it took the service down; if so, whether that notice channel reaches ARGOS or VULCAN in time to act.

None of the above is implemented in this work order — diagnosis and reporting only, per the freeze.
