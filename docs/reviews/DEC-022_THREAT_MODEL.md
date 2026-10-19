# DEC-022 — Threat Model

**Generated:** 2026-08-02 (WO-ARGOS-014, Objective 4)
**Status:** Evaluation only. No option (A/B/C) recommended here — see the eventual `DEC-022_DECISION.md`.
**Companion to:** [DEC-022_MEMBERSHIP_MODEL.md](../domain/DEC-022_MEMBERSHIP_MODEL.md) (current-behavior baseline this threat model is evaluated against), [DEC-022_SCENARIOS.md](./DEC-022_SCENARIOS.md)
**Baseline assumption, stated once:** this entire analysis assumes the JWT signing secret (`JWT_ACCESS_SECRET`) itself is not compromised. A forged token for an arbitrary `sub` requires that secret; secret management is a separate, larger threat model, out of DEC-022's scope.

Classification key: **SAFE** (no material exposure) · **RISK** (a real exposure exists, bounded/detectable/tolerable) · **UNSAFE** (a real exposure exists with no bound, no detection path, or no acceptable tolerance).

---

## 1. Stolen JWT (access token)

The verdict depends critically on _what_ was stolen — collapsing this into one classification would hide the actual finding.

### 1a. Access token alone, briefly (leaked log line, one-shot XSS memory read, narrow MITM window) — no refresh token, no persistent device access

| Option | Classification    | Justification                                                                                                                                                                              |
| ------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | **RISK** (narrow) | Exposure bounded to exactly one organization — whichever the token's `orgId` claim names — for the remainder of its TTL (≤15 min default).                                                 |
| B      | **RISK** (wide)   | The token carries no org restriction. The thief acts as the user in **every** organization the user belongs to, immediately, by varying `X-Organization-Id`.                               |
| C      | **RISK** (wide)   | Identical exposure to B — the JWT "default" provides no protection, since `headerOrgId ?? user.orgId` lets any supplied header win; an attacker holding the raw token simply supplies one. |

### 1b. Full session compromise (access token _and_ refresh token, or persistent device/browser access)

| Option | Classification | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A      | **RISK**       | `selectOrganization()` requires only a currently-valid access token — no re-authentication, no step-up check. An attacker with a valid refresh token can mint fresh access tokens indefinitely and call `select-organization` once per organization to walk through all of the user's memberships sequentially. **Option A's blast-radius narrowing from 1a mostly evaporates here** — this is the single most important qualifier on the Objective 2 finding that A narrows blast radius; that benefit is real but scoped specifically to access-token-only compromise. |
| B      | **RISK**       | Same exposure as A in this case — full org list, reachable immediately either way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| C      | **RISK**       | Same as A/B.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

**Distinguishing detail carried into Objective 5/6:** under full-session compromise, A still produces one materially different artifact B/C cannot: each organization the attacker accesses under A requires a distinct, individually-audited `ORGANIZATION_SELECTED` event. A pattern of "same user selects 5 different organizations within 10 seconds" is a detectable anomaly shape unique to A. Under B/C, the same expanded access has no equivalent "moment of expansion" in the audit log — it is indistinguishable from a legitimate multi-org user's ordinary traffic.

---

## 2. Organization spoofing (claiming access to an org the caller has no membership in)

**SAFE — under all three options, unconditionally.**

`OrgContextGuard` performs a fresh `Membership.findUnique({ userId, organizationId })` lookup on every request, regardless of whether the candidate `organizationId` came from the header or the JWT claim. A client-supplied value is never trusted as authorization — only as a selector for which row to re-verify. Verified live in CAP-007's runtime validation: a bogus/nonexistent org header returns `403`, not `200`. Choosing A, B, or C only changes _which input_ supplies the candidate organization id to that same re-validation step — none of the three remove or weaken the step itself.

---

## 3. Stale / revoked membership

**SAFE, mechanically — with one honest caveat about what "safe" covers.**

Because membership is re-checked fresh on every request rather than cached or trusted from the token, revocation takes effect **immediately, on the very next request** — no propagation delay, no token blacklist needed, no cache to invalidate. A still-unexpired access token scoped to a since-revoked organization (via `orgId`, under A/C) becomes useless against that organization the instant the `Membership` row's status changes. True under any of A/B/C, since none of them propose caching or embedding membership status in the token itself.

Two caveats, stated precisely rather than left implicit:

- **No revoke-membership endpoint exists today** (confirmed in DEC-022_MEMBERSHIP_MODEL.md §1 — no code path creates, updates, or deletes a `Membership` row via the API). The enforcement mechanism is correct and already active; the administrative capability to trigger it doesn't exist yet.
- **`/auth/refresh` checks only `User.status`, never membership status.** A user whose sole membership was just revoked can still refresh indefinitely; the resulting tokens simply fail against that organization on first real use. This is correct — authentication and per-organization authorization are deliberately separate checks — and should not be "fixed" into checking membership at refresh time; that would conflate the two layers this design correctly keeps apart.

---

## 4. Multi-tab behavior

Two distinct mechanisms, previously untangled in DEC-022_MEMBERSHIP_MODEL.md §3, each with its own classification:

| Mechanism                     | Classification                         | Justification                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tab-to-tab organization drift | **RISK** (consistency, not isolation)  | Each tab independently re-derives `organizations[0]` from an unordered query at load time — two tabs opened at different moments can silently default to _different_ organizations with no indication to the user. Every request from either tab is still independently, correctly re-validated; no cross-tenant read/write is possible regardless of which org either tab lands on. |
| Refresh-token rotation race   | **RISK** (availability, not isolation) | The refresh cookie is browser-scoped, not tab-scoped. `AuthService.refresh()` unconditionally revokes-then-reissues with no grace window. Two tabs refreshing near-simultaneously on the same soon-to-be-stale cookie value produce one success and one spurious `401` for the loser — an innocent user logged out of one tab for no visible reason.                                 |

Neither mechanism is option-dependent — both sit below the A/B/C question, in query-ordering and refresh-rotation logic respectively.

---

## 5. Simultaneous organization switching

**SAFE at the data/isolation layer. RISK at the client state-management layer — currently latent, not yet reachable.**

Access tokens are stateless JWTs, never tracked server-side, never individually revocable (unlike `RefreshSession` rows). Two near-simultaneous `select-organization` calls for the same user simply mint two independently-valid tokens, each correctly scoped to whichever org it names, with no mutex and no invalidation of the other. `select-organization`'s only side effect is an audit record — there is no mutable server-side state to race over. **SAFE**, under any option.

The latent risk is entirely client-side: `apps/movos-web/src/lib/auth.ts` holds exactly one `accessToken` variable, assuming a single current token. A future switcher UI built on `select-organization` without addressing that assumption could let the in-memory token diverge from what the UI displays during a rapid switch — not a security exposure (whatever token ends up active still only grants access to the org it actually names), but a real correctness/UX trap. **RISK**, deferred — not present today, because no switcher UI exists yet to trigger it.

---

## 6. Does request-scoped (Option B) semantics increase blast radius of credential theft?

**Yes — unambiguously for the more common threat (§1a), with a narrower but still-present gap for the more severe threat (§1b).**

For access-token-only compromise — the realistic, most likely theft shape (XSS reading in-memory state, a leaked header, a narrow MITM window) — Option B (and, equally, Option C, whose "default" provides no actual protection per §1a and Objective 2) exposes **every organization the user belongs to, immediately, with no further attacker action beyond varying a header.** Option A confines the same theft to one organization for the remainder of the token's TTL. A concrete illustration using Objective 5's own consultant scenario: a consultant with memberships in five customer organizations has a blast radius of 1-in-5 under A versus 5-in-5 under B/C, for this specific, common incident class.

For full-session compromise (§1b), the gap narrows but does not disappear: Option A still forces the attacker through a separate, individually-audited `ORGANIZATION_SELECTED` call per organization — a detectable pattern with no equivalent under B/C, where the same widened access looks identical to ordinary legitimate multi-org traffic in the audit log.

**This is DEC-022's central security finding, not a marginal one:** the choice between B/C and A is, concretely, a choice between "one stolen access token exposes everything" and "one stolen access token exposes one organization, and expanding beyond it leaves a trace."

---

## Classification summary

| Scenario                   | A                                              | B                                              | C                                              |
| -------------------------- | ---------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Stolen access token only   | RISK (narrow — 1 org)                          | RISK (wide — all orgs)                         | RISK (wide — all orgs)                         |
| Full session compromise    | RISK (auditable expansion)                     | RISK (silent expansion)                        | RISK (silent expansion)                        |
| Organization spoofing      | SAFE                                           | SAFE                                           | SAFE                                           |
| Stale/revoked membership   | SAFE (mechanism); capability doesn't exist yet | SAFE (mechanism); capability doesn't exist yet | SAFE (mechanism); capability doesn't exist yet |
| Multi-tab org drift        | RISK (option-invariant)                        | RISK (option-invariant)                        | RISK (option-invariant)                        |
| Multi-tab refresh race     | RISK (option-invariant)                        | RISK (option-invariant)                        | RISK (option-invariant)                        |
| Simultaneous org switching | SAFE (data layer) / RISK (latent client-state) | SAFE (data layer) / RISK (latent client-state) | SAFE (data layer) / RISK (latent client-state) |

No scenario evaluated here reaches **UNSAFE** under any option — tenant data isolation itself (can Org A ever read Org B's rows) holds throughout every scenario, under every option, because none of them touch `OrgContextGuard`'s per-request membership re-validation. What differs materially across options is exposure _breadth_ and _auditability_ on credential theft (§1, §6) — not whether isolation holds at all.
