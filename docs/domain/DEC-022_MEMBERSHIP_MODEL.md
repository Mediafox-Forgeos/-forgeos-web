# DEC-022 — Membership Model: Current Behavior

**Generated:** 2026-08-02 (WO-ARGOS-014)
**Status:** Objective 1 only — describes what exists today. Does not evaluate alternatives or recommend a model. See DEC-022_DECISION.md (not yet written) for that.
**Method:** every claim below is read directly from the running schema and the actual service/guard/frontend code, not inferred or assumed. Where behavior is genuinely ambiguous or unspecified (e.g. row ordering), that is stated explicitly rather than guessed at.

---

## 1. The schema-level model

```
User ──< Membership >── Organization
 │
 └──< RefreshSession   (no organization affinity at all — see §4)
```

### `User`

| Field                                                                                                               | Notes                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `email` (unique), `passwordHash`, `displayName`, `status` (`UserStatus`: `INVITED/ACTIVE/SUSPENDED/ARCHIVED`) |                                                                                                                                  |
| Relations                                                                                                           | `memberships: Membership[]`, `refreshSessions: RefreshSession[]`, `auditEvents: AuditEvent[]` (as actor), `createdSites: Site[]` |

A `User` is a single, organization-independent identity. Nothing about a `User` row itself is organization-scoped — email uniqueness is global, not per-organization.

### `Organization`

| Field                                                                             | Notes                                                                                                                                                                        |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `name`, `slug` (unique), `status` (`OrgStatus`: `ACTIVE/INACTIVE/ARCHIVED`) |                                                                                                                                                                              |
| Relations                                                                         | `memberships: Membership[]`, `sites: Site[]`, `auditEvents: AuditEvent[]`, plus CAP-004's denormalized `chargingSessions`/`authorizationCredentials`/`authorizationAttempts` |

### `Membership` — the join model

```prisma
model Membership {
  id             String       @id @default(cuid())
  userId         String
  organizationId String
  role           MemberRole   @default(VIEWER)
  status         MemberStatus @default(ACTIVE)
  createdAt      DateTime
  updatedAt      DateTime

  @@unique([userId, organizationId])
}
```

- **Cardinality:** many-to-many between `User` and `Organization`, realized as one `Membership` row per `(userId, organizationId)` pair — enforced by the `@@unique([userId, organizationId])` constraint. A user cannot hold two different roles in the same organization simultaneously; a second `Membership` row for the same pair is a database-level constraint violation, not merely an application convention.
- **Ownership:** the `Membership` row is owned jointly by `User` and `Organization` — deleting either is blocked by `ON DELETE RESTRICT` on both foreign keys (verified against the generated migration SQL, not assumed): a `User` cannot be deleted while any `Membership` references them, and an `Organization` cannot be deleted while any `Membership` references it.
- **Role:** `MemberRole` — `OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER` (as of `main`; `FLEET_MANAGER` was added on the unmerged CAP-007 branch, not yet part of `main`). One role per membership row — a user's authority in Organization A is entirely independent of their role in Organization B; there is no "global" role that applies across all of a user's memberships.
- **Status:** `MemberStatus` — `INVITED, ACTIVE, SUSPENDED`. Every membership-consuming code path (`OrgContextGuard`, `AuthService.login`, `AuthService.selectOrganization`) filters or checks for `status === 'ACTIVE'` explicitly — an `INVITED` or `SUSPENDED` membership row exists in the database but grants no access and is invisible to `GET /organizations`/`GET /auth/me`/login's organization list.
- **Lifecycle:** no code path in the current codebase creates, updates, or deletes a `Membership` row via the API — there is no `POST /organizations/:id/memberships`, no invite flow, no role-change endpoint, no removal endpoint. Every `Membership` row in any environment today was created directly via `prisma/seed.ts` or a manual database operation, never through application code. (Confirmed by grep — no controller anywhere references `membership.create`, `membership.update`, or `membership.delete`/`deleteMany`.) This is a real, current gap, not an oversight this document is inventing: membership management is entirely out-of-band today.
- **Deletion:** no explicit delete path exists (see above), but if one existed, `RESTRICT` on both FKs means a `Membership` row itself has nothing blocking its own deletion — only `User`/`Organization` deletion is blocked _by the existence of_ `Membership` rows, not the reverse.

### `RefreshSession` — deliberately organization-agnostic

```prisma
model RefreshSession {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  createdAt DateTime
  userAgent String?
  ipAddress String?
}
```

No `organizationId` field exists on this model at all. A refresh session identifies "this user, on this device/browser, until this expiry" — nothing about which organization they were viewing when they logged in. **A user may hold multiple concurrent, independently-valid `RefreshSession` rows** — there is no uniqueness constraint on `userId` alone, and `AuthService.login()` creates a brand-new `RefreshSession` row on every successful login with no check for or revocation of prior sessions. Two browser tabs, two devices, or two separate logins by the same user all coexist as separate rows until each individually expires or is explicitly revoked (logout revokes only the one session tied to the presented refresh-cookie token, per `AuthService.logout`).

---

## 2. The runtime flow, exactly as implemented today

### 2.1 Login (`POST /auth/login`)

1. `LocalAuthGuard` validates email/password via `AuthService.validateCredentials` (bcrypt compare, requires `User.status === 'ACTIVE'`).
2. `AuthService.login(principal, ctx)`:
   - Loads **all** `ACTIVE` memberships for the user: `Membership.findMany({ where: { userId, status: 'ACTIVE' }, include: { organization: true } })` — **no `orderBy` clause**. The order these rows come back in is whatever Postgres/Prisma returns by default for an unordered query — not something this codebase specifies or guarantees.
   - Signs an access token via `signAccessToken({ sub: user.id, email: user.email })` — **no `orgId` is included at login, ever.** The very first access token a user receives after authenticating carries no organization context at all.
   - Issues a new `RefreshSession` row (see §1).
   - Records `LOGIN_SUCCEEDED` — **without an `organizationId`** (`audit.record({ action: 'LOGIN_SUCCEEDED', actorUserId: user.id, subjectType: 'User', subjectId: user.id })`; no `organizationId` field passed at all). This is a genuine, correct example of "an audit event with no organization context," already happening in production code today, not a hypothetical this document is raising for the first time.
3. Response body: `accessToken`, `user`, `organizations` (the full list from step 2's memberships, in that same unspecified order), `memberships` (same order, organization-detail stripped out).

### 2.2 Organization selection (`POST /auth/select-organization`)

`AuthService.selectOrganization(userId, organizationId)`:

1. Looks up the exact `Membership` row for `(userId, organizationId)`, requires `status === 'ACTIVE'`.
2. Signs a **new** access token: `signAccessToken({ sub, email, orgId: organizationId })` — this is the only code path in the entire backend that ever puts a value into the JWT's `orgId` claim.
3. Records `ORGANIZATION_SELECTED` — **with** `organizationId` this time.
4. Returns the new token. The client is expected to start using it in place of the org-less one from login.

**This endpoint is never called by `apps/movos-web` today.** Confirmed by grep across the entire frontend source: `select-organization`/`selectOrganization` appear only as the (unused, in this respect) label on the endpoint's own OpenAPI summary string and nowhere as an actual `fetch`/`apiClient` call site. It exists as a real, working, tested backend capability with no current caller.

### 2.3 Token refresh (`POST /auth/refresh`)

`AuthService.refresh(presentedToken, ctx)`:

1. Validates the presented refresh token (hash lookup, not expired, not revoked, user still `ACTIVE`).
2. Revokes that `RefreshSession` row and issues a new one (rotation).
3. Signs a new access token: `signAccessToken({ sub: user.id, email: user.email })` — **`orgId` is not carried forward.** Even if a client had previously obtained an `orgId`-bearing token via `select-organization`, calling `/auth/refresh` silently produces a new token with no `orgId` at all. The organization-selection step, if it had ever been performed, does not survive a token refresh.

### 2.4 `OrgContextGuard` — the actual per-request resolution

For every route that uses it (see CAP-007_API_TENANT_MATRIX.md for the full list):

1. Read `X-Organization-Id` header. If present and non-empty, use it.
2. Otherwise, fall back to `request.user.orgId` — the JWT's `orgId` claim, populated only by `JwtStrategy.validate()` reading whatever was in the token (which, per §2.1/§2.3 above, is almost always `undefined` in current practice).
3. If neither yields a value, `403 Forbidden` ("Organización no especificada").
4. **Always** re-look-up the `Membership` row fresh from the database for `(user.id, organizationId)`, regardless of which of the two sources produced `organizationId` — a header value is never trusted as authorization on its own, only as a selector for which membership to re-verify.
5. Attach the resolved `Membership` row to `request.membership`.

**The practical consequence of §2.1–§2.4 together: in the system as it runs today, the `X-Organization-Id` header is the _only_ mechanism that actually determines organization context for any real request.** The JWT `orgId` fallback path exists, is correctly implemented, and is exercised by nothing in the current frontend — it is reachable only by a client that calls `select-organization` and then makes a request without sending the header, which no code in `apps/movos-web` does.

### 2.5 Frontend session/organization state (`apps/movos-web`)

`src/lib/auth.ts` holds two module-level, **in-memory-only** variables: `accessToken` and `activeOrganizationId`. Neither is written to `localStorage` or any cookie the JS layer controls (the access token is deliberately kept out of persistent storage to limit XSS exposure — documented in the file's own header comment). **Both are lost on every full page reload.**

`src/context/auth-context.tsx`'s `applySession()` — called after both a fresh login and a page-load session restore — does exactly this, and nothing more, regarding organization selection:

```ts
const firstOrg = data.organizations[0] ?? null;
setCurrentOrg(firstOrg);
setActiveOrganizationId(firstOrg?.id ?? null);
```

**There is no "switch organization" UI anywhere in `apps/movos-web`.** `setActiveOrganizationId` is called from exactly one place in the entire frontend codebase — this line. `POST /auth/select-organization` is never invoked. For a user with more than one membership, which organization becomes "active" is **whichever one the backend's unordered query happens to return first** — not chosen by the user, not configurable, and not guaranteed to be the same organization across two different page loads or two different logins, since the underlying `Membership.findMany` call has no `orderBy`.

The `AuthContextValue.membership` field exposed to the rest of the app is `memberships[0] ?? null` — paired with `currentOrg = organizations[0]` **only because both arrays are derived from the same backend response in the same order**, not by matching on `organizationId` explicitly. The two arrays happen to correspond today because both originate from one `Membership.findMany` call in `AuthService`; there is no code-level guarantee enforcing that correspondence if either array were ever reordered or filtered independently in the future.

Every subsequent authenticated request from `apps/movos-web` goes through `src/lib/api-client.ts`'s `buildHeaders()`, which attaches `X-Organization-Id: <activeOrganizationId>` automatically (opt-out only, via `skipOrgHeader`) — so in practice, every request after the initial session load carries the _same, fixed, silently-chosen_ organization for the lifetime of that browser session/tab, until the next full page reload re-runs `applySession()` and potentially re-picks a different `organizations[0]`.

---

## 3. What happens today for a user with multiple memberships — stated explicitly, as requested

Given a user with real `ACTIVE` memberships in Organization A and Organization B:

1. **At login**, the response lists both organizations (in whatever order the database returns them), but the issued access token itself carries no organization context.
2. **The frontend silently picks `organizations[0]`** as "the active organization" for the entire session — the user is given no choice, sees no indicator that a choice was even made on their behalf, and has no UI control to change it.
3. **Every request for the rest of that browser session is scoped to that one organization**, via the `X-Organization-Id` header, enforced correctly by `OrgContextGuard`'s fresh per-request membership re-validation (this part of the isolation guarantee — CAP-007's Invariant 1 — holds regardless of any of the gaps above; a request scoped to Organization A can never read Organization B's data, it simply has no way to become scoped to B in the first place through the UI).
4. **To interact with the other organization at all**, the user has no supported path today — not a UI switcher, not even a working manual one, since the one backend endpoint that would support it (`select-organization`) mints a token whose `orgId` is then silently dropped the moment `/auth/refresh` next fires (which happens automatically, e.g. on token expiry or a 401), reverting behavior to "whichever organization the header says," which nothing in the frontend ever updates away from the original silent choice.
5. **A page reload** re-runs the entire session-restore flow and re-picks `organizations[0]` again from a fresh, still-unordered query — which may or may not be the same organization as before, since nothing pins the choice.
6. **Audit events** for this user's actions are recorded with whichever `organizationId` `OrgContextGuard` resolved for that specific request (i.e., always Organization A, per #2–3 above, unless the user is somehow using a raw API client that manually varies the header) — except for the small set of actions that are inherently pre-organization-selection (`LOGIN_SUCCEEDED`, `LOGOUT`, `LOGIN_FAILED`), which are correctly recorded with no `organizationId` at all, reflecting that no organization was chosen yet at that moment.

**No part of the above is a security gap** — CAP-007's isolation invariants (re-verified membership on every request, no cross-organization read/write path) hold throughout every one of these behaviors. What is missing is _user-facing capability and determinism_, not isolation: a real multi-organization user (the consultant/fleet-operator/support-engineer scenarios this work order's later objectives will need to evaluate) has no way today to deliberately choose or switch which organization they're acting within, and the one organization they're stuck with for a session is chosen by database row order, not by them.
