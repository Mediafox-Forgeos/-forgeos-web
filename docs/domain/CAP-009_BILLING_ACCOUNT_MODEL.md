# CAP-009 — BillingAccount Model

**Generated:** 2026-08-03 (WO-ARGOS-017, Objective 1)
**Status:** IMPLEMENTED (schema + interface only). `BillingAccount` exists as a real Prisma model, migrated onto `movos_dev` (`prisma/migrations/20260803213813_add_billing_account_and_tariff_snapshot`). `BillingAccountService` exists as a TypeScript interface only — no implementing class, no NestJS wiring, no billing/invoice/balance logic. See the "Not implemented" section at the end of this document for the exhaustive list of what this capability does not do.
**Materializes:** [CAP-008_DEBT_OWNERSHIP.md](./CAP-008_DEBT_OWNERSHIP.md) — `BillingAccount` is the canonical debt owner that document named, chosen over `Organization`/`Driver`/`Vehicle`/`Fleet`/`AuthorizationCredential`.
**Grounding discipline:** every field, constraint, and relation described below is quoted directly from the actual `apps/movos-api/prisma/schema.prisma` and `apps/movos-api/src/billing/billing-account.service.interface.ts` on this branch — not aspirational.

---

## The entity

```prisma
enum BillingAccountType {
  INDIVIDUAL
  COMPANY
  FLEET
  HOA_CONDOMINIUM
  ROAMING_PARTNER
}

enum BillingAccountStatus {
  ACTIVE
  ARCHIVED
}

model BillingAccount {
  id             String               @id @default(cuid())
  organizationId String
  type           BillingAccountType
  displayName    String
  status         BillingAccountStatus @default(ACTIVE)
  currency       String
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  organization     Organization      @relation(fields: [organizationId], references: [id])
  chargingSessions ChargingSession[]

  @@index([organizationId, status])
}
```

Every field in the work order's "minimum fields" list is present, in the same order, with no additions.

## Supported account types

`BillingAccountType` covers exactly the five named in the work order — no sixth value was invented, and none of the five was collapsed into another to save an enum value:

- **`INDIVIDUAL`** — a private person, the ordinary residential case (`CAP-008_SCENARIOS.md` §1).
- **`COMPANY`** — a business entity, covering both the "operator bills a corporate customer directly" case and the debtor side of `DEC-018`'s roaming case (a visiting network represented as a `BillingAccount` whose real-world referent is a company — `CAP-008_DEBT_OWNERSHIP.md` Question 7's roaming note).
- **`FLEET`** — a fleet-operating company (`CAP-008_SCENARIOS.md` §3). Named as its own type rather than folded into `COMPANY` because fleet billing has a distinct operational shape (many vehicles, many rotating drivers, one consolidated account) worth being able to filter/report on directly, even though `CAP-008_DEBT_OWNERSHIP.md` concluded `Fleet` itself is not a separate _entity_ — it is this type value on a `BillingAccount`, not a table of its own.
- **`HOA_CONDOMINIUM`** — the condominium/HOA case (`CAP-008_SCENARIOS.md` §4). One enum value for "HOA / Condominium" exactly as the work order named it as a single supported type, not two.
- **`ROAMING_PARTNER`** — the B2B/roaming counterparty case (`DEC-018`, `CAP-008_BILLING_MODEL.md` Objective 1's "Organization: ambiguous payee/payer" finding). Distinct from `COMPANY` so a roaming settlement account can be identified and reported on separately from an ordinary corporate customer, even though both are, structurally, a company on the other end of the relationship.

No `BillingAccountType` maps to the shopping-mall walk-up case (`CAP-008_SCENARIOS.md` §2) as its own value — an anonymous, one-off customer most naturally maps to `INDIVIDUAL` when a `BillingAccount` is created for them at all, or to no `BillingAccount` (a `null` `ChargingSession.billingAccountId`) when one never is. This is not a gap this document leaves silently open: it is the direct, expected consequence of `CAP-008_BILLING_MODEL.md`'s own headline finding that several real deployment shapes may never have a persisted debtor, restated at the type-enum level rather than re-litigated here.

## Minimum fields — what's deliberately absent

Per the work order, **not added**: addresses, payment methods, tax information, invoices. Each is a real, deliberate omission, not an oversight:

- **Addresses** — would belong to a billing/legal-address concern that has no bearing on which organization a `BillingAccount` is scoped to or what it owes; nothing in CAP-008's model requires it to exist yet.
- **Payment methods** — Stripe/PSP integration is explicitly out of scope for this work order and for Architecture Backlog #26 (Payments), which remains `UNDEFINED`.
- **Tax information** — Architecture Backlog has no registered Tax capability at all yet; inventing a field for it here would be designing ahead of a capability that doesn't exist.
- **Invoices** — `Invoice` is `DEC-018`'s and `CAP-008_BILLING_MODEL.md`'s own downstream entity, explicitly one hop further down the ownership chain (`BillingAccount → ChargingSession → TariffSnapshot → Invoice`) and explicitly out of scope for this work order.

Adding any of the four now would be designing beyond what CAP-008 actually decided, for capabilities that remain unregistered or explicitly deferred.

## Uniqueness constraints — evaluated, none added

The work order asks this to be evaluated, not assumed. The finding: **no natural key exists at this deliberately minimal field set**, and no `@@unique` constraint was added as a result.

Walking the fields that could plausibly anchor one: `displayName` is free text, chosen by whoever creates the account — two `INDIVIDUAL` accounts named "John Smith" within the same organization are a real, unremarkable possibility, not a data-integrity violation. `type` + `organizationId` together identify a _category_ of accounts, not an individual one — an organization legitimately has many `COMPANY` accounts. `currency` is not an identifying field at all. None of the fields this document was told to add (`id`, `organizationId`, `type`, `displayName`, `status`, `currency`, `createdAt`, `updatedAt`) carries an external, real-world identifier a database constraint could anchor to — because the fields explicitly excluded above (an email, a tax ID, a payment-method fingerprint) are exactly the kind of field that would normally serve that role.

**Consequence, stated plainly:** two structurally identical `BillingAccount` rows — same organization, same type, same display name — can exist side by side today, and nothing in the schema prevents it. This is a known, accepted limitation of this minimal foundation, not a defect this document is hiding. It is deferred to whichever future capability adds a real identifying field (an email for `INDIVIDUAL`, a tax ID or registration number for `COMPANY`/`FLEET`/`HOA_CONDOMINIUM`, a settlement identifier for `ROAMING_PARTNER`) — at which point a `@@unique([organizationId, <that field>])` constraint becomes possible and should be added. Inventing a synthetic uniqueness rule now (e.g. `@@unique([organizationId, displayName])`) was considered and rejected: it would silently forbid a legitimate real-world case (two genuinely different people or companies who happen to share a chosen display name) to manufacture a uniqueness guarantee that doesn't correspond to any actual business rule.

## Archival semantics

`BillingAccountStatus` has exactly two values: `ACTIVE`, `ARCHIVED`. Not the three-value `ACTIVE`/`INACTIVE`/`ARCHIVED` pattern `OrgStatus`/`SiteStatus` use elsewhere in this schema — deliberately: the work order's own invariant list (Objective 5, `CAP-009_INVARIANTS.md`) only ever discusses "archived, never deleted," and no third business state was named anywhere in CAP-008 or this work order to justify inventing one. If a future capability needs an intermediate `SUSPENDED`-style state (e.g., a `BillingAccount` temporarily on hold pending a dispute), it can be added then, against a real, named requirement — not spun up now against a state nobody asked for.

Archival is a **status transition**, exactly matching the precedent `sites.service.ts`'s real, shipped `archive()` method already establishes for `Site`, and consistent with `CAP-008_BILLING_MODEL.md` Objective 3's verified finding that no `onDelete` cascade exists anywhere in this schema for any other entity. Concretely, a `BillingAccount` transitioning to `ARCHIVED`:

- Does not delete the row, and cannot — there is no `delete` method on `BillingAccountService` (see the interface, quoted below), by design.
- Does not delete or orphan any `ChargingSession` that already references it via `billingAccountId` — that FK is `ON DELETE SET NULL` (Prisma's own default for a nullable relation; see `CAP-009_INVARIANTS.md` for why this is the **one** exception found so far to `CAP-008_BILLING_MODEL.md`'s "no cascade anywhere in this schema" finding, and why it is a safe one).
- Is fully reversible at the data level (nothing prevents a future `unarchive`-style transition from being added later; this foundation does not build one because nothing in CAP-008 or this work order asked for it).

## Ownership invariants

- **Every `BillingAccount` belongs to exactly one `Organization`.** `organizationId` is a required (non-nullable) field with a `RESTRICT`-on-delete foreign key (Prisma's default for a required relation) — an `Organization` cannot be deleted while any `BillingAccount` still references it, consistent with `CAP-008_BILLING_MODEL.md` Objective 3's finding that organization hard-deletion isn't possible today at all, for any entity.
- **A `BillingAccount` never spans organizations.** There is no field, relation, or code path by which one `BillingAccount` row could serve two different `Organization` tenants — the same hard tenant-isolation boundary DEC-022 established for human session context applies here to the debt-owner concept, exactly as `CAP-008_DEBT_OWNERSHIP.md` Question 3 concluded it should.
- **A `BillingAccount` can be referenced by zero, one, or many `ChargingSession` rows** (`chargingSessions ChargingSession[]`) — a single account (a fleet company, an HOA) is expected to accumulate many sessions over time; nothing in this foundation caps that.

## The service contract

```ts
export interface CreateBillingAccountInput {
  organizationId: string;
  type: BillingAccountType;
  displayName: string;
  currency: string;
}

export interface BillingAccountService {
  create(input: CreateBillingAccountInput): Promise<BillingAccount>;
  findById(id: string): Promise<BillingAccount | null>;
  findByOrganization(organizationId: string): Promise<BillingAccount[]>;
  archive(id: string): Promise<BillingAccount>;
}
```

Four methods, matching exactly what the schema and the invariants above require and nothing more: create, two read paths (by id, by organization), and archive. No `update` (nothing about a `BillingAccount` is expected to change except its `status`, and `archive` is the only status transition this foundation defines), no `delete`, no balance/invoice/payment method of any kind.

## Not implemented

Consistent with the work order's explicit constraints and with `CAP-008_DECISION.md`/`CAP-008_DEBT_OWNERSHIP.md`'s own "what this does not resolve" sections: no implementing class for `BillingAccountService` exists (no `@Injectable()`, no NestJS module, no controller, no HTTP endpoint); no `Invoice`, `Payment`, `Stripe`, tax, or discount logic of any kind; no UI; no wiring into `app.module.ts`. This document and its accompanying schema/interface are the foundation a future work order builds an actual service and API surface against.
