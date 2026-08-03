# CAP-009 — Invariants

**Generated:** 2026-08-03 (WO-ARGOS-017, Objective 5)
**Status:** VALIDATION. This document states, precisely and honestly, which of the five named invariants are enforced today, at what level (database vs. application-contract), and which are documented targets not yet backed by any enforcement mechanism. It does not add code to close any gap it finds — closing a gap found here is a decision for whoever reviews this document, not something this foundation does unilaterally.
**Grounding discipline:** every claim below is checked directly against `apps/movos-api/prisma/schema.prisma`, the generated migration SQL, and the two interface files on this branch — not asserted from intent.

**Classification key**, reused for consistency with `CAP-008_BILLING_THREAT_MODEL.md`'s own discipline of naming exactly what's true rather than what was intended:

- **ENFORCED (database)** — a constraint that cannot be violated regardless of which code path is used, including a raw Prisma client call or a manual SQL statement.
- **ENFORCED (application contract)** — true for any code that goes through the defined service interface, but not backed by a database-level guarantee; a caller bypassing the interface (a raw Prisma call elsewhere in the codebase) is not stopped.
- **NOT ENFORCED (documented target)** — stated as an intended rule; nothing in this foundation currently guarantees it, at either level.

---

## 1. Every `ChargingSession` has exactly one `BillingAccount`

**Split into two independent halves, because they have different answers:**

- **"At most one"** — **ENFORCED (database).** `ChargingSession.billingAccountId` is a single scalar foreign key, not an array or join table. A session structurally cannot reference two `BillingAccount` rows at once.
- **"At least one" (every session eventually has one)** — **NOT ENFORCED (documented target).** `billingAccountId` is nullable (`String?`). This is deliberate, not an oversight, for two independently sufficient reasons already established in `CAP-009_TARIFF_SNAPSHOT_MODEL.md`: no historical session can be retroactively assigned one, and `CAP-008_BILLING_MODEL.md`'s own headline finding is that some real deployment shapes (an anonymous shopping-mall walk-up) may never have a persisted debtor at all.

**Verdict:** "exactly one" as literally stated is not true today. The accurate invariant this foundation actually provides is **"at most one, and exactly one for any session that has been billed."** Whoever eventually decides that every session _must_ resolve to a `BillingAccount` before completion would need to add that as an application-level rule in a future session-completion workflow — this foundation deliberately does not force it, because forcing it now would misrepresent the deployment shapes `CAP-008_SCENARIOS.md` already validated.

## 2. Every `TariffSnapshot` belongs to one `ChargingSession`

**ENFORCED (database), fully.** `TariffSnapshot.chargingSessionId` is a required (`String`, not `String?`) foreign key with `RESTRICT` on delete (Prisma's default for a required relation). Both halves hold unconditionally: a snapshot cannot exist without a session (`NOT NULL`), and cannot reference more than one (scalar FK). No gap.

## 3. `TariffSnapshot`s are immutable

**ENFORCED (application contract), not database.** Two real signals back this: the model has no `updatedAt` column (a deliberate absence — see `CAP-009_TARIFF_SNAPSHOT_MODEL.md`), and `TariffSnapshotService`'s interface has no `update` method — `capture` is the only write path defined.

**The honest gap:** neither of these stops a raw `prisma.tariffSnapshot.update(...)` call written anywhere else in the codebase, or a manual `UPDATE` statement against the database directly. Nothing in this foundation adds a Postgres trigger, a `REVOKE UPDATE` permission, or any other database-level barrier — building one was judged out of scope for "design the entity" and "create interfaces only," the explicit boundaries of Objectives 2 and 4. **This is real, not theoretical: immutability holds only for code that is disciplined enough to go through `TariffSnapshotService`.** Whoever implements that service should not add an `update` method to it later without a very deliberate, separately-reviewed reason — doing so would be the single easiest way to silently break this invariant.

## 4. Session currency never changes

**Decomposes into two separate guarantees, evaluated separately — because "session currency" is not a stored field anywhere; `ChargingSession` has no `currency` column at all (consistent with the standing "`ChargingSession` does not grow pricing fields" constraint), so this invariant is entirely about the currency values on the entities CAP-009 _does_ define:**

- **`BillingAccount.currency` is immutable post-creation.** — **ENFORCED (application contract).** `BillingAccountService`'s interface has no `update` method of any kind — not just no currency-specific update, no update at all. The same raw-Prisma-bypass caveat from Invariant 3 applies identically here.
- **Every `TariffSnapshot` for the same `ChargingSession` shares the same `currency` as every other snapshot for that session, and as the session's `BillingAccount` if one is assigned.** — **NOT ENFORCED (documented target), at any level.** This is a cross-row consistency rule — "does this new snapshot's currency match the currency every prior snapshot for this session already used" — which a Postgres `CHECK` constraint cannot express (a `CHECK` only ever sees one row in isolation) and which `TariffSnapshotService.capture()`'s interface signature does not structurally prevent either (it takes a `currency` string with no requirement that it be validated against the session's prior snapshots). **This is the least-enforced of the five invariants named in this work order**, and the one most in need of explicit handling by whoever writes `TariffSnapshotService`'s concrete implementation: `capture()` must look up the session's existing snapshots (or its `BillingAccount`) and reject a mismatched currency before insert, exactly the same "validate before write" discipline `CAP-004` already established for rejecting a negative `energyWh`.

## 5. `BillingAccount`s can be archived but never deleted

**"Archived"** — **ENFORCED (application contract).** `archive()` exists on `BillingAccountService` and is the only status-transition method defined; `BillingAccountStatus.ARCHIVED` is a real, reachable value.

**"Never deleted"** — **NOT ENFORCED (database), and this is the most important finding in this document.** `BillingAccountService` has no `delete` method, which stops any caller going through the service — but the foreign key from `ChargingSession.billingAccountId` to `BillingAccount` is `ON DELETE SET NULL` (Prisma's own default for a nullable/optional relation, confirmed directly in the generated migration SQL: `ALTER TABLE "ChargingSession" ADD CONSTRAINT "ChargingSession_billingAccountId_fkey" ... ON DELETE SET NULL`). This means **a raw `prisma.billingAccount.delete(...)` call, issued from anywhere else in the codebase, would succeed today** — any `ChargingSession` rows referencing that account would simply have `billingAccountId` set to `NULL`, not block the delete. This is the one exception found so far to `CAP-008_BILLING_MODEL.md` Objective 3's finding that no `onDelete` cascade exists anywhere in this schema; it is a direct, structural consequence of `billingAccountId` being nullable at all (Invariant 1), not an independent oversight.

**A real design tradeoff worth naming explicitly, not silently resolved:** changing this foreign key to `RESTRICT` instead of `SET NULL` would strengthen "never deleted" for any `BillingAccount` that already has at least one referencing session — but would _not_ achieve an unconditional guarantee either, since `RESTRICT` only blocks deletion when a dependent row exists; a freshly created, never-yet-used `BillingAccount` could still be deleted under `RESTRICT` just as easily as under `SET NULL`. A truly unconditional "never deleted, full stop" is not achievable through foreign-key design alone — it requires either revoking `DELETE` privileges on the table at the database-permission level, or accepting an application-contract-only guarantee (no `delete` method) as sufficient, which is the choice this foundation makes. **This document deliberately does not change the migration to resolve this** — surfacing the exact mechanism and its limits precisely is this work order's Objective 5 mandate; deciding whether to hardened it further is left for ARGOS's review.

---

## Summary

| #   | Invariant                                                       | Status                                                                |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1a  | Session has at most one `BillingAccount`                        | ENFORCED (database)                                                   |
| 1b  | Session has at least one `BillingAccount`                       | NOT ENFORCED (documented target — deliberate)                         |
| 2   | Every `TariffSnapshot` belongs to exactly one `ChargingSession` | ENFORCED (database)                                                   |
| 3   | `TariffSnapshot`s are immutable                                 | ENFORCED (application contract) — bypassable via raw Prisma access    |
| 4a  | `BillingAccount.currency` never changes post-creation           | ENFORCED (application contract) — bypassable via raw Prisma access    |
| 4b  | All of one session's `TariffSnapshot`s agree on currency        | NOT ENFORCED anywhere — the weakest invariant in this document        |
| 5a  | `BillingAccount`s can be archived                               | ENFORCED (application contract)                                       |
| 5b  | `BillingAccount`s are never deleted                             | NOT ENFORCED (database) — the most important finding in this document |

Two invariants (2, and the "at most one" half of 1) are fully database-enforced. Three (3, 4a, 5a) hold for any code disciplined enough to go through the interfaces this foundation defines, with an explicit, named bypass (raw Prisma access) that nothing here closes. Two (1b, 4b) are documented targets with no enforcement at all today, and 5b is a database-level gap with a structural cause (the `SET NULL` FK) rather than a missing check. None of this is presented as a defect to be quietly fixed — it is the honest state of a foundation whose own scope was deliberately "schema and interfaces only, no logic."
