# DEC-022 — Cross-Organization Membership Semantics: Decision

**Generated:** 2026-08-02 (WO-ARGOS-014, Objective 6)
**Status:** **ACCEPTED** — decided by ARGOS.
**Type:** Architecture Decision Record. Documentation only — no production code, schema, API, guard, frontend, dependency, or lockfile change is made by this document or this work order.
**Supersedes:** nothing formally shipped — this is the first explicit ruling on human organization-context semantics; prior behavior (`docs/domain/DEC-022_MEMBERSHIP_MODEL.md`) was undocumented, not previously decided.
**Evidence base:** [DEC-022_MEMBERSHIP_MODEL.md](./DEC-022_MEMBERSHIP_MODEL.md) (current behavior), [DEC-022_THREAT_MODEL.md](../reviews/DEC-022_THREAT_MODEL.md) (security evaluation), [DEC-022_SCENARIOS.md](../reviews/DEC-022_SCENARIOS.md) (future-scenario evaluation). All three are preserved as-written, including their "no recommendation given" language at the time they were produced — this document is where the recommendation is made, not a retroactive edit of the evaluation that preceded it.

---

## Chosen model: Option A — Single Active Organization (session-scoped organization context)

A human access token is bound to exactly one organization for its entire validity window. Switching organizations is an explicit, authenticated, audited act — never an incidental side effect of a header value.

### The model, as decided, in full

1. A human access token is bound to exactly one active organization.
2. The active organization is carried in the JWT `orgId` claim.
3. `X-Organization-Id` must **not** override the JWT organization for normal organization-scoped human requests.
4. Switching organization requires an explicit `select-organization` operation that mints a new access token.
5. Every organization switch must emit an auditable `ORGANIZATION_SELECTED` event.
6. `OrgContextGuard` must continue re-validating the user's active `Membership` on every request.
7. Membership revocation must take effect immediately on the next request.
8. Human web-session context remains separate from: OCPP/device ownership; `ChargingSession` ownership; `AuthorizationCredential` ownership; future `Invoice` ownership; background-job attribution.
9. Business records must persist their own `organizationId` at creation and must never derive ownership later from a human user's active organization.
10. Two browser tabs may operate under different organizations using independent in-memory access tokens while sharing the existing browser-scoped refresh session.
11. The organization selected in a tab must remain stable across token refresh.
12. `organizations[0]` must not remain the long-term default-selection mechanism.
13. No hybrid header override is permitted for ordinary human organization-scoped operations.

Rules 6–9 are not new — they are already-true properties of the current implementation, restated here as permanent constraints the chosen model must not regress (verified directly in `DEC-022_MEMBERSHIP_MODEL.md` §1–2 and `DEC-022_ISOLATION`-adjacent evidence in the CAP-007 audit line of work). Rules 1–5, 10–13 are the substantive decision — most require implementation work not yet done (see Gaps, below).

---

## Rejected: Option B — Request-scoped organization via `X-Organization-Id`

**Rejected.** Reasons, as decided:

- Wider access-token theft blast radius — a stolen token exposes every organization the holder belongs to, immediately, by varying a header (`DEC-022_THREAT_MODEL.md` §1a/§6).
- Weaker session-wide auditability — no single event marks "the user is now acting for Organization X"; only per-resource records exist, each independently attributed (`DEC-022_THREAT_MODEL.md` §1b).
- Higher risk of mistaken human financial actions — nothing above per-request header discipline catches a wrong organization on any single billing-relevant call (`DEC-022_SCENARIOS.md` Scenario 5).
- No explicit, auditable organization-switch event — organization changes leave no discrete trace distinguishable from ordinary multi-org traffic (`DEC-022_THREAT_MODEL.md` §6).

## Rejected: Option C — Hybrid JWT default plus header override

**Rejected.** Reasons, as decided:

- Weakest audit semantics of the three options evaluated — inherits B's per-request variability while adding a JWT-level "default" that implies session commitment the model doesn't actually enforce (`DEC-022_THREAT_MODEL.md` summary table; `DEC-022_MEMBERSHIP_MODEL.md` §2.4).
- Silent divergence between the organization a user explicitly selected and the organization a given request actually resolves to, with the current `AuditEvent` schema unable to distinguish the two after the fact.
- Same stolen-token blast radius as B — the JWT default provides no protection, since `headerOrgId ?? user.orgId` lets any supplied header win.
- Misleading appearance of session commitment — the explicit `select-organization` step suggests a stable, deliberate choice that any single request can silently defy.

---

## Security rationale

The deciding evidence is `DEC-022_THREAT_MODEL.md` §6: for the most common credential-theft shape (a leaked access token, without the paired refresh token) Option A confines exposure to one organization for the remainder of the token's TTL (≤15 minutes today), while B/C expose every organization the user belongs to immediately. For the more severe but less common full-session-compromise case, A's advantage narrows but does not disappear — it forces an attacker into a sequence of individually-audited `ORGANIZATION_SELECTED` calls to expand access, a pattern with no equivalent shape under B/C, where the same expanded access is indistinguishable from ordinary legitimate multi-org traffic. `DEC-022_SCENARIOS.md` Scenario 6 sharpens this further: under A, two simultaneously-open browser tabs scoped to different organizations hold two structurally separate credentials, so a leak of one tab's session does not expose the other's — a property B/C cannot offer at all, since both tabs would share one undifferentiated token.

This is accepted as the correct trade against Option A's real, named costs: additional round-trips per organization switch (material for a fast-switching fleet operator, per `DEC-022_SCENARIOS.md` Scenario 2; negligible for a deliberate, low-frequency billing action, per Scenario 5), and the requirement to fix token refresh to preserve organization context (Gap 2, below) before the model functions correctly at all.

## Audit rationale

Every organization switch becomes a first-class, queryable event (`ORGANIZATION_SELECTED`, already implemented and already recording `organizationId` correctly — the only piece missing is a caller). This directly answers `DEC-022_MEMBERSHIP_MODEL.md`'s Objective 3 question "can billing occur under the wrong organization?": for human-initiated financial actions, the acting organization is now a single, explicit, previously-established fact for the whole token lifetime, not a per-call variable that has to be independently correct on every request with no session-level backstop. This does not, by itself, close the two independent audit gaps this work order's evidence surfaced (`ConnectivityCoordinator`'s missing `organizationId`, the unaudited OCPP session lifecycle) — those are unrelated to human session semantics and are recorded separately below as independent debt, not resolved by this decision.

## Multi-tab conclusion

**Two tabs operating under different organizations is supported by the chosen model, using the existing single, shared, browser-scoped refresh session — no additional refresh-token identity and no unsafe client-side token storage is required.** Access tokens are already naturally per-tab (independent in-memory JS module state per tab); nothing prevents two differently-scoped tokens from coexisting, since neither is capped or mutually exclusive server-side. Each tab independently calls `select-organization` to establish its own token, including after every refresh cycle, since refresh does not currently — and per rule 11, must be fixed to — preserve organization context across rotation. The one concrete risk this conclusion depends on resolving is the refresh-token rotation race (Gap 8): today, two tabs refreshing near-simultaneously against the shared cookie can produce one spurious `401`. Rule 11 makes fixing or otherwise absorbing that race a requirement of this decision, not an optional hardening pass — see Gap 8's classification below.

---

## Current implementation gaps, classified

None of the following are fixed by this document. This is a record of what a future implementation work order must address, and why each item falls where it does.

| #   | Gap                                                                                                                           | Classification                      | Reasoning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Login does not currently set `orgId`                                                                                          | **Required to implement DEC-022**   | Rule 1 requires every human access token to be bound to one organization; today's login token is bound to none. The fix may live in the frontend (call `select-organization` immediately post-login, auto-selecting when the user has exactly one membership) and/or the backend (auto-populate `orgId` at login when unambiguous) — the exact mechanism is implementation detail left to that future work order, but closing the gap is required for rule 1 to hold at all.                                                                |
| 2   | Refresh currently drops `orgId`                                                                                               | **Required to implement DEC-022**   | Directly named by rule 11 ("must remain stable across token refresh"). Without this fix, every session silently loses organization context on a ~15-minute cycle, which breaks the model's core premise, not just a convenience.                                                                                                                                                                                                                                                                                                            |
| 3   | Frontend never calls `select-organization`                                                                                    | **Required to implement DEC-022**   | Rule 4 requires switching to be an explicit `select-organization` call; nothing in the running frontend invokes it today. No amount of backend correctness satisfies rule 4 without this.                                                                                                                                                                                                                                                                                                                                                   |
| 4   | Frontend silently uses non-deterministic `organizations[0]`                                                                   | **Required to implement DEC-022**   | Directly named by rule 12. Must be replaced by a deliberate default (e.g., auto-select when exactly one membership exists; otherwise require explicit selection) as part of the same frontend work as Gaps 1 and 3.                                                                                                                                                                                                                                                                                                                         |
| 5   | No organization-switcher UI exists                                                                                            | **Required to implement DEC-022**   | Rule 4's explicit switch has no user-facing trigger without one. The minimum viable form (e.g., a dropdown calling the already-implemented, already-tested `select-organization` endpoint) is required; further UI polish is not mandated by this decision.                                                                                                                                                                                                                                                                                 |
| 6   | `ConnectivityCoordinator` audit events omit resolvable `organizationId`                                                       | **Independent security/audit debt** | A pre-existing gap in already-shipped, device-triggered code (CAP-005) — category 2/3 attribution (`DEC-022_SCENARIOS.md`'s four-part framework), not human session context. Equally present or absent regardless of whether A, B, or C had been chosen; not created by, required by, or resolved by this decision.                                                                                                                                                                                                                         |
| 7   | OCPP charging-session lifecycle (`Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction`) emits no audit events at all | **Independent security/audit debt** | Same reasoning as Gap 6 — a device-triggered code path entirely outside human session semantics. Notable as the most billing-relevant gap in the system today, but not something DEC-022's choice of A over B/C causes or fixes.                                                                                                                                                                                                                                                                                                            |
| 8   | Multi-tab refresh-token rotation race can produce a spurious `401`                                                            | **Required to implement DEC-022**   | `DEC-022_SCENARIOS.md` Scenario 6 found this race is _sharpened_, not merely inherited, by the chosen model — two tabs under Option A both depend on independently-timed refresh cycles against one shared cookie, making near-simultaneous collisions more likely than under B/C. Rule 10 explicitly commits to reliable two-tab support as part of the chosen model; leaving this race unaddressed would make that commitment flaky in practice, not just theoretically satisfied. Classified required, not merely recommended hardening. |
| 9   | Membership lifecycle APIs (grant/revoke/time-boxed access) do not yet exist                                                   | **Future capability**               | Established in `DEC-022_SCENARIOS.md` Scenario 3 as necessary regardless of which option had been chosen — orthogonal to the A/B/C decision entirely. Option A functions correctly today with membership rows created out-of-band, exactly as it does now; this gap blocks Scenario 3 (temporary support access) specifically, not this decision's model.                                                                                                                                                                                   |

**Summary:** 6 gaps required to implement DEC-022 as decided (1, 2, 3, 4, 5, 8) — all frontend-plus-`AuthService`-plus-`OrgContextGuard` work, no schema migration among them. 2 gaps are independent, pre-existing audit debt unrelated to this decision (6, 7). 1 gap is a genuinely separate future capability (9).

---

## Migration impact

**No database schema change is required by this decision.** `RefreshSession` needs no new column — organization context lives only in the access token's claim, never in the refresh layer itself; "stability across refresh" (rule 11) is a service-logic fix to `AuthService.refresh()` (carry the presented token's `orgId` into the newly-minted one), not a data-model change.

**The single most consequential code change this decision requires:** `OrgContextGuard`'s current `const organizationId = headerOrgId ?? user.orgId;` must change so the header no longer contributes to or overrides the resolved organization for ordinary human-facing, organization-scoped requests (rule 3, rule 13) — the JWT claim becomes the only accepted source. This is a real, security-relevant behavior change to already-shipped, already-tested code, not a cosmetic one, and must be implemented and tested carefully by whichever future work order executes this decision — explicitly not by this one.

**Frontend impact:** a real, multi-part change — auto/explicit selection immediately after login (Gap 1), a switcher UI (Gap 5), replacing the `organizations[0]` default (Gap 4), and handling the now-required post-refresh re-selection per tab (Gap 8's fix depends on this). None of this is implemented here.

**No dependency, lockfile, or API-contract change** is implied by this decision — `select-organization`, `/auth/me`, `/auth/refresh`, and `/auth/login`'s response shapes are unchanged; only their internal logic and the frontend's use of them change.

## Security implications

The accepted trade is stated once, plainly: Option A meaningfully narrows the blast radius of the single most common credential-theft shape (access-token-only compromise) and adds a genuine audit signature to the more severe case (full-session compromise), at the cost of implementation work (Gaps 1–5, 8) and some per-switch latency for high-frequency multi-org users. It does **not** eliminate the full-session-compromise exposure (`DEC-022_THREAT_MODEL.md` §1b) — an attacker holding both the access and refresh tokens can still walk through every organization a user belongs to, just more slowly and more visibly than under B/C. This residual risk is accepted, not resolved, by this decision, and should not be mistaken for a claim that Option A makes full-session compromise safe.

## Future constraints

Any future capability — Billing, RFID, a future `SUPER_ADMIN`/platform-staff surface, background financial jobs — must respect the four-part attribution framework `DEC-022_SCENARIOS.md` establishes: human web-session context (this decision's subject) is never the source of truth for device/OCPP ownership, persisted business-record ownership, or background-job attribution. Concretely: a future `Invoice` model must denormalize `organizationId` from the `ChargingSession` it bills, never from whichever organization the issuing staff member's session happened to be scoped to at generation time (`DEC-022_SCENARIOS.md` Scenario 5, Scenario 7). This constraint holds regardless of anything else these future capabilities decide, and does not need to be re-litigated when they're designed.
