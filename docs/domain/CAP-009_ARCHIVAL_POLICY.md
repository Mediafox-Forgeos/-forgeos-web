# CAP-009 — BillingAccount Archival Policy

**Generated:** 2026-08-04 (WO-ARGOS-017A, Objective 3)
**Status:** IMPLEMENTED. Every `ON DELETE` behavior stated below is quoted directly from `information_schema.referential_constraints` on `movos_dev` after this work order's migrations were applied — not read from `schema.prisma` alone, and not assumed.
**Materializes:** the archival-policy gap ARGOS's review of PR #34 found — the original `ChargingSession → BillingAccount` foreign key was `ON DELETE SET NULL` (Prisma's default for a nullable relation), which this document evaluates and replaces.

---

## 1. Can a `BillingAccount` ever be hard-deleted?

**No public path exists, and — as of this work order — the database itself refuses whenever the account is actually in use.**

`BillingAccountService`'s interface has no `delete` method (unchanged from the original CAP-009 foundation) — no public endpoint, no service method, nothing this codebase exposes can delete a `BillingAccount`, per this work order's explicit "do not add a public delete endpoint" instruction.

**What changed:** previously, a raw `prisma.billingAccount.delete(...)` call — bypassing the (nonexistent) service entirely — would have succeeded even for a `BillingAccount` with referencing `ChargingSession` rows, because the FK was `SET NULL`. As of this work order, that same raw call **fails** for any `BillingAccount` with at least one referencing session: the FK is now `RESTRICT` (verified live against `movos_dev`, see §7). A `BillingAccount` genuinely never referenced by any session — freshly created, never assigned — remains deletable via raw Prisma access; no FK design can prevent that unconditionally (§7 explains why). This residual, narrow gap is stated plainly, not hidden: closing it fully would require revoking `DELETE` privileges on the table at the database-permission level, which is an infrastructure/operations decision, not a schema change, and is out of scope for this migration-level hardening pass.

## 2. Is archival the only allowed lifecycle operation?

**Yes.** `BillingAccountStatus` has exactly two values (`ACTIVE`, `ARCHIVED`); `archive()` is the only status-transition method on the interface. No `unarchive`, no `suspend`, no `update` of any kind exists — unchanged from the original foundation, reaffirmed here rather than revisited, since nothing in this work order named a reason to add one.

## 3. What happens to historical `ChargingSession` rows?

**Nothing.** Archiving a `BillingAccount` flips one field (`status`) on the `BillingAccount` row itself. No `ChargingSession` row is touched, updated, or reinterpreted — every session that referenced the account before archival still references it, by the same `billingAccountId`, exactly as before. There is no cascading status change, no "orphaning," nothing to migrate.

## 4. What happens to `TariffSnapshot`s?

**Nothing, more directly than for `ChargingSession`.** `TariffSnapshot` has no foreign key to `BillingAccount` at all — it references `ChargingSession` and `Organization` only. `BillingAccount` archival has zero structural reach into `TariffSnapshot` in either direction; every snapshot remains exactly as immutable, append-only, and queryable as it was before the archival (see `CAP-009_TARIFF_SNAPSHOT_MODEL.md`).

## 5. What happens if the related `Organization` is archived?

**Nothing that isn't already true of every other entity in this schema.** `CAP-008_BILLING_MODEL.md` Objective 3 already established, and this work order's own live query (§7) reconfirms, that `Organization` archival is a pure status transition with no cascading deletion — and `BillingAccount.organizationId`'s foreign key is `RESTRICT`, meaning an `Organization` cannot even be hard-deleted while any `BillingAccount` still references it. A `BillingAccount` (and everything beneath it — its `ChargingSession`s, their `TariffSnapshot`s) survives `Organization` archival exactly as intact as `Site`, `AuthorizationCredential`, or any other entity under that `Organization` already does.

## 6. What survives audits?

**The complete chain, indefinitely, by construction:** `BillingAccount` rows (current status always visible; no separate status-history table exists, but the row itself is never destroyed), `ChargingSession` rows (immutable core fields — `startedAt`, `energyWh`, etc.), and `TariffSnapshot` rows (fully immutable, append-only, database-trigger-enforced currency consistency — see `CAP-009_INVARIANTS.md`). Because every relevant foreign key is `RESTRICT` (§7), none of these three can be deleted while anything downstream still references it — the entire evidentiary chain from `Organization` down to the specific rate applied to a specific session remains reconstructible for as long as the database itself exists, which is the literal property `DEC-018`'s regulatory-audit finding requires.

## 7. What is the `ON DELETE` behavior for every relevant foreign key?

**Verified live against `movos_dev`** (`information_schema.referential_constraints`, queried directly, not inferred from `schema.prisma`):

| Foreign key                                                                                             | Delete rule                                                         |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `BillingAccount.organizationId` → `Organization.id`                                                     | `RESTRICT` (unchanged — already correct in the original foundation) |
| `ChargingSession.organizationId, billingAccountId` → `BillingAccount.organizationId, id`                | **`RESTRICT`** — changed from `SET NULL` by this work order         |
| `ChargingSession.organizationId` → `Organization.id`                                                    | `RESTRICT` (unchanged)                                              |
| `ChargingSession.siteId` / `chargingStationId` / `evseId` / `connectorId` / `authorizationCredentialId` | `RESTRICT` (unchanged, CAP-002/CAP-004)                             |
| `TariffSnapshot.chargingSessionId` → `ChargingSession.id`                                               | `RESTRICT` (unchanged — already correct in the original foundation) |
| `TariffSnapshot.organizationId` → `Organization.id`                                                     | `RESTRICT` (unchanged — already correct in the original foundation) |

**Was the original `SET NULL` behavior acceptable? No — evaluated and rejected.** `SET NULL` meant deleting a `BillingAccount` with active `ChargingSession` references would silently succeed, severing every referencing session's debtor attribution rather than refusing the operation — precisely the "historical financial identity must not disappear" failure mode this policy exists to prevent. `RESTRICT` closes this for any `BillingAccount` actually in use.

**Why `RESTRICT` is still not a complete, unconditional guarantee, stated honestly rather than overclaimed:** `RESTRICT` only blocks a delete when a dependent row exists. A `BillingAccount` with zero referencing sessions — freshly created, never assigned — can still be deleted today via raw Prisma/SQL access, exactly as before. No foreign-key design can close this specific residual case unconditionally; doing so requires a database-permission change (revoking `DELETE` on the table) outside this migration's scope. This mirrors, and now sharpens, the same honest finding `CAP-009_INVARIANTS.md` already made about this exact tradeoff — restated here as the authoritative archival-policy answer, not contradicted.

---

## Summary against the required policy direction

| Requirement                                          | Met?                                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Historical financial identity must not disappear     | **Yes** — `RESTRICT` on the `ChargingSession → BillingAccount` FK means a referenced account cannot be deleted at all, only archived                  |
| Archival must preserve referential integrity         | **Yes** — archival never touches any FK, any referencing row, or any relation; it is a single-column status flip                                      |
| `TariffSnapshot`s must remain immutable and readable | **Yes**, unaffected — `BillingAccount` archival has no structural path to `TariffSnapshot` at all                                                     |
| Historical sessions must remain attributable         | **Yes** — `RESTRICT` everywhere on the chain means nothing between a `ChargingSession` and its `Organization` can be deleted while the session exists |
