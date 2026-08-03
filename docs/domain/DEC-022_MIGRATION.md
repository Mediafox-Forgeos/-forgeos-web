# DEC-022 — Single Active Organization: Migration & Implementation

**Generated:** 2026-08-03 (WO-ARGOS-015, Objective 6)
**Status:** Implementation of [DEC-022_DECISION.md](./DEC-022_DECISION.md) — Option A, as accepted, unmodified.
**Branch:** `feat/dec-022-single-active-organization`
**Scope:** Backend (`AuthService`, `AuthController`, `OrgContextGuard`), frontend (`AuthContext`, `apiClient`, `OrganizationSwitcher`), `@mediafox/shared-types`. No Billing, RFID, Smart Charging, or OCPP 2.0.1 change, per work order constraint.

This document records what changed, why, and how it rolls out. It closes Gaps 1–5 and 8 from `DEC-022_DECISION.md`'s gap table. Gaps 6, 7 (independent audit debt) and 9 (future membership-lifecycle APIs) are explicitly out of scope, as classified in that decision.

---

## 1. Token lifecycle: before → after

| Stage                         | Before                                                                                                                                                                            | After                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Login**                     | Access token never carried `orgId`, regardless of membership count. Frontend picked `organizations[0]` client-side — silently arbitrary whenever ordering wasn't guaranteed.      | `AuthService.login()` loads ACTIVE memberships **ordered by organization name** (closing the ordering non-determinism directly). If the user has **exactly one**, the token is signed with that `orgId` immediately (no extra round trip), and an `ORGANIZATION_SELECTED` audit event is recorded with `metadata: { trigger: 'auto', reason: 'single-membership-at-login' }`. If the user has **zero or more than one**, the token is issued with no `orgId` at all — a _pre-selection token_.                                                                               |
| **Pre-selection token scope** | N/A (didn't exist as a concept; every token was implicitly "no org" until a header supplied one).                                                                                 | Valid only for identity/listing/selection: `/auth/me`, `GET /organizations`, `POST /auth/select-organization`. Every other, organization-scoped route rejects it via `OrgContextGuard` (403 — no `orgId` to resolve, and no header fallback to substitute one).                                                                                                                                                                                                                                                                                                              |
| **Explicit selection**        | `POST /auth/select-organization` existed, re-validated membership, minted a new token, and audited `ORGANIZATION_SELECTED` — but the frontend never called it.                    | Unchanged endpoint contract; now the frontend's `OrganizationSwitcher` is the one and only caller, wired to `AuthContext.selectOrganization`. Its audit event now carries `metadata: { trigger: 'explicit' }`, distinguishing it from an auto-selection at login.                                                                                                                                                                                                                                                                                                            |
| **Refresh**                   | `POST /auth/refresh` minted a new access token that always omitted `orgId` — organization context was lost on every ~15-minute rotation, silently.                                | `RefreshDto` gained `organizationId` (the field existed unused on the DTO before this work order; the controller never read it). The caller (one browser tab) supplies the organization it currently has active; `AuthService.refresh()` re-validates ACTIVE membership fresh, exactly like `select-organization`, and includes `orgId` in the new token only if still valid. If the membership is no longer valid (e.g. revoked since the last refresh), the new token simply omits `orgId` rather than failing the whole refresh — the session itself is still legitimate. |
| **Guard resolution**          | `OrgContextGuard`: `const organizationId = headerOrgId ?? user.orgId;` — `X-Organization-Id` could supply an organization the token itself never carried, or override one it did. | `const organizationId = user.orgId;` — the header is not read at all. A request with no token `orgId` is rejected regardless of any header sent.                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## 2. Endpoint contract changes

All three additive — no field was removed, renamed, or changed type. `@mediafox/shared-types` (`packages/shared-types/src/movos-api.ts`) is the single source both apps compile against, so there is no cross-service version-skew window to manage.

| Response          | New field                        | Semantics                                                                                                                                     |
| ----------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `LoginResponse`   | `organizationId: string \| null` | Echoes the token's own `orgId` claim — `null` for a pre-selection token.                                                                      |
| `MeResponse`      | `organizationId: string \| null` | Echoes the _current_ token's `orgId` claim (read from `request.user.orgId`, not re-derived).                                                  |
| `RefreshResponse` | `organizationId: string \| null` | Echoes the newly-minted token's `orgId` claim — `null` if none was requested, or if the requested one is no longer a valid ACTIVE membership. |

These fields exist so the frontend never needs to decode the JWT client-side to know which organization a token is bound to — the backend states it explicitly, mirroring the precedent `select-organization`'s response already set (`{ accessToken, organizationId }`).

`select-organization`, `/auth/me`, `/auth/refresh`, `/auth/login` — same URLs, same HTTP methods, same auth requirements as before. No dependency or lockfile change.

---

## 3. `OrgContextGuard` hardening and its one sanctioned exception

Per Objective 4's explicit instruction to document exceptions: the only place `organizationId` still arrives as caller-supplied input outside the JWT is `POST /auth/refresh`'s optional `organizationId` body field. This does not reopen Invariant 3 (`X-Organization-Id` must not override the JWT `orgId`), because:

- `/auth/refresh` is a token-**issuance** endpoint, not an ordinary organization-scoped resource request — it does not use `OrgContextGuard` at all.
- The supplied `organizationId` is re-validated against a fresh `Membership` lookup before it can influence anything, identically to how `select-organization` has always worked.
- The _header_ `X-Organization-Id` is never read anywhere in the request pipeline post-hardening — grepping the codebase for `x-organization-id` after this change turns up only test assertions that it has no effect (`test/auth.e2e-spec.ts`, `test/tenant-isolation.e2e-spec.ts`) and the guard's own doc comment explaining why.

Eight controllers (`connectors`, `evses`, `charging-stations`, `sites`, `sessions`, `ocpp-provisioning`, `authorization-credentials`, `authorization-attempts`) had a `@ApiHeader({ name: 'X-Organization-Id', ... })` Swagger decorator removed, since documenting a header with zero effect on server behavior would actively mislead API consumers reading the generated OpenAPI spec.

---

## 4. Frontend flow changes

- **`organizations[0]` is gone.** `AuthContext.applySession()` now derives `currentOrg` by matching the backend's `organizationId` against the `organizations` array — never by array position. If no match exists (pre-selection token), `currentOrg` stays `null`.
- **`needsOrganizationSelection`** is a new derived boolean (`!isLoading && !currentOrg && organizations.length > 0`) that gates the UI between Case A (single membership, silently auto-selected server-side, nothing for the user to do) and Case B (zero or multiple memberships, an explicit choice is required).
- **`OrganizationSwitcher`** (`src/components/organizations/organization-switcher.tsx`) is the single component behind every organization change:
  - `variant="list"` — a full-page, blocking selector rendered by `MovosShell` whenever `needsOrganizationSelection` is true. Nothing organization-scoped renders until a selection is made.
  - `variant="dropdown"` — a compact sidebar control (replacing the old static org-name box in `movos-sidebar.tsx`) that lets a user with multiple memberships explicitly switch afterward. For a single-membership user it renders as a plain, non-interactive label — there is nothing to switch to.
  - Both variants call `AuthContext.selectOrganization`, and nothing else in the frontend calls it — satisfying Invariant 4 ("switching only ever happens through an explicit `select-organization` operation").
- **`X-Organization-Id` is no longer sent by the frontend at all.** `apiClient`'s `skipOrgHeader` request option and its header-attachment logic were removed outright, since the header had no effect on the (now-hardened) backend and continuing to send it would be dead, misleading code.
- **Persistence: `sessionStorage`, not `localStorage`, not a cookie.** `lib/auth.ts`'s `setActiveOrganizationId`/`getActiveOrganizationId` are backed by `sessionStorage` under the key `movos_active_org_id`. This is the only browser-native mechanism that is simultaneously per-tab-isolated (required for Objective 5's "no organization leakage between tabs") and reload-durable (required for "selection survives page reload"). It stores only an id, never a secret.

---

## 5. Multi-tab correctness and the refresh race

**Design.** Each browser tab keeps its own `sessionStorage`-scoped `movos_active_org_id`. On every `POST /auth/refresh` call, the tab sends its own current value as `organizationId`; the backend re-validates and re-mints independently per call. There is no shared, server-side "current organization" concept to collide across tabs — Tab A refreshing into Organization Alpha and Tab B refreshing into Organization Beta are two structurally independent operations against two structurally independent (if simultaneously-valid) access tokens. Proven end to end in `test/auth.e2e-spec.ts`'s `multi-tab isolation` case, which fires both refreshes concurrently against the same shared refresh cookie and asserts each tab's token resolves to its own requested organization.

**The refresh-rotation race**, named in `DEC-022_DECISION.md`'s Gap 8 and `DEC-022_SCENARIOS.md` Scenario 6: two tabs sharing one refresh cookie can call `/auth/refresh` near-simultaneously. Refresh tokens rotate on use (the presented one is revoked, a new one issued) — without mitigation, the _losing_ tab's request would present an already-revoked token and receive a hard `401`, logging that tab out for no legitimate reason.

**Chosen strategy: a short, bounded grace window, not full serialization.**

- `RefreshSession` gained a nullable `replacedByTokenHash` column (migration `20260803044621_add_refresh_session_grace_window`). On rotation, the old session row is updated **in one atomic UPDATE** setting `revokedAt` and `replacedByTokenHash` together — deliberately not two sequential writes, which would reopen a narrower race of its own.
- If `AuthService.refresh()` receives a token that is already revoked, but was revoked **within the last 10 seconds** (`REFRESH_GRACE_WINDOW_MS`), this is treated as a legitimate racing duplicate rather than a replay attempt: the caller is issued their own fresh, independent session instead of a `401`. A token revoked outside that window is rejected exactly as before — this is not a general relaxation of refresh-token security, only a narrow tolerance for near-simultaneous legitimate use.
- **This does not touch membership-revocation immediacy** (Invariant 6/7). That check is re-run fresh, per request, entirely independent of this window — the grace window concerns refresh-_token_ rotation timing only, never `Membership.status`.
- **Rejected alternative:** a `$transaction` + `SELECT ... FOR UPDATE` row-locking approach was considered and rejected as unnecessary complexity — the grace window resolves the actual user-facing symptom (spurious logout) without full serialization, at the cost of one narrow, honestly-stated residual risk: a captured refresh token could be replayed within the 10-second window. This is judged an acceptable trade given the window's brevity and that it requires the attacker to already possess a valid refresh token, at which point far larger exposure already exists regardless of this window.

---

## 6. Migration strategy

**Database:** one additive, nullable column (`RefreshSession.replacedByTokenHash`). No backfill required — existing rows simply have `replacedByTokenHash = NULL`, which the grace-window logic never reads for a session that hasn't been rotated yet. No index, constraint, or data transformation needed.

**No `organizationId` backfill of any kind is needed anywhere else.** Organization binding lives entirely in the JWT claim, which is issued fresh on every login/refresh/select-organization call — there is no persisted "current organization" state to migrate for existing users. The very next login or refresh a user performs after deployment produces a correctly-scoped token under the new rules automatically.

**Deployment order:** backend before frontend. The backend changes are backward-compatible with the _old_ frontend for every case except one (below) — the old frontend never sent `organizationId` on refresh and never read the new `organizationId` response fields, both of which are additive/optional. The new frontend requires the new backend contract (`organizationId` in login/me/refresh responses) to function, so it must not roll out first.

---

## 7. Backward compatibility and the one bounded exposure window

**Additive contract changes carry no compatibility risk** — new response fields are ignored by any client that doesn't know about them; `RefreshDto.organizationId` is optional and refresh behaves exactly as before (org-less token) when omitted.

**The one real, bounded exposure:** a browser tab with an access token issued _before_ deployment (no `orgId`, since login never set one previously) will, immediately after deployment, have that token rejected with `403` (not `401`) by the hardened `OrgContextGuard` on its next organization-scoped call — the header it may have been relying on is now silently ignored rather than substituted. Because `apiClient`'s silent-refresh-and-retry logic only triggers on `401`, this specific `403` is **not** auto-recovered by the existing retry path.

This is bounded and self-healing without any special handling, for two independent reasons:

1. Access tokens expire after `JWT_ACCESS_TTL` = **900 seconds (15 minutes)**. Once a pre-deployment token naturally expires, the next API call gets a normal `401`, which _does_ trigger `apiClient`'s existing silent-refresh path — producing a new, correctly-scoped token under the new rules.
2. `AuthProvider` already calls `apiClient.attemptRefresh()` unconditionally on mount (page load). Any tab that reloads picks up a fresh, correctly-scoped token immediately, regardless of the 15-minute bound above.

So the actual exposure is: a tab left open, without a reload, spanning the exact deployment moment, hits at most one unexpected `403` on an organization-scoped call, for at most 15 minutes post-deploy, self-resolving on that tab's next natural token refresh. No data is exposed or lost in this window — the failure mode is "request denied," never "request resolved against the wrong organization." Deploying during low-traffic hours is a reasonable operational precaution but not a hard requirement.

---

## 8. Rollback strategy

Rolling back to the pre-WO backend build is safe: `replacedByTokenHash` is nullable and additive, so older code that never references it continues to operate unaffected against the new schema — no down-migration is required to restore prior behavior. Rolling back the frontend independently is also safe, since it degrades to the previous (pre-DEC-022) `organizations[0]`-based flow against a backend that still accepts the old, header-free request shapes it always did.

Rolling back _only_ the guard hardening while keeping everything else (an unlikely partial rollback, noted for completeness) would reintroduce the `X-Organization-Id` fallback and is explicitly not recommended, since it was the deciding security property in `DEC-022_DECISION.md`'s threat-model rationale.

---

## 9. Test coverage

| Layer                       | File                                                                         | Scenarios                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend unit                | `apps/movos-api/src/auth/auth.service.spec.ts`                               | Login: single/multi/zero-membership auto-selection and audit trigger metadata. Refresh: rotation with `replacedByTokenHash`, grace-window tolerance vs. hard rejection outside it, organization-affinity preservation, degrade-to-no-org on revoked/nonexistent membership. `selectOrganization`: success + audit, rejection for missing/revoked membership. |
| Backend unit                | `apps/movos-api/src/guards/org-context.guard.spec.ts`                        | No user → 401; no token `orgId` → 403 without querying membership; `X-Organization-Id` header proven inert against both a valid and a missing token `orgId`; valid membership attaches to the request.                                                                                                                                                       |
| Backend e2e (real Postgres) | `apps/movos-api/test/auth.e2e-spec.ts`                                       | Full DEC-022 flow against a live database: single-membership auto-select at login, multi-membership pre-selection token blocked from org-scoped routes, `select-organization` unblocking access, rejection for no/revoked membership, refresh preserving affinity, genuine concurrent multi-tab refresh isolation, header proven to have zero effect.        |
| Backend e2e (real Postgres) | `apps/movos-api/test/tenant-isolation.e2e-spec.ts`                           | Updated: the two tests that previously asserted a foreign/forged `X-Organization-Id` header was _rejected_ (pre-DEC-022 behavior) now assert it is _ignored_ — the request still succeeds, still resolving only to the token's own organization, never leaking the other one.                                                                                |
| Frontend unit               | `apps/movos-web/src/lib/auth.test.ts`                                        | `sessionStorage`-backed persistence and reload recovery for the active organization id.                                                                                                                                                                                                                                                                      |
| Frontend unit               | `apps/movos-web/src/context/auth-context.test.tsx`                           | Session restore binds to the backend's stated `organizationId`, never `organizations[0]`; pre-selection token surfaces `needsOrganizationSelection`; `login`/`selectOrganization` update state correctly.                                                                                                                                                    |
| Frontend unit               | `apps/movos-web/src/components/organizations/organization-switcher.test.tsx` | Both variants; explicit-selection-only behavior; error handling; no-op on re-selecting the already-active organization.                                                                                                                                                                                                                                      |

Two pre-existing test-infrastructure gaps were fixed as a prerequisite for the above to run deterministically, unrelated to DEC-022's domain logic: `test/setup-e2e.ts`'s `resetDatabase()` deleted `Site` before its FK-dependent children (leftover data from other suites could block cleanup); and `test/jest-e2e.json` ran spec files in parallel workers against one shared database, causing genuine cross-file data races once a second e2e spec file existed — now pinned to `maxWorkers: 1`. Both are documented here because they were touched by this work order, not because they are DEC-022 concerns.
