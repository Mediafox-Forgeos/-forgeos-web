# CAP-009 — Invariants

**Generated:** 2026-08-03 (WO-ARGOS-017, Objective 5); hardened 2026-08-04 (WO-ARGOS-017A).
**Status:** VALIDATION. This document states, precisely and honestly, which of the five named invariants are enforced today, at what level (database vs. application-contract), and which are documented targets not yet backed by any enforcement mechanism.
**What changed in the WO-ARGOS-017A hardening pass:** the original version of this document found two of five invariants had real, unclosed gaps — 1b ("every session eventually has a `BillingAccount`," left nullable) and 5b ("`BillingAccount`s are never deleted," `SET NULL` let a delete succeed silently). ARGOS's review of PR #34 directed both to be closed, not merely re-documented. Both are now database-enforced — see Invariants 1 and 5, below. Invariant 4b (cross-snapshot currency consistency) was also closed, by a database trigger — see Invariant 4. This version does not just re-describe the original foundation; where a gap was closed, the enforcement mechanism is cited and verified, not assumed.
**Grounding discipline:** every claim below is checked directly against `apps/movos-api/prisma/schema.prisma`, the generated migration SQL, `information_schema.referential_constraints` on `movos_dev`, and `test/billing-foundation.e2e-spec.ts`'s real-Postgres assertions — not asserted from intent.

**Classification key**, reused for consistency with `CAP-008_BILLING_THREAT_MODEL.md`'s own discipline of naming exactly what's true rather than what was intended:

- **ENFORCED (database)** — a constraint that cannot be violated regardless of which code path is used, including a raw Prisma client call or a manual SQL statement.
- **ENFORCED (application contract)** — true for any code that goes through the defined service interface, but not backed by a database-level guarantee; a caller bypassing the interface (a raw Prisma call elsewhere in the codebase) is not stopped.
- **NOT ENFORCED (documented target)** — stated as an intended rule; nothing in this foundation currently guarantees it, at either level.

---

## 1. Every `ChargingSession` has exactly one `BillingAccount`

**ENFORCED (database), fully — hardened by WO-ARGOS-017A.** Originally split into two halves with a real, open gap on "at least one" (`billingAccountId` was nullable). ARGOS's review directed Option A: backfill every pre-existing session with a per-organization `SYSTEM_DEFAULT` `BillingAccount`, then make the column required. Both halves now hold unconditionally:

- **"At most one"** — `ChargingSession.billingAccountId` is a single scalar column, not an array or join table.
- **"At least one"** — the column is `String`, not `String?`. `ALTER TABLE "ChargingSession" ALTER COLUMN "billingAccountId" SET NOT NULL` (migration `20260804024402_backfill_and_require_billing_account`), applied only after every existing row was backfilled. A `NOT NULL` violation is a hard database error, not an application-layer check — verified in `test/billing-foundation.e2e-spec.ts` ("rejects creating a ChargingSession with no billingAccountId at the database level").

**A second, related invariant closed in the same pass: the referenced `BillingAccount` must belong to the same `Organization` as the session.** This was never one of the five originally named, but became a real gap the moment `billingAccountId` was going to be treated as load-bearing: the original single-column FK (`billingAccountId → BillingAccount.id`) let a session reference _any_ organization's `BillingAccount`, with nothing preventing a cross-tenant assignment. Closed with a composite foreign key — `ChargingSession.(organizationId, billingAccountId)` → `BillingAccount.(organizationId, id)` — verified live: an `UPDATE` attempting to assign a session a different organization's `BillingAccount` fails with `violates foreign key constraint "ChargingSession_organizationId_billingAccountId_fkey"` (`test/billing-foundation.e2e-spec.ts`, "rejects assigning a BillingAccount belonging to a different organization").

**What deployment shapes with no real debtor now do:** `CAP-008_BILLING_MODEL.md`'s headline finding — some sessions (an anonymous shopping-mall walk-up) may never have a real debtor — is not overridden by this hardening. Those sessions are attached to their organization's `SYSTEM_DEFAULT` placeholder account rather than left `NULL`. "Exactly one `BillingAccount`" and "not every session has a _real_ debtor" are both true simultaneously — the placeholder account is what makes that possible without violating the schema-level invariant.

## 2. Every `TariffSnapshot` belongs to one `ChargingSession`

**ENFORCED (database), fully.** `TariffSnapshot.chargingSessionId` is a required (`String`, not `String?`) foreign key with `RESTRICT` on delete (Prisma's default for a required relation). Both halves hold unconditionally: a snapshot cannot exist without a session (`NOT NULL`), and cannot reference more than one (scalar FK). No gap.

## 3. `TariffSnapshot`s are immutable

**ENFORCED (application contract), not database.** Two real signals back this: the model has no `updatedAt` column (a deliberate absence — see `CAP-009_TARIFF_SNAPSHOT_MODEL.md`), and `TariffSnapshotService`'s interface has no `update` method — `capture` is the only write path defined.

**The honest gap:** neither of these stops a raw `prisma.tariffSnapshot.update(...)` call written anywhere else in the codebase, or a manual `UPDATE` statement against the database directly. Nothing in this foundation adds a Postgres trigger, a `REVOKE UPDATE` permission, or any other database-level barrier — building one was judged out of scope for "design the entity" and "create interfaces only," the explicit boundaries of Objectives 2 and 4. **This is real, not theoretical: immutability holds only for code that is disciplined enough to go through `TariffSnapshotService`.** Whoever implements that service should not add an `update` method to it later without a very deliberate, separately-reviewed reason — doing so would be the single easiest way to silently break this invariant.

## 4. Session currency never changes

**Decomposes into two separate guarantees, evaluated separately — because "session currency" is not a stored field anywhere; `ChargingSession` has no `currency` column at all (consistent with the standing "`ChargingSession` does not grow pricing fields" constraint), so this invariant is entirely about the currency values on the entities CAP-009 _does_ define:**

- **`BillingAccount.currency` is immutable post-creation.** — **ENFORCED (application contract).** `BillingAccountService`'s interface has no `update` method of any kind — not just no currency-specific update, no update at all. The same raw-Prisma-bypass caveat from Invariant 3 applies identically here. Unchanged by WO-ARGOS-017A.
- **Every `TariffSnapshot` for the same `ChargingSession` shares the same `currency` as every other snapshot for that session.** — **ENFORCED (database) — hardened by WO-ARGOS-017A.** Originally the least-enforced invariant in this document (a cross-row rule no `CHECK` constraint can express, and the interface alone didn't structurally prevent it). Closed with a `BEFORE INSERT` trigger on `TariffSnapshot` (`trg_tariff_snapshot_currency_consistency`, migration `20260804024403_add_tariff_snapshot_currency_consistency_trigger`) that looks up any existing sibling snapshot for the same `chargingSessionId` and rejects the insert if the currency differs (Postgres `check_violation`, `23514`). Verified live: two same-currency snapshots for one session succeed; a third, mismatched one is rejected with an explicit error naming both currencies; two independent sessions may use two different currencies from each other without conflict (`test/billing-foundation.e2e-spec.ts`). See `CAP-009_TARIFF_SNAPSHOT_MODEL.md`'s "Currency consistency" section for the full trigger source and the three alternatives evaluated and rejected (application-only validation, a plain `CHECK` constraint, and a denormalized-`ChargingSession.currency`-plus-composite-FK design that has a bootstrapping problem Invariant 1's analogous fix didn't have).

## 5. `BillingAccount`s can be archived but never deleted

**"Archived"** — **ENFORCED (application contract).** `archive()` exists on `BillingAccountService` and is the only status-transition method defined; `BillingAccountStatus.ARCHIVED` is a real, reachable value.

**"Never deleted"** — **ENFORCED (database) for any `BillingAccount` actually in use — hardened by WO-ARGOS-017A.** Originally `ON DELETE SET NULL` (Prisma's default for the nullable relation Invariant 1 started with), meaning a raw `prisma.billingAccount.delete(...)` call would have succeeded silently, severing every referencing session's attribution rather than refusing. Closed as a direct consequence of Invariant 1's hardening: the foreign key is now explicitly `RESTRICT` (verified live against `information_schema.referential_constraints` on `movos_dev` — see `CAP-009_ARCHIVAL_POLICY.md` §7), and `test/billing-foundation.e2e-spec.ts` confirms a delete attempt against a referenced `BillingAccount` is rejected outright.

**The one residual gap, stated with the same honesty as before, not overclaimed:** `RESTRICT` only blocks deletion when a dependent row exists. A `BillingAccount` with zero referencing sessions — freshly created, never assigned — remains deletable via raw Prisma/SQL access; no foreign-key design closes this unconditionally (it would require revoking `DELETE` privileges at the database-permission level, a deliberate, separate decision, not a migration-level one). This exact tradeoff is evaluated in full in `CAP-009_ARCHIVAL_POLICY.md` §7, which is now the authoritative document for this invariant — this entry summarizes it, not duplicates it independently.

---

## Summary

| #   | Invariant                                                       | Status                                                                                                                |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1a  | Session has at most one `BillingAccount`                        | ENFORCED (database)                                                                                                   |
| 1b  | Session has at least one `BillingAccount`                       | **ENFORCED (database)** — hardened WO-ARGOS-017A (was NOT ENFORCED)                                                   |
| 1c  | The `BillingAccount` belongs to the session's own organization  | **ENFORCED (database)** — new, closed in the same pass as 1b (composite FK)                                           |
| 2   | Every `TariffSnapshot` belongs to exactly one `ChargingSession` | ENFORCED (database)                                                                                                   |
| 3   | `TariffSnapshot`s are immutable                                 | ENFORCED (application contract) — bypassable via raw Prisma access                                                    |
| 4a  | `BillingAccount.currency` never changes post-creation           | ENFORCED (application contract) — bypassable via raw Prisma access                                                    |
| 4b  | All of one session's `TariffSnapshot`s agree on currency        | **ENFORCED (database)** — hardened WO-ARGOS-017A (was NOT ENFORCED anywhere); trigger-based                           |
| 5a  | `BillingAccount`s can be archived                               | ENFORCED (application contract)                                                                                       |
| 5b  | `BillingAccount`s are never deleted (while referenced)          | **ENFORCED (database)** — hardened WO-ARGOS-017A (was NOT ENFORCED); `RESTRICT`, not unconditional — see caveat above |

**Five invariants are now fully database-enforced** (1a, 1b, 1c, 2, 4b), up from two in the original foundation. Three (3, 4a, 5a) hold for any code disciplined enough to go through the interfaces this foundation defines, with an explicit, named bypass (raw Prisma access) that nothing here closes — this class of gap is unchanged by WO-ARGOS-017A, which targeted the two specific issues ARGOS's review named (BillingAccount ownership, currency consistency) plus the archival-deletion question, not every application-contract-only guarantee in this document. The one remaining honestly-stated residual gap is 5b's narrow case: a never-referenced `BillingAccount` can still be deleted via raw access — closing that fully requires a database-permission change outside this migration's scope, as `CAP-009_ARCHIVAL_POLICY.md` §7 explains in full.
