# CAP-008 — Canonical Debt Ownership

**Generated:** 2026-08-03 (WO-ARGOS-016A)
**Status:** **ACCEPTED** (2026-08-03, WO-ARGOS-016A merge authorization) — `BillingAccount` is confirmed as the canonical debt owner in MOVOS; PR #32 merged to `main` at `2cbd5ddabed54feafa63b229343d7090aa706aab`, tagged `CAP-008_ARCHITECTURE_COMPLETE`. DOCUMENTATION ONLY, unaffected by acceptance: no model is created — `BillingAccount` does not exist in the schema and this document does not design its fields, migration, or relations. No `Invoice`, `Payment`, or any other billing model is created. Nothing is implemented. Building it is CAP-009 (registered in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md), not started).
**Directly resolves:** `docs/domain/CAP-008_BILLING_MODEL.md` Objective 1's headline finding ("the entity that generates revenue and the entity that should owe the resulting debt are structurally different, and MOVOS has no schema representation of a paying customer at all") and `docs/domain/CAP-008_DECISION.md`'s open item #4 ("Who the debtor is... not created here"). This document closes that gap by naming the canonical debt-owning concept — it does not build it.
**Grounding discipline:** every claim about existing entities is verified against the shipped Prisma schema and service code on `main`, consistent with the rest of the CAP-008 document set.

---

## Mission

Six candidates, one canonical answer: **`Organization`, `Driver`, `Vehicle`, `Fleet`, `BillingAccount`, `AuthorizationCredential`.** Of these, only `Organization` and `AuthorizationCredential` exist as Prisma models today; `Driver`/`Vehicle`/`Fleet` are named-but-unimplemented architectural concepts (CAP-004 §4); `BillingAccount` is not named anywhere before this document — it is evaluated here as a candidate on equal footing with the other five, not assumed.

**Answer, stated up front:** none of the five entities already named in this codebase's prior architecture is the canonical debt owner. **`BillingAccount` is** — a dedicated, purpose-built concept, decoupled from the _operational_ facts of a session (which vehicle, which driver, which credential authorized it) that the other five candidates each conflate with the _financial_ fact of who is responsible for paying. The reasoning is in the seven questions below.

---

## Entity-by-entity evaluation

**`Organization`** — exists in schema. Per `CAP-008_BILLING_MODEL.md` Objective 1, this is the **seller**, not the buyer, in the ordinary case — it owns the `Site`/`ChargingStation`/`ChargingSession` chain and the eventual invoice's system-of-record, but it is not who the invoice is addressed _to_. It is a legitimate debtor only in the narrow B2B/roaming case (a visiting network's organization owing the site-operator's organization, `DEC-018`'s named future case) — a real but secondary shape, not the general answer, and even there, using an `Organization` row to represent thousands of individual end-customers would violate this codebase's own tenant-isolation model (DEC-022): an `Organization` is a tenant, not a customer record.

**`Driver`** — no Prisma model exists. The natural candidate for "who used the service" in the ordinary B2C case, but conflates _use_ with _financial responsibility_ — a company-car employee uses the service; their employer is who is contractually liable. A `Driver`-as-debt-owner design cannot cleanly represent that relationship, or a family sharing one vehicle, or a person who is simultaneously a private individual _and_ an authorized user on their employer's account.

**`Vehicle`** — no Prisma model exists. Disqualified on principle, not just practicality: a vehicle has no legal personhood, cannot enter a contract, cannot hold a payment method. It is, at most, a cost-_allocation_ key (`CAP-008_BILLING_MODEL.md` Objective 1 already reached this conclusion) — never a payer.

**`Fleet`** — no Prisma model exists. The strongest competitor to `BillingAccount` for the fleet scenario specifically, but a fleet is, in the real world, almost always an operational _grouping_ (a division, a department, a set of vehicles under common management) rather than itself the legal/financial party — the company that operates the fleet is who actually holds the bank account and the legal liability. `Fleet` does not generalize past the fleet scenario at all (residential, condominium, mall, and utility deployments have no natural "fleet" concept), disqualifying it as a _canonical_, cross-scenario answer even where it fits well.

**`BillingAccount`** — does not exist. Proposed here as a dedicated concept representing the legal/contractual party responsible for payment, decoupled from every operational fact. It can represent an individual person, a company, an HOA, or a roaming counterparty organization uniformly — the same shape covering every case the other five candidates each only partially cover.

**`AuthorizationCredential`** — exists in schema. Already established in `CAP-008_BILLING_MODEL.md` Objective 1 as identifying _how_ a session was authorized, owned today by the operating `Organization`, not a customer. The least stable identity of the six (see Question 6) and the clearest case of conflating an authentication method with a financial party.

---

## The seven questions

### 1. Which entity legally owes the money?

**`BillingAccount`.** This is not a finding so much as a restatement of what such an entity is _for_ — a dedicated legal/contractual party, existing specifically to answer this question, is definitionally the correct answer to it. Every other candidate either cannot hold a legal obligation at all (`Vehicle`, `AuthorizationCredential`), only sometimes represents the actual liable party (`Driver` — fails for the company-car case; `Fleet` — usually a grouping under the real liable party, not the party itself), or is the wrong side of the transaction entirely in the ordinary case (`Organization`, which is the seller).

### 2. Which entity receives the invoice?

**`BillingAccount`**, for the identical reason — receiving an invoice and owing the resulting debt are two sides of one relationship; the addressee of a bill is, by definition, whoever is being asked to pay it. `Organization` receives an invoice only in the B2B/roaming case where it is itself acting as a `BillingAccount`'s real-world referent (see Question 7's roaming note, below).

### 3. Which entity survives organization archival?

All six, in the trivial sense already established in `CAP-008_BILLING_MODEL.md` Objective 3: no `onDelete` cascade exists anywhere in this schema, so nothing is destroyed by archival regardless of which entity is evaluated. The real question is whether the entity's _identity remains meaningful_ afterward, not whether its row persists.

**`BillingAccount` should be scoped to exactly one `Organization`** — the same tenant-ownership pattern `AuthorizationCredential.organizationId` already establishes, and a direct consequence of DEC-022's hard multi-tenant isolation stance (every business record belongs to exactly one tenant; nothing spans tenants implicitly). A driver who charges at two unrelated operators would hold two separate `BillingAccount` rows, one per operator, never one global account spanning both. Under this scoping, a `BillingAccount`'s row and its full historical debt record survive its operator's archival exactly as intact as a `ChargingSession` or future `Invoice` would — the relationship simply stops being operationally active, which is correct behavior (the operator stopped operating), not a data-loss event. This is stated as a scoping _principle_ for whoever eventually builds `BillingAccount`, not a schema design — no field, FK, or migration is specified here.

### 4. Which entity survives vehicle resale?

This question is the one most clearly designed to eliminate a specific wrong answer. **`Vehicle`-as-debt-owner fails outright**: selling a car would mean either the new owner inherits the previous owner's unrelated debt relationship, or the "debt owner" concept dissolves the moment the asset changes hands — neither is coherent. `BillingAccount` is unaffected by construction: it was never tied to the vehicle's identity in the first place, only associated with it through the operational fact of a specific session (which vehicle was plugged in), a fact that can freely change without disturbing who is financially responsible for past or future use. `Driver` and `Fleet` are also unaffected by a resale specifically (neither is vehicle-keyed), but that is incidental to their own, separate weaknesses (Questions 1, 5) — surviving resale does not rescue either as the canonical answer.

### 5. Which entity survives driver turnover?

**`Driver`-as-debt-owner fails for exactly the case that matters most for this question: a fleet with employee turnover.** Tying financial responsibility to the specific individual who happened to be driving would require re-establishing the billing relationship every time an employee joins or leaves — operationally absurd for a fleet, and unnecessary, since the company (not the rotating employee) is who is actually liable. `BillingAccount` survives by construction, identically to Question 4's reasoning: a `Driver` (once that concept exists) would be, at most, one of several people _authorized to use_ a `BillingAccount`, never the account itself. For a purely individual/residential context with no turnover concept at all, `Driver` and `BillingAccount` degenerate to the same 1:1 relationship — the distinction only matters, and only needs to matter, where turnover is real.

### 6. Which entity survives credential replacement?

**`AuthorizationCredential`-as-debt-owner fails hardest of all six**, and is the clearest case this set of questions is designed to surface: physical credentials (RFID cards, app tokens) are the most volatile identity of the six by a wide margin — lost, reissued, expired, and replaced routinely, entirely independent of any change in who is financially responsible. Tying debt ownership to a specific credential row would mean every card replacement severs and requires re-establishing the entire billing relationship. `BillingAccount` survives trivially: a credential is, and should remain, only a _method of authenticating a session_, referencing (once such a relationship exists) the `BillingAccount` it authorizes use against — never the reverse, and never the same row.

### 7. Which entity best supports each deployment shape (`CAP-008_SCENARIOS.md`)?

| Deployment shape | `BillingAccount` fit                                                                                                                                                                                | Why the alternatives fall short                                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Residential      | Degenerates to one account, one person — trivially supported                                                                                                                                        | `Driver` would work identically here (no turnover, no fleet complexity) — the distinction costs nothing in the simple case                                                                                                     |
| Condominiums     | One account per unit-owner, _or_ one account for the HOA that internally recharges residents — `BillingAccount` accommodates either pattern without forcing a choice                                | `Organization` cannot represent N individual unit-owners without violating tenant isolation; `Driver` forces the per-unit-owner pattern even where the HOA-recharges pattern is what's actually wanted                         |
| Fleets           | One account per company (or a small number, for sub-fleets), with many vehicles and many rotating drivers rolling up to it — exactly what consolidated fleet billing requires                       | `Fleet` is the closest competitor but is itself better modeled as a grouping _within_ a `BillingAccount` (for the operator's own internal reporting) than as the billing party; `Driver`/`Vehicle` both fail per Questions 4/5 |
| Shopping malls   | Supports a lightweight or ephemeral account created at the moment of payment for an anonymous walk-up customer, without forcing every one-off visitor into a durable, fully-fledged customer record | `Driver` would force exactly that unwanted durability; `Organization` cannot scale to one row per walk-up customer at all                                                                                                      |
| Utilities        | Directly matches the industry-standard "billing account" / "ratepayer account" concept utilities already use — arguably the deployment shape this concept is most obviously named after             | None of the other five candidates map onto a utility ratepayer relationship at all — `Driver` implies a person plugging in a car, not a metered property account                                                               |

**The roaming/B2B case** (`DEC-018`'s named future scenario, `CAP-008_BILLING_MODEL.md` Objective 1's "Organization: ambiguous payee/payer" finding) is resolved the same way: a visiting network's organization is represented, for billing purposes, by a `BillingAccount` scoped within the site-operator's tenant, whose real-world referent happens to be a company rather than an individual. This is not a special case requiring a seventh candidate — it is the same mechanism, pointed at a different kind of real-world party, which is precisely the flexibility a dedicated `BillingAccount` concept is meant to provide.

---

## Canonical choice

**`BillingAccount`.**

Justified across every one of the seven questions, and not by elimination alone: a dedicated, purpose-built party is definitionally the correct answer to "who legally owes money" and "who receives the invoice" (Questions 1–2); it is the only one of the six candidates that survives every named source of operational churn — organization archival, vehicle resale, driver turnover, credential replacement (Questions 3–6) — because it was never coupled to any of those facts in the first place, only associated with them through the operational record of a session; and it is the only candidate that cleanly generalizes across all five deployment shapes and the roaming case without forcing any of them into an ill-fitting pattern (Question 7).

**What canonical means here, precisely:** `BillingAccount` is the entity every future `Invoice` addresses and every future debt attaches to. It does not replace `Driver`, `Vehicle`, `Fleet`, or `AuthorizationCredential` as _operational_ concepts — a session is still authorized by a credential, still (once such fields exist) associated with a vehicle and a driver for allocation and reporting purposes. Those remain real, useful facts about _how_ a session happened. `BillingAccount` is the one fact about _who owes for it_, held stable across all of them.

---

## What this document does not resolve

Consistent with the rest of the CAP-008 series' discipline of naming what remains open rather than implying false completeness, and with this work order's explicit "do not implement anything" instruction:

1. **No schema is designed.** `BillingAccount`'s fields, its relationship to `AuthorizationCredential`/`Organization`, whether it needs its own status/lifecycle, and how a session's `AuthorizationCredential` eventually resolves to a `BillingAccount` (an `ownerRef`-style link, per CAP-004's already-named-but-never-built pattern, now redirected toward this entity) are all future implementation questions.
2. **The `Fleet` grouping concept is not designed.** This document concludes `Fleet` is better modeled as a grouping _within_ a `BillingAccount`'s scope than as the debt owner itself, but does not specify how.
3. **How an ephemeral, one-off `BillingAccount` (the shopping-mall walk-up case) differs structurally from a durable one** is named as a requirement (Question 7) but not designed — whether these are the same model with different lifecycles, or a deliberately lighter-weight variant, is open.
4. **Everything `CAP-008_DECISION.md` already left open remains open**: the tariff-boundary triggering rule, the energy-attribution rule for sparse telemetry, and which clock governs pricing are unaffected by this document and unresolved by it.

This document closes exactly one gap: naming `BillingAccount`, not `Organization`, `Driver`, `Vehicle`, `Fleet`, or `AuthorizationCredential`, as the canonical debt owner. Building it is a future work order's task.
