# DEC-022 — Single Active Organization: Runtime Validation

**Generated:** 2026-08-03 (WO-ARGOS-015, Objective 7)
**Method:** Live runtime validation — the compiled `movos-api` running against the real local `movos_dev` PostgreSQL database, driven with `curl`. Not a mock, not a unit test. All 8 scenarios named in the work order are reproduced below with actual request/response evidence.
**Fixtures:** two organizations (`DEC-022 Val Alpha`, `DEC-022 Val Beta`) and two users (`single@dec022-validation.test` — one ACTIVE membership; `multi@dec022-validation.test` — two ACTIVE memberships), created for this validation pass and deleted afterward. Automated coverage of the same scenarios lives in `apps/movos-api/test/auth.e2e-spec.ts`'s `DEC-022: organization affinity` suite (14 tests, real Postgres, run on every `npm run test:e2e`) — this document is the one-time live-server confirmation the work order asks for in addition to that.

---

## Scenario 1 — Single-org user

Login for a user with exactly one ACTIVE membership auto-selects it — no separate `select-organization` round trip.

```
POST /auth/login  {"email":"single@dec022-validation.test","password":"validation-pw-123"}

200 OK
{
  "accessToken": "eyJhbGci...",
  "organizationId": "cmscw2ccp0000rc4tzbk7jla9",   ← DEC-022 Val Alpha, set immediately
  "organizations": [ { "id": "cmscw2ccp0000...", "name": "DEC-022 Val Alpha", ... } ],
  "memberships": [ { "organizationId": "cmscw2ccp0000...", "role": "OWNER", "status": "ACTIVE" } ]
}
```

**Result: PASS.** `organizationId` is non-null and matches the sole membership on the very first response, with no additional call required.

---

## Scenario 2 — Multi-org user

Login for a user with more than one ACTIVE membership issues a _pre-selection_ token (`organizationId: null`), which is rejected on every organization-scoped route.

```
POST /auth/login  {"email":"multi@dec022-validation.test","password":"validation-pw-123"}

200 OK
{
  "accessToken": "eyJhbGci...",
  "organizationId": null,
  "organizations": [ "DEC-022 Val Alpha", "DEC-022 Val Beta" ],
  "memberships": [ ... two ACTIVE memberships ... ]
}

GET /sites  Authorization: Bearer <that token>

403 Forbidden
{ "message": "Organización no especificada" }
```

**Result: PASS.** The token carries every organization the user could pick from, but resolves to none until an explicit choice is made — no `organizations[0]` guess anywhere in the path.

---

## Scenario 3 — Organization switch

`POST /auth/select-organization` mints a new, correctly-scoped token from a pre-selection token.

```
POST /auth/select-organization  Authorization: Bearer <pre-selection token>
                                 {"organizationId":"<Beta id>"}

200 OK
{ "accessToken": "eyJhbGci...", "organizationId": "cmscw2cct0001rc4t3ddh3buk" }

GET /sites  Authorization: Bearer <new Beta-scoped token>

200 OK
```

**Result: PASS.** The switch is a single explicit call; the resulting token immediately unlocks Beta's org-scoped routes.

---

## Scenario 4 — Membership revocation

An ACTIVE membership is suspended out-of-band while a token minted from it is still unexpired (well inside its 15-minute TTL). The revocation is checked fresh on the very next request — never cached in the JWT.

```
# Membership Beta/multi-user set to SUSPENDED directly in the database.

GET /sites  Authorization: Bearer <the already-issued Beta-scoped token from Scenario 3>

403 Forbidden
{ "message": "Acceso a la organización denegado" }
```

**Result: PASS.** The token itself was never touched or blacklisted — `OrgContextGuard` re-queries `Membership` on every request (Invariant 6/7), so revocation takes effect immediately, without waiting for token expiry.

(Membership was restored to ACTIVE immediately after this check, to allow Scenario 5's fixtures to proceed.)

---

## Scenario 5 — Two tabs, different organizations

Two "tabs" share one login session (one refresh cookie) and refresh into different organizations, racing against the very same original cookie.

```
POST /auth/login  (multi-org user)              → cookie stored

Tab A: POST /auth/refresh  {"organizationId":"<Alpha id>"}
  200 OK  { "accessToken": "...", "organizationId": "<Alpha id>" }

Tab B: POST /auth/refresh  {"organizationId":"<Beta id>"}   (same original cookie)
  200 OK  { "accessToken": "...", "organizationId": "<Beta id>" }

GET /sites  Authorization: Bearer <Tab A token>   → 200 OK  (Alpha's sites)
GET /sites  Authorization: Bearer <Tab B token>   → 200 OK  (Beta's sites)
```

**Result: PASS.** Both refreshes against the same shared cookie succeeded — the second one landed inside the 10-second grace window (Gap 8's fix) rather than getting a spurious `401` — and each tab's resulting token independently, correctly resolves to its own organization. No leakage, no silent cross-tab switching.

---

## Scenario 6 — Refresh cycle

Refresh preserves organization affinity when the caller supplies it, and correctly omits it when the caller does not (rather than fabricating a default).

```
POST /auth/login  (single-org user)              → organizationId: <Alpha id>

POST /auth/refresh  {"organizationId":"<Alpha id>"}
  200 OK  { "accessToken": "...", "organizationId": "<Alpha id>" }   ← preserved

POST /auth/refresh  {}
  200 OK  { "accessToken": "...", "organizationId": null }          ← correctly omitted, not guessed
```

**Result: PASS.** Organization context survives rotation exactly when the caller asserts it, closing Gap 2 (`Refresh currently drops orgId`) from `DEC-022_DECISION.md`.

---

## Scenario 7 — Stolen access token

An access token alone (no refresh token) is confined to the one organization it was minted for — header forgery has no effect.

```
Attacker has only Tab A's Alpha-scoped access token.

GET /sites  Authorization: Bearer <Alpha token>                          → 200 OK (Alpha's own sites)
GET /sites  Authorization: Bearer <Alpha token>  X-Organization-Id: Beta → 200 OK (still Alpha's sites, empty array — Beta never touched)
```

**Result: PASS.** The forged header is silently ignored; the request resolves only via the token's own `orgId` claim, exactly as `DEC-022_DECISION.md`'s security rationale requires (Invariant 2/3).

A third check — using the stolen token to call `select-organization` into Beta — **succeeds**, because this particular victim (the multi-org fixture user) genuinely holds an ACTIVE Beta membership too. This is not a bug: it is the documented, accepted residual risk named in `DEC-022_DECISION.md`'s Security Implications section — an attacker with a still-valid access token can walk through every organization the _victim_ legitimately belongs to, more slowly and more visibly than under the rejected header-based models, but not zero. The audit trail below shows exactly how "more visibly" holds in practice.

---

## Scenario 8 — Invalid organization selection

`select-organization` targeting an organization the caller has no membership in fails loudly, distinct from `refresh`'s graceful degrade.

```
POST /auth/select-organization  Authorization: Bearer <pre-selection token>
                                 {"organizationId":"org-does-not-exist"}

403 Forbidden
{ "message": "Acceso a la organización denegado" }
```

**Result: PASS.**

---

## Audit trail evidence

Querying `AuditEvent` for the two fixture users after the scenarios above confirms every organization binding — automatic or explicit — is independently, distinguishably recorded:

```json
[
  {
    "action": "ORGANIZATION_SELECTED",
    "organizationId": "<Alpha>",
    "metadata": { "trigger": "auto", "reason": "single-membership-at-login" }
  },
  {
    "action": "ORGANIZATION_SELECTED",
    "organizationId": "<Beta>",
    "metadata": { "trigger": "explicit" }
  },
  {
    "action": "ORGANIZATION_SELECTED",
    "organizationId": "<Alpha>",
    "metadata": { "trigger": "auto", "reason": "single-membership-at-login" }
  },
  {
    "action": "ORGANIZATION_SELECTED",
    "organizationId": "<Beta>",
    "metadata": { "trigger": "explicit" }
  }
]
```

The third and fourth events correspond to Scenario 6's re-login and Scenario 7's stolen-token `select-organization` call, respectively — the latter is a first-class `ORGANIZATION_SELECTED(trigger: explicit)` event attributable to the exact organization and moment, which is precisely the audit signature `DEC-022_DECISION.md`'s Audit Rationale section names as the security-relevant improvement over the rejected header-override models (which left no such trace at all).

---

## Summary

| #   | Scenario                          | Result                                                          |
| --- | --------------------------------- | --------------------------------------------------------------- |
| 1   | Single-org user                   | PASS                                                            |
| 2   | Multi-org user                    | PASS                                                            |
| 3   | Organization switch               | PASS                                                            |
| 4   | Membership revocation             | PASS                                                            |
| 5   | Two tabs, different organizations | PASS                                                            |
| 6   | Refresh cycle                     | PASS                                                            |
| 7   | Stolen access token               | PASS (including its one documented, accepted residual exposure) |
| 8   | Invalid organization selection    | PASS                                                            |

All 8 scenarios named in WO-ARGOS-015 Objective 7 pass against a live server and a real database. Validation fixtures (2 organizations, 2 users, their memberships, refresh sessions, and audit events) were deleted from `movos_dev` immediately after this pass — nothing from this validation persists in the shared development database.
