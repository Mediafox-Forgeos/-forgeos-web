# DEC-022 — Refresh-Race Grace Window: Precise Mechanics

**Generated:** 2026-08-03 (WO-ARGOS-015 follow-up, requested by ARGOS ahead of PR #31 review)
**Type:** Documentation only. No code was changed to produce this document — every claim below is traced directly against the implementation as it stands in `apps/movos-api/src/auth/auth.service.ts`'s `refresh()` method and `REFRESH_GRACE_WINDOW_MS` constant, cited by exact line-level behavior, not paraphrase.
**Status:** Awaiting ARGOS review. Nothing here supersedes `docs/domain/DEC-022_MIGRATION.md` §5 — this document answers the six specific questions ARGOS raised at a level of precision that summary didn't carry, and corrects one detail that summary understated (see §2 and the honest note in §5).

---

## 1. When does the 10-second grace window start?

**At the moment the presented refresh token is first marked revoked** — the exact instant the winning caller's `UPDATE "RefreshSession" SET "revokedAt" = now() ...` commits for that session row. This is a single, fixed timestamp (`session.revokedAt`), written once.

It is **not**:

- anchored to login time or original token issuance time;
- anchored to when a second tab _initiates_ its own refresh call;
- a rolling/sliding window that resets or extends each time another duplicate presentation of the same old token is tolerated.

Every subsequent presentation of that same now-revoked token computes the window fresh, against that one fixed timestamp:

```ts
const withinGraceWindow =
  session.revokedAt !== null &&
  Date.now() - session.revokedAt.getTime() <= REFRESH_GRACE_WINDOW_MS; // 10_000
```

Because the grace-window code path (see §6, `if (session.revokedAt === null)` false branch) deliberately does **not** re-write `revokedAt`, a duplicate presentation at t+3s does not push the deadline out to t+13s. The window closes at exactly `revokedAt + 10s`, regardless of how many tolerated duplicates land in between.

---

## 2. Two tabs / three tabs / five tabs

All three cases follow the identical mechanism — the code has no branch on tab count, no counter, and no cap on how many duplicate presentations of one revoked token it will tolerate within the window. What happens is only a function of **how many requests present the same token before it is either revoked or expires, and how close together in wall-clock time they arrive**.

**The scenario ARGOS is asking about — N tabs racing on the shared refresh cookie:**

For N tabs that all still hold the same original token `T0` (because their requests were dispatched before any of their siblings' `Set-Cookie` responses had landed) and present it to `/auth/refresh` within milliseconds of each other:

- Exactly one of them reads `session.revokedAt === null` **and executes the revoking UPDATE** — call this "the writer." (See the honest caveat below: for a sufficiently tight race, more than one request can execute that UPDATE; the _decision to proceed without a 401_ is what's single, not necessarily the write itself.)
- Every other one of the N requests, upon reading the row, sees `revokedAt` already set (or would have, had it read after the writer's commit) — but because that revocation is only 0–few milliseconds old, `withinGraceWindow` is true, so each is treated as a legitimate racing duplicate rather than a replay.
- **Every one of the N requests — the writer and every duplicate — reaches `issueRefreshToken()` and receives its own brand-new, independent, fully valid refresh session and access token.** There is no 401 for any of them, at 2, 3, or 5 tabs alike, as long as all N requests land within the 10-second window measured from the writer's single revocation timestamp.

**What actually differs between 2, 3, and 5 tabs is only exposure, not mechanism**: five simultaneous holders of one shared, about-to-be-revoked token produce five independent new sessions instead of two or three, but each one is issued by the exact same code path, under the exact same 10-second budget, with no per-count special-casing anywhere.

**The one honest correction to the informal "each tab gets its own session forever" framing:** the refresh token is carried in a single, origin-scoped, non-httpOnly-visible cookie shared by the browser across _all_ tabs — it is not a per-tab credential. After the race resolves, whichever tab's response the browser applies **last** is the one whose new refresh token ends up in that shared cookie going forward. The other tab(s)' newly-issued sessions are not revoked or invalidated by this — they remain valid, unexpired `RefreshSession` rows in the database — but nothing will present them again in ordinary operation, since the browser only ever sends the one cookie value it currently holds. This does not affect the property this design exists to prove (each tab's **access token**, and therefore its `orgId`, stays independently correct — see `docs/postmortems/DEC-022_VALIDATION.md` Scenario 5, which observed exactly this: both tabs' access tokens kept working and stayed correctly scoped). It only means the _refresh_-token layer underneath is a single shared resource with one surviving lineage per race, not N permanently parallel lineages — which matches `DEC-022_DECISION.md`'s original multi-tab conclusion verbatim: "using the existing single, shared, browser-scoped refresh session — no additional refresh-token identity ... is required."

If instead the N tabs' requests are spread out such that some arrive **after** the 10-second window has closed (e.g., a tab that was backgrounded and only fires its refresh 15 seconds after the others), that late request is rejected exactly as described in §3 — it does not matter whether it's tab 2 of 2 or tab 5 of 5.

---

## 3. Can an already-used refresh token be replayed outside the grace window?

**No — deterministically and unconditionally, no.** The rejection is not probabilistic and has no upper-bound loophole:

```ts
if (session.revokedAt !== null && !withinGraceWindow) {
  throw new UnauthorizedException('Sesión expirada');
}
```

Once `Date.now() - session.revokedAt.getTime() > 10_000`, every subsequent presentation of that exact token — the 1st attempt after the window closes, or the 1000th, seconds or years later — hits this branch and receives a hard `401`. `revokedAt` is never cleared, reset, or extended past its original write; there is no code path that resurrects a revoked session once its 10-second tolerance has elapsed. This is proven directly by the unit test `rejects a token revoked well outside the grace window` in `apps/movos-api/src/auth/auth.service.spec.ts` and the e2e assertion structure in `test/auth.e2e-spec.ts`.

---

## 4. Does refresh-token rotation still happen immediately?

**Yes, on every single successful call, without exception.** `issueRefreshToken()` — which creates a brand-new `RefreshSession` row and returns a brand-new opaque token — is called unconditionally on every code path that doesn't throw:

```ts
const refresh = await this.issueRefreshToken(user.id, ctx);   // always runs
if (session.revokedAt === null) {
  await this.prisma.refreshSession.update({ ... });            // only the "winner" also revokes the old one
}
```

The grace window does not defer, batch, skip, or make rotation conditional in any way. It only changes what happens to a request that presents a token which has _already_ been rotated away by someone else: instead of a hard `401`, that request is given its own new rotation, exactly as if it had presented a still-valid token. Rotation-on-use — the actual security property that limits how long a refresh token remains useful once presented — is fully intact for every caller, winner and duplicate alike.

---

## 5. Does the grace window weaken security guarantees?

**One specific, narrow, and precisely bounded weakening — yes. Nothing broader.** Stated exactly, not defensively:

**What is weakened:** strict single-use replay protection, for exactly 10 seconds. Without the grace window, presenting a refresh token a second time, ever, after it has been rotated once, would always fail. With it, a second (or third, fourth, fifth — see §2) presentation of that same already-rotated token succeeds if and only if it arrives within 10 seconds of the first rotation. Concretely: **if an attacker has captured a valid refresh token and the legitimate client rotates it before the attacker uses it, the attacker's copy is not immediately dead — they have up to 10 more seconds to present it and receive their own independent, fully valid session.** This is the residual risk already named in `DEC-022_MIGRATION.md` §5, restated here with the precise bound instead of the word "narrow" doing the work.

**What is explicitly not weakened:**

- **Membership-revocation immediacy (Invariant 6/7).** `OrgContextGuard` re-queries `Membership` fresh on every access-token-guarded request, entirely independent of this mechanism. Nothing about the grace window touches that check, and no code path in `refresh()` reads or writes `Membership`.
- **The baseline exposure of token theft itself.** An attacker holding _any_ valid, not-yet-rotated refresh token already has full account access via the ordinary, unmitigated path — they don't need the grace window at all if they use the token before the legitimate client's next rotation. The grace window's marginal contribution is only the extra ≤10 seconds _after_ legitimate rotation during which a copy still works; it does not create a new class of exposure, only extends an existing one's tail by a fixed, small amount.
- **Rotation-on-use itself** (§4) — even a grace-window-tolerated attacker replay still results in that specific old token becoming permanently unusable the moment the 10-second window closes; it does not grant an indefinitely-reusable token.
- **Secondary binding.** Worth stating plainly since it bears on this question: `refresh()` does not check the presenting request's IP address or User-Agent against what was recorded at issuance (`RefreshSession.userAgent`/`ipAddress` are written for forensic/audit purposes only and are never read back by `refresh()`). This was already true before the grace window existed — the grace window does not remove a check that used to exist; there was none to begin with.

**Why this trade was made anyway:** the alternative — full transactional serialization via `$transaction` + `SELECT ... FOR UPDATE` — was considered and rejected during design, not for being unsafe, but for solving a problem that doesn't need that much machinery: the actual failure mode this closes (`DEC-022_SCENARIOS.md` Scenario 6 — ordinary multi-tab usage producing a spurious logout) is a correctness bug for legitimate users, and the chosen fix trades a small, bounded, honestly-documented replay tail for not paying transactional-locking cost and latency on every refresh call, for a threat (an attacker who already possesses a valid stolen refresh token) against which this specific 10-second margin is not the dominant factor in their exposure either way.

---

## 6. Exact request timeline

Traced directly against `refresh()`'s literal statement order (§ line references above). Two tabs, both still holding original token `T0` because both requests were dispatched before either tab had observed the other's `Set-Cookie` response — i.e., the actual race condition this feature exists for.

```
TAB A                                          TAB B
──────────────────────────────────────────    ──────────────────────────────────────────
POST /auth/refresh  (presents T0)
                                                POST /auth/refresh  (presents T0)
  SELECT RefreshSession WHERE tokenHash=hash(T0)
  → found. revokedAt = NULL  (read #A)
                                                  SELECT RefreshSession WHERE tokenHash=hash(T0)
                                                  → found. revokedAt = NULL  (read #B — still
                                                    NULL: Tab A has not written yet)
  expiresAt check: OK
  revokedAt is NULL → grace-window branch
  not entered, no 401
                                                  expiresAt check: OK
                                                  revokedAt is NULL → grace-window branch
                                                  not entered, no 401
  SELECT User WHERE id=session.userId → ACTIVE
                                                  SELECT User WHERE id=session.userId → ACTIVE
  ── NEW TOKEN ISSUANCE (Tab A) ──
  INSERT RefreshSession (token=T_A, revokedAt=NULL)
                                                  ── NEW TOKEN ISSUANCE (Tab B) ──
                                                  INSERT RefreshSession (token=T_B, revokedAt=NULL)
  session.revokedAt (from read #A) was NULL →
  ── OLD TOKEN INVALIDATION (T0, by Tab A) ──
  UPDATE RefreshSession SET revokedAt=t9,
    replacedByTokenHash=hash(T_A) WHERE id=T0.id
                                                  session.revokedAt (from read #B) was ALSO NULL →
                                                  ── OLD TOKEN INVALIDATION (T0, by Tab B) ──
                                                  UPDATE RefreshSession SET revokedAt=t10,
                                                    replacedByTokenHash=hash(T_B) WHERE id=T0.id
                                                    (overwrites Tab A's write — see note below)
  200 OK { accessToken: <A's, orgId=Alpha>,
           refresh: T_A }
                                                  200 OK { accessToken: <B's, orgId=Beta>,
                                                           refresh: T_B }
```

**Read this timeline literally, not as an approximation:** in this specific interleaving, _both_ tabs observed `revokedAt = NULL` on their own read (because Tab B's read landed before Tab A's write committed), so _both_ execute the invalidation UPDATE against `T0`'s row — Tab B's write simply lands after Tab A's and overwrites `revokedAt`/`replacedByTokenHash` with its own values. This is safe and produces no incorrect outcome, for two reasons already established above: (1) each individual `UPDATE` statement is atomic — there is no torn or corrupted write, only a harmless last-write-wins on a field that (2) nothing downstream ever reads back to make a decision (`replacedByTokenHash` is write-only telemetry — see §5's grep-verified claim), and the `revokedAt` values written by A and B differ by low single-digit milliseconds, immaterial to a 10-second budget. **New-token issuance always precedes the old-token-invalidation write within a single request's own execution** (`issueRefreshToken()` is called before the conditional `update()`), and this order is identical for every caller — winner or duplicate — it is never reversed.

**If Tab B's read had instead landed _after_ Tab A's write committed** (a slightly less tight race — more common in practice than the fully-simultaneous case above), Tab B would have read `revokedAt` already non-`NULL` at read time, taken the grace-window branch instead (`withinGraceWindow` true, since the revocation is only milliseconds old), and — critically — **skipped the invalidation UPDATE entirely** (the `if (session.revokedAt === null)` guard, evaluated against Tab B's own stale read, would be false). The end state is functionally identical either way: two independent valid sessions issued, `T0` ends up revoked exactly once from the row's authoritative final state, no 401 for either tab.

**Generalizing to three or five tabs (§2):** the same timeline simply repeats with more concurrent reads of `T0`'s row before any UPDATE commits (or arriving as grace-window duplicates after one has). Every additional tab adds one more `SELECT → validate → issue → conditional-update` sequence in parallel; none of them are queued, throttled, or rejected for count — only for arriving after the fixed 10-second deadline from whichever write is the row's final one.

---

## Summary table

| Question                  | Answer                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grace window start        | The single timestamp the _first_ successful revocation of the presented token commits — fixed, never reset by later duplicates.                                                                                                                                                                                                                                                                                                     |
| 2 / 3 / 5 tabs            | Identical mechanism for any N; every request within the 10s window from the (single) revocation gets its own valid new session — no cap, no per-count branch. Only the browser's shared refresh cookie ends up pointing at whichever response's `Set-Cookie` was applied last.                                                                                                                                                      |
| Replay outside the window | Never succeeds. Deterministic, unconditional `401`, forever, no loophole.                                                                                                                                                                                                                                                                                                                                                           |
| Rotation-on-use           | Unchanged — happens on every successful call, winner or duplicate, no exceptions.                                                                                                                                                                                                                                                                                                                                                   |
| Security weakening        | One bounded one: a captured refresh token gets up to 10 extra seconds of usability past its legitimate rotation. Membership-revocation immediacy, baseline theft exposure, and rotation-on-use are all unaffected. No IP/User-Agent binding existed before this feature and none was removed by it.                                                                                                                                 |
| Exact ordering            | New-token issuance (`INSERT`) always precedes old-token invalidation (`UPDATE`) within a request; under a tight-enough race both tabs can execute the invalidation write (harmless, since it's write-only telemetry plus a millisecond-immaterial timestamp), or the second tab can instead take the grace-window branch and skip its own invalidation write — both outcomes are safe and equivalent from the caller's perspective. |
