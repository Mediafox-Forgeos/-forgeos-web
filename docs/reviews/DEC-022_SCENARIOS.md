# DEC-022 — Future Scenarios

**Generated:** 2026-08-02 (WO-ARGOS-014, Objective 5)
**Status:** Evaluation only. No option (A/B/C) recommended here — see the eventual `DEC-022_DECISION.md`.
**Companion to:** [DEC-022_MEMBERSHIP_MODEL.md](../domain/DEC-022_MEMBERSHIP_MODEL.md), [DEC-022_THREAT_MODEL.md](./DEC-022_THREAT_MODEL.md)

---

## The four attribution categories, distinguished explicitly

Every scenario below touches one or more of these. Conflating them is the single most likely way to get DEC-022 wrong, so they're named once, precisely, up front:

1. **Human web-session context** — which organization a logged-in person's browser session is scoped to, for UI/permission purposes. **This is the only category Options A/B/C are actually choices about.**
2. **Device/OCPP organization ownership** — resolved via the authenticated station's identity (`ocppIdentity` → `station.siteId` → `Site.organizationId`), established once per device connection/message, with no human session involved at any point. Unaffected by DEC-022's decision.
3. **Persisted business-record ownership** — the `organizationId` column stored once, at creation time, directly on a row (`ChargingSession`, `AuthorizationCredential`, `AuthorizationAttempt`, and any future `Invoice`), resolved from category 1 or 2 at that moment and immutable thereafter. Never re-derived from live session state on subsequent reads. Unaffected by DEC-022's decision once a record exists.
4. **Background-job attribution** — for any future asynchronous process (a scheduled invoice run, a batch report), the only correct source is category 3, read from the records being processed. There is no request, no session, no header for categories 1's options to apply to. **Options A/B/C are inapplicable here by construction**, not just by choice.

---

## Scenario 1 — Consultant with access to five customer organizations

**Category:** human web-session (1), pure.

- **Expected user behavior:** logs in once; needs to view/act across all five organizations over the course of a work session, switching between them repeatedly.
- **Organization-context source:** today, none deliberately — `organizations[0]` is silently fixed for the session. Under A: an explicit `select-organization` call per switch, one token per active selection. Under B: a per-request header the UI updates freely. Under C: a JWT default, overridable per request.
- **Audit behavior:** under A, every switch is a discrete, itemized `ORGANIZATION_SELECTED` event — a clean log of which of the five orgs the consultant touched and when. Under B, no equivalent event exists; the audit trail only shows per-resource actions tagged with whichever org each one carried, with no "the user is now working in Org X" marker. Under C, same as B whenever overridden.
- **Security implications:** this is precisely the profile Threat Model §6 names as highest-risk — a 5-membership user is the highest-blast-radius account type in the system if compromised. Under B/C, one stolen token exposes all five customers immediately. Under A, one stolen token exposes one customer; reaching the other four requires four additional, individually-audited steps.
- **Failure mode:** today, under any option, the consultant cannot deliberately choose an organization at all — stuck on whichever the database returns first. This scenario cannot function under _any_ option without new frontend work; it is not an A/B/C differentiator on its own.
- **Usability impact:** A requires an explicit switch action and a round trip per change (higher friction, unambiguous intent). B/C could support a lighter client-side switch (no round trip) — lower friction, weaker auditability, per the threat model.
- **Compatibility with current implementation:** none of the three work today as a real feature — no switcher UI exists under any of them.
- **Required future changes:** a switcher UI, regardless of option. Under A specifically: also address the refresh-rotation race (Threat Model §4) if switching is meant to be frequent, since each switch's token will periodically need re-establishing after a background refresh (see Scenario 6 for the full mechanics).

---

## Scenario 2 — Fleet operator managing customer charging infrastructure

**Category:** human web-session (1) — structurally the same membership pattern as Scenario 1 (one `Membership` row per customer org, `FLEET_MANAGER` role), but a materially different operational profile.

- **Expected user behavior:** near-continuous, higher-frequency monitoring/management across several client organizations' charging infrastructure — closer to a live dashboard than a consultant's occasional deep-dive.
- **Organization-context source:** same mechanisms as Scenario 1. The higher switching frequency is what distinguishes this scenario, not a different mechanism.
- **Important structural finding, stated plainly:** a true _aggregate_ cross-organization view ("show me all stations across my 3 managed customers in one screen") is **not achievable under any of A/B/C** — every list/read endpoint in the current API is scoped to exactly one resolved `organizationId` per request (confirmed in CAP-007's endpoint audit; no endpoint aggregates across organizations). Building one would be a new cross-tenant capability, which this work order explicitly forbids. What _is_ achievable under any option is "view one organization at a time, switch frequently" — the same capability as Scenario 1, just exercised harder.
- **Audit behavior:** identical mechanics to Scenario 1. Worth flagging a real tension specific to this scenario's frequency: under Option A, a legitimately fast-switching fleet operator would produce a _dense_ stream of `ORGANIZATION_SELECTED` events that could resemble the "same user selects 5 different organizations within 10 seconds" anomaly pattern Threat Model §6 flags as detectable for security purposes — meaning any future anomaly-detection built on that signal needs to distinguish a legitimate fleet operator's normal working pattern from an actual compromise, not just alarm on switching frequency alone.
- **Security implications:** same blast-radius analysis as Scenario 1, at higher exercise frequency.
- **Failure mode:** none beyond Scenario 1's.
- **Usability impact:** this is where Option A's per-switch round-trip cost is felt most acutely — if this operator switches organizations dozens of times a day, A's extra latency per switch compounds in a way it doesn't for Scenario 1's occasional consultant. This is a genuine, real usability cost of A specific to this scenario's frequency, stated honestly rather than minimized, without it being a recommendation either way.
- **Compatibility:** none today.
- **Required future changes:** same as Scenario 1, with the refresh-race mitigation (if Option A is chosen) becoming proportionally more important given the higher switching frequency.

---

## Scenario 3 — Support engineer with temporary organization access

**Category:** human web-session (1), combined with a membership-_lifecycle_ gap this scenario exposes directly.

- **Expected user behavior:** granted access to a customer's organization for the duration of a support ticket; access should end afterward, ideally automatically.
- **Organization-context source:** mechanically identical to any other membership-based access — the current schema has no concept of "temporary" at all (`MemberStatus` is `INVITED/ACTIVE/SUSPENDED`, no `expiresAt`). "Temporary" is a process/policy idea today, not an enforced one.
- **Audit behavior:** under A, entry could be bounded cleanly — `ORGANIZATION_SELECTED` marks the start, and (once a revoke mechanism exists) revocation's effect is immediate on the very next request, per Threat Model §3. Under B/C, no equivalent "granted access" event exists to bound the window from the audit trail alone.
- **Security implications:** this scenario is the sharpest validation of Threat Model §3's finding — revocation, once triggered, takes effect immediately regardless of option, because membership is re-checked fresh on every request rather than cached or trusted from a token. **What's missing is entirely administrative, not architectural**: no endpoint exists to grant, time-box, or revoke a membership at all.
- **Failure mode:** if a human operator forgets to revoke the engineer's access, it persists indefinitely — a process gap, identical under all three options, since none of A/B/C touch membership lifecycle.
- **Usability impact:** no meaningful differentiator between options for this scenario specifically.
- **Compatibility:** none today — no grant/invite flow of any kind exists.
- **Required future changes, common to all three options, not A/B/C-specific:** a membership lifecycle API (grant, revoke, and ideally time-boxed expiry). This is necessary regardless of which option DEC-022 eventually selects.

---

## Scenario 4 — User loses membership during an active human workflow

**Category:** human web-session (1) interacting with already-established access; option-invariant outcome.

- **Expected user behavior:** mid-task (e.g., partway through creating a Site and its Stations), an administrator revokes the user's membership in that organization from elsewhere.
- **Organization-context source:** whichever candidate organization id was already resolved before the revocation landed — irrelevant which option produced it, since the revocation check happens fresh on the _next_ request regardless.
- **Audit behavior:** the last successful action before revocation is recorded normally (with `organizationId`). The first action _after_ revocation takes effect fails at the guard layer before reaching any service or audit call — so no misleading audit record is created for the failed step. Worth flagging as a real, small gap this scenario surfaces: **rejected requests are not currently logged as their own event, only successes are** — a security-monitoring blind spot (no record of "someone kept trying after their access was pulled") that exists identically under all three options.
- **Security implications:** revocation takes effect immediately (Threat Model §3) — the user cannot continue writing to the now-forbidden organization once the revoking action lands server-side, under any option.
- **Failure mode:** exactly as traced in `DEC-022_MEMBERSHIP_MODEL.md` §3 — the next request either 404s (resource-ownership check fails to find the row under the new context) or 403s (the guard's own membership check fails outright). Fails safe. Fails confusingly — no in-context explanation is shown to the user.
- **Usability impact:** **this scenario's outcome is identical under A, B, and C** — all three rely on the same per-request guard re-check, and none of them change what happens once revocation lands. Worth stating plainly as a genuinely option-invariant finding, not a differentiator DEC-022 needs to weigh.
- **Compatibility:** already fails safe today, for whichever (currently nonexistent) revocation mechanism might trigger it.
- **Required future changes, option-invariant:** a clearer error message ("your access to this organization has changed") instead of a generic 404/403; optionally, logging rejected attempts, not only successes.

---

## Scenario 5 — Future human-initiated billing actions

**Category:** human web-session (1) as the _actor_, persisted business-record ownership (3) as the _subject_ — the scenario where conflating the two would be the costliest mistake.

- **Expected user behavior:** a staff member manually generates or adjusts a billing artifact — either (a) _for_ an existing `ChargingSession` (which already has its own immutable, device-resolved `organizationId`), or (b) an ad-hoc entry with no pre-existing record to inherit from.
- **Organization-context source — the critical distinction:**
  - **Case (a):** the _correct_ organization is the target session's own already-stored `organizationId` (category 3), never whatever the acting staff member's active human session happens to be scoped to (category 1). Any future invoice-creation code must validate the acting user's resolved request-context organization _against_ the target resource's own stored organization — exactly the same `getOwnedX`-style pattern every existing create/update service method already applies, just extended to a higher-stakes resource type. This is a design requirement independent of DEC-022's A/B/C choice.
  - **Case (b):** no prior record exists to cross-check against, so the request-level organization _is_ the only source of truth — and here, the full weight of Objective 2/4's A-vs-B/C analysis applies directly.
- **Audit behavior:** same discipline as every existing mutating endpoint (guard-resolved `organizationId`, passed explicitly) — already correct for what exists today. The stakes are simply higher: billing is the domain where Option C's silent header/default divergence (Threat Model, `DEC-022_MEMBERSHIP_MODEL.md` §3) is least tolerable, since a misattributed financial record is a business/compliance problem, not merely an inconvenient 404.
- **Security implications:** directly ties to Threat Model §6 — billing actions are exactly the human-initiated, request-scoped operations where Option A's narrower blast radius and auditable-expansion property matter most, because financial misattribution is a qualitatively worse failure than a misdirected read.
- **Failure mode:** a wrong-organization billing action, if it ever occurred, is a real business/compliance incident — unlike most other resources, where a wrong-org attempt simply 404s harmlessly.
- **Usability impact:** billing actions are typically deliberate and lower-frequency, unlike Scenario 2's rapid switching — so Option A's per-action friction, if selected, is far less costly here than in Scenario 2. Worth naming explicitly: **the usability cost of Option A is not uniform across scenarios** — it is negligible here and material in Scenario 2.
- **Compatibility:** not applicable — no Billing capability exists to evaluate against.
- **Required future changes, regardless of option:** invoice/financial-action code must (1) resolve organization context the same guard-based way every other endpoint does, and (2) cross-validate against the target resource's own persisted organization where one exists, rejecting mismatches rather than trusting either source unconditionally.

---

## Scenario 6 — Two browser tabs intentionally operating under different organizations

**Category:** human web-session (1), pure. **This is the scenario given special attention: can Option A support it without multiple refresh-token identities or unsafe client token handling?**

- **Expected user behavior:** a consultant or fleet operator deliberately opens Tab 1 pinned to Customer A and Tab 2 pinned to Customer B, to work on or compare both at once.

### Mechanism per option

**Option A — yes, achievable, using the existing single shared refresh identity, no unsafe token handling required.** Access tokens are already naturally per-tab (independent in-memory JS state per browser tab, confirmed in `DEC-022_MEMBERSHIP_MODEL.md` §2.5). Tab 1 can hold a token scoped to Org A while Tab 2 simultaneously holds a different token scoped to Org B — nothing prevents two differently-scoped, independently-valid access tokens from coexisting, since neither is tracked or capped server-side. The one genuine complication is refresh: the refresh cookie is browser-scoped, not tab-scoped, and `AuthService.refresh()` (a) rotates the single shared session on every call and (b) never carries `orgId` forward, under _any_ option (finding #4). **The resolution requires no new mechanism**: each tab independently calls `select-organization` for its own organization whenever its access token needs establishing — including immediately after any refresh cycle, since a refresh always resets to org-less regardless of which option is chosen. A single shared refresh cookie/session is sufficient; nothing about this requires storing the refresh token in JS-readable storage (which would be the "unsafe client token handling" this question was checking for) or minting multiple concurrent refresh identities per user beyond what `RefreshSession` already structurally permits without being used that way here.

- **Cost:** each tab now needs an extra `select-organization` round trip after every refresh cycle (roughly every 15 minutes per tab, independently timed) — more network chatter than a single-org session, not an architectural problem.
- **Sharpened risk:** the refresh-rotation race (Threat Model §4) becomes _more_ likely to actually manifest here specifically, because both tabs are now independently depending on timely refresh cycles rather than one tab passively coexisting. If both tabs' tokens happen to expire close together, near-simultaneous refresh calls against the shared cookie can produce one spurious `401` for the loser (no grace window exists today). **This makes addressing that race a concrete, elevated-priority required change specifically if Option A is chosen and this scenario is meant to be reliably, not just theoretically, supported.**

**Option B — mechanically simpler for this specific scenario, but with a distinct security tradeoff.** Each tab only needs its own client-side UI state (which org it's currently displaying) and sets the header per request accordingly; both tabs can trivially share the _same_ underlying access token, since the token itself carries no org restriction to conflict over. No refresh-race sharpening, because there's no tab-specific token state to re-establish after a refresh — the org choice lives entirely in per-request headers, decoupled from token lifecycle.

**Option C — identical to B for this scenario**, since both tabs are deliberately overriding whatever default the JWT carries; the default is irrelevant here.

- **Audit behavior:** none of the options let the backend see "which tab" made a request — that's an artifact of the browser the server has no visibility into, regardless of option. Option A produces two distinguishable _organization-selection_ streams (one per active token), which is the closest available proxy to per-tab attribution; B/C produce none.
- **Security implications — the one place this scenario changes Threat Model §6's picture rather than just restating it.** If one of the two tabs' credentials leaks under Option A, only that tab's token — and therefore only that tab's organization — is exposed; the other tab's session is a structurally separate credential, unaffected. Under B/C, since both tabs share the _same_ underlying token, a single leak exposes both tabs' organizations at once (and, per Threat Model §1, every other organization the user belongs to besides). **Option A has a materially stronger per-tab isolation property in this exact scenario** — not because of anything new, but because two-tabs-different-orgs is precisely the situation where A's "one token, one org" design pays off twice over.
- **Failure mode:** under A, an unaddressed refresh race produces an unpredictable, tab-specific `401` requiring the user to notice and retry — an availability papercut, not a data problem. Under B/C, no equivalent tab-specific failure exists, since both tabs share fate on one token.
- **Usability impact:** A requires slightly more setup per tab (an explicit selection step) but is otherwise seamless once established. B/C requires less per-tab bookkeeping to implement, at the cost of the leak-isolation property above.
- **Compatibility with current implementation:** neither works today — no switcher UI exists under any option, and while tabs are already naturally independent at the JS-state level, nothing lets a user deliberately pin a _specific_ organization to a _specific_ tab today (always defaults to `organizations[0]`).
- **Required future changes:** a switcher UI, regardless of option. Under Option A specifically: also address the refresh-rotation race — the one concrete blocker between "this works in principle" and "this works reliably in practice" for simultaneous multi-org tabs.

---

## Scenario 7 — Background jobs and asynchronous financial processing

**Category:** background-job attribution (4), pure — no human session, no device connection, no request of any kind.

- **Expected behavior:** no human user exists in this scenario — a scheduled job (e.g., nightly invoice generation) runs on its own.
- **Organization-context source:** must be the already-persisted `organizationId` on whatever records the job processes (e.g., `ChargingSession.organizationId`) — there is no HTTP request, header, or JWT for a job to read _any_ organization context from. **Options A, B, and C are entirely inapplicable to this scenario, by construction, not by choice.** This is the cleanest, most decisive finding in this whole document: DEC-022's eventual decision has zero bearing on this scenario's correctness.
- **Audit behavior:** a background job's audit events, if any, should record `organizationId` directly from the record being processed, with `actorUserId: null` (no human actor — correctly mirroring how `ConnectivityCoordinator`'s device-triggered events already handle the actor field). A future billing job must **not** repeat the specific gap `DEC-022_MEMBERSHIP_MODEL.md` §1/Objective 3 found in `ConnectivityCoordinator` today — omitting `organizationId` even when it's directly available on the record being acted on.
- **Security implications:** unrelated to A/B/C. The real access-control question here is whether the job process itself has correct, unspoofable, system-level access to the records it needs — a service-account/system-identity concern, structurally distinct from human membership, and explicitly out of this document's scope. Naming this distinction is itself the point: conflating "which organization is a background job acting for" with "which organization is a human session acting for" is exactly the category error the four-part framework at the top of this document exists to prevent.
- **Failure mode:** a future job that incorrectly derived organization context from some leftover human-session concept instead of from the record being processed would be a real correctness bug — the clearest possible illustration of why Objective 3's rule (financial records must denormalize organization from the underlying session, never from active human context) matters.
- **Usability impact:** not applicable.
- **Compatibility:** not applicable — no such job exists yet.
- **Required future changes, independent of DEC-022's A/B/C choice:** any future background financial process must read organization context exclusively from the records it processes, never from a request- or session-scoped mechanism.

---

## Scenario 8 — Organization switch during a multi-step form or wizard

**Category:** human web-session (1) interacting with persisted-record-ownership (3) — the concrete instance of `DEC-022_MEMBERSHIP_MODEL.md` §3's abstract finding.

- **Expected user behavior:** a multi-step flow (e.g., a "create Charging Station" wizard: select/create a Site, then add EVSEs, then add Connectors, each a separate request) where the active organization changes between steps — deliberately or accidentally — once any switching mechanism exists under any option.
- **Organization-context source:** whichever value is resolved live at the moment each step's request fires — read fresh, not snapshotted at the start of the flow, under the current implementation (`api-client.ts`'s header-building reads `getActiveOrganizationId()` fresh on every call).
- **Audit behavior:** step 1's creation event correctly records the organization active at that moment. If context changes before step 2, step 2's request resolves against the _new_ organization, its ownership lookup fails to find the first step's row under that new scope, and it 404s — no cross-organization write occurs, and (per Scenario 4's finding) the failed step produces no audit record of the attempt itself.
- **Security implications:** **safe, structurally, under all three options** — this is a concrete instance proving `DEC-022_MEMBERSHIP_MODEL.md` §3's general claim directly: the per-request ownership re-verification every existing create/update method already performs converts a mid-flow organization change into a confusing failure, never a silent cross-tenant write.
- **Failure mode:** the user's multi-step progress appears to break with a generic "not found" error and no explanation that their organization context changed underneath them mid-flow.
- **Usability impact — a genuine, non-obvious point in Option A's favor, balancing Scenario 2's critique of it:** Option A's higher-friction, deliberately explicit switching (a real `select-organization` call, not something ambient) makes an _accidental_ mid-flow switch considerably less likely to occur in the first place. Under B/C, if organization context lives in more easily/silently changeable state (a stray UI interaction, some future cross-tab sync mechanism), an accidental mid-flow switch becomes more plausible. **The friction Scenario 2 counts as a cost is, here, a safeguard** — the same property evaluated oppositely depending on the scenario, and both readings are legitimate; DEC-022 will need to weigh them against each other, not treat one as universally correct.
- **Compatibility:** today this specific failure cannot occur at all, precisely because no switching mechanism exists under any option — organization context is fixed for the whole session. It only becomes _possible_ once any form of switching is built, under any option — a consequence of shipping the feature at all, not a defect specific to whichever option is chosen.
- **Required future changes, independent of DEC-022's A/B/C choice:** any future multi-step flow should either snapshot organization context once at the start and hold it fixed for every step in that flow, and/or detect and clearly surface a "your organization context changed mid-flow" error rather than a generic 404. This is a frontend design requirement orthogonal to the backend-facing A/B/C choice.

---

## Cross-scenario summary

**Option-invariant findings (true regardless of DEC-022's eventual choice):** Scenario 4 (mid-flow revocation fails safe identically under all three), Scenario 7 (background jobs are outside A/B/C's scope entirely), the membership-lifecycle gap in Scenario 3 (a required build regardless of option), and the rejected-attempts audit gap surfaced in both Scenarios 4 and 8.

**Where the options genuinely diverge, and how sharply:** Scenarios 1, 2, and 6 turn on the blast-radius/auditability tradeoff `DEC-022_THREAT_MODEL.md` §6 already identifies as the central finding — Scenario 6 sharpens it further by showing Option A's per-tab credential isolation is _stronger_, not merely narrower, in the specific case of deliberately-simultaneous multi-org use. Scenario 5 shows the tradeoff's stakes are highest for billing specifically. Scenario 2 shows Option A's friction cost is real and scenario-dependent, not uniform — and Scenario 8 shows that same friction cutting the opposite way, as a safeguard rather than a cost, depending on what's being evaluated.

No recommendation given. Both this document and `DEC-022_THREAT_MODEL.md` are now complete and persisted, per your instruction to stop here before drafting `DEC-022_DECISION.md`.
