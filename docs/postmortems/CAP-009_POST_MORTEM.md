# CAP-009 Post-Mortem — BillingAccount & TariffSnapshot Foundation

**Generated:** 2026-08-04
**Work orders:** WO-ARGOS-017 (schema + interface foundation), WO-ARGOS-017A (invariant & archival hardening, requested by ARGOS after reviewing PR #34)
**PR:** [#34](https://github.com/Mediafox-Forgeos/-forgeos-web/pull/34), merged as `7bd032ea5c7168d1a6e3e816f40fab398ba7d90f`
**Tag:** `CAP-009_FOUNDATION_COMPLETE`
**Related:** [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md), [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md), [CAP-009_BILLING_ACCOUNT_MODEL.md](../domain/CAP-009_BILLING_ACCOUNT_MODEL.md), [CAP-009_TARIFF_SNAPSHOT_MODEL.md](../domain/CAP-009_TARIFF_SNAPSHOT_MODEL.md), [CAP-009_INVARIANTS.md](../domain/CAP-009_INVARIANTS.md), [CAP-009_ARCHIVAL_POLICY.md](../domain/CAP-009_ARCHIVAL_POLICY.md)

## What this capability answers

CAP-008 named the shape of billing — `BillingAccount` as the canonical debt owner, `TariffSnapshot` as the tariff-timing mechanism — entirely in documentation, with zero schema. CAP-009 is where that shape became real: a Prisma schema, database-enforced invariants, and interface-only domain-service contracts, with **no** `Invoice`, `Payment`, `Stripe`, tax, discount, accounting, or UI code — exactly the boundary both work orders drew. This is the first capability in this codebase's history where the domain model was fully architected and reviewed (CAP-008) _before_ a single line of schema was written, and the first where a follow-up hardening pass (WO-ARGOS-017A) closed real, ARGOS-identified gaps in the same review cycle rather than deferring them.

## What shipped

- **`BillingAccount`** — five original account types (`INDIVIDUAL`, `COMPANY`, `FLEET`, `HOA_CONDOMINIUM`, `ROAMING_PARTNER`) plus `SYSTEM_DEFAULT` (added during hardening, one per organization, the placeholder every pre-existing and debtor-less session now resolves to). Minimum fields only, per the work order — no address, payment method, tax information, or invoice field.
- **`TariffSnapshot`** — freezes energy price/kWh, price/minute, fixed fee, currency, and timezone against an effective timestamp. `Decimal`, never `Float`, for every money field — a new precedent in this schema. No `updatedAt`, no update/delete service method — immutable and append-only by construction.
- **`ChargingSession.billingAccountId`** — added nullable in the original foundation, hardened to `String` (required) after ARGOS's review, with a composite tenant-isolation foreign key.
- **`BillingAccountService`/`TariffSnapshotService`** — TypeScript interfaces only, no implementing class, no NestJS wiring, no billing/invoice/balance logic anywhere in either file.
- **`SessionLifecycleService.createSession()`** — updated, out of necessity, to resolve/create an organization's `SYSTEM_DEFAULT` account. The one piece of this work that touches code outside the `billing/` module — a direct, unavoidable consequence of making `billingAccountId` required, not scope creep.
- **A database trigger** — the first in this schema — enforcing cross-`TariffSnapshot` currency consistency for one `ChargingSession`.
- **5 migrations** total (1 original schema, 4 from the hardening pass: enum addition, backfill+required+composite-FK, currency trigger, partial unique index).
- **6 documents**: `CAP-009_BILLING_ACCOUNT_MODEL.md`, `CAP-009_TARIFF_SNAPSHOT_MODEL.md`, `CAP-009_INVARIANTS.md` (all three written for WO-017, then substantially revised for WO-017A) and `CAP-009_ARCHIVAL_POLICY.md` (new).
- **9 e2e tests** (real Postgres) plus 2 new unit tests, covering every invariant this work order touched.
- 8 feature commits across both work orders, merged via a standard merge commit.

## What ARGOS's review found

PR #34's first review cycle (WO-ARGOS-017's own deliverable) found the schema internally consistent but mismatched against the invariants CAP-008 had already approved, in three specific places:

1. **`ChargingSession.billingAccountId` was nullable**, contradicting the approved "every `ChargingSession` has exactly one `BillingAccount`" invariant. `CAP-009_INVARIANTS.md`'s own original text had already surfaced this honestly (it did not hide the gap), but honesty about a gap and closing it are different things, and ARGOS directed the latter.
2. **Cross-`TariffSnapshot` currency consistency had no enforcement at any level** — the original document correctly named this as the least-enforced of the five invariants, again surfaced rather than hidden, but still open.
3. **`BillingAccount` archival used `SET NULL`**, Prisma's unexamined default for the nullable relation — meaning a `BillingAccount` with active sessions could be silently deleted, severing debtor attribution rather than refusing.

This is a materially different review outcome than CAP-004's WO-ARGOS-009A (a validation gate that found zero defects) or CAP-008's WO-ARGOS-016A (a documentation gap closed by writing one more document). Here, ARGOS's review found real, structural gaps in already-applied schema and directed genuine hardening — a new migration sequence, a new database trigger, a changed foreign-key policy — not just better prose. The original documents' own honesty about their gaps (each one explicitly flagged, never glossed over) is what made this review cycle productive rather than adversarial: every finding ARGOS named was already named in the documents themselves, just not yet closed.

## What's explicitly deferred (by design, not oversight)

Every item below was named as out of scope by both work orders and reaffirmed by this one:

- `Invoice`, `Payment`, `Refund`, `Tax`, `Discount` models and any Stripe/accounting integration — untouched, no code of any kind.
- Any UI.
- `BillingAccount`/`TariffSnapshot` concrete service implementations — the interfaces exist; nothing implements them. `SessionLifecycleService`'s narrow, necessary use of `BillingAccount` (resolve-or-create the `SYSTEM_DEFAULT` account) is the one exception, and it deliberately does not implement `BillingAccountService`'s interface — it calls Prisma directly, the same way every other part of this codebase that predates a formal service interface does.
- The snapshot-triggering rule, the energy-attribution rule for sparse `MeterValue` telemetry, and which clock governs pricing — all remain exactly as open as `CAP-008_DECISION.md` left them. This work order closed _structural_ invariant gaps (ownership, tenant isolation, currency consistency, deletion policy), not the _pricing-calculation_ questions CAP-008 already deferred to a later capability.
- RFID, Smart Charging, OCPP 2.0.1 — untouched, unrelated to billing, explicitly named out of scope by both work orders to prevent drift into adjacent registered backlog entries.

## What we'd do differently

- **The original WO-ARGOS-017 mandate's Objective 1 said "evaluate exactly two options [A/B for nullability]" but the work order's own Deliverables list didn't force a decision between them into the schema itself** — it was possible (and, in the first pass, is what happened) to write a thorough, honest evaluation that still left the schema in a state one of the two options didn't actually match. The lesson carried forward from CAP-008A applies again here: when an architecture document names a specific database-level invariant, the schema should be checked against that exact invariant before merge, not just checked for internal consistency. This is worth being explicit about in any future "design + implement" work order that mixes documentation and schema deliverables in one pass.
- **Splitting the hardening into four separate migrations (enum, backfill+required+FK, trigger, partial index) rather than one large one paid off directly during implementation** — the enum-value restriction (Postgres won't let a new enum value be used in the same transaction that adds it) would have been a much harder bug to diagnose inside one monolithic migration than it was to simply avoid by splitting up front. Worth continuing as a default discipline for any future migration that both adds an enum value and immediately uses it.
- **Discovering, mid-hardening, that making `billingAccountId` required broke `SessionLifecycleService.createSession()`'s compile** was not anticipated by either work order's text, but was the correct, unavoidable consequence of the schema change — not a sign the schema change was wrong. Worth naming as a general pattern: a "make a nullable column required" work order should always budget for "find and fix every existing writer of that table," not just the migration itself.

## Metrics

|                                               |                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Commits merged (both work orders)             | 8 feature commits + 1 merge commit                                                                                                                           |
| Migrations                                    | 5 (1 original + 4 hardening)                                                                                                                                 |
| New Prisma models                             | 2 (`BillingAccount`, `TariffSnapshot`)                                                                                                                       |
| New enums                                     | 2 (`BillingAccountType`, `BillingAccountStatus`)                                                                                                             |
| Existing models modified                      | 1 (`ChargingSession` — new required FK)                                                                                                                      |
| Existing services modified                    | 1 (`SessionLifecycleService` — necessary consequence, not scope creep)                                                                                       |
| Database triggers                             | 1 (the first in this schema)                                                                                                                                 |
| New interface-only TypeScript files           | 2                                                                                                                                                            |
| New/updated documents                         | 6 (3 written then substantially revised, 1 net-new)                                                                                                          |
| e2e tests (real Postgres)                     | 9                                                                                                                                                            |
| New unit tests                                | 2                                                                                                                                                            |
| Invariants database-enforced at merge         | 5 of 8 named (up from 2 of 5 named at WO-017's own first pass)                                                                                               |
| Defects found by ARGOS's review               | 0 — every finding was a documented, honestly-surfaced gap, not a hidden one                                                                                  |
| Real gaps found and closed by ARGOS's review  | 3 (billingAccountId nullability, currency consistency, archival `SET NULL`)                                                                                  |
| Residual, honestly-stated gap after hardening | 1 (a never-referenced `BillingAccount` remains deletable via raw Prisma access — requires a database-permission change, not a schema change, to close fully) |

## Next

CAP-010 — Invoice & Ledger Architecture — registered in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) as the next capability, per ARGOS's explicit registration. Documentation-only scope, matching CAP-008's own precedent: no `Invoice`, `Payment`, `Stripe`, tax, or accounting implementation authorized. RFID, Smart Charging, and OCPP 2.0.1 remain unrelated, unstarted, and explicitly out of scope.
