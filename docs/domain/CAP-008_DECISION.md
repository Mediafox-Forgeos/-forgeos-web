# CAP-008 — Billing Foundation: Decision

**Generated:** 2026-08-03 (WO-ARGOS-016, Objective 7)
**Status:** **ACCEPTED** (2026-08-03, WO-ARGOS-016A merge authorization) — see "ARGOS Approval Record" below. Originally: RECOMMENDATION — awaiting ARGOS decision. Nothing in this document is implemented. No `Tariff`, `TariffSnapshot`, `Invoice`, `Payment`, or `Discount` model is created; `OCPP`/`ChargingSession` are untouched.
**Evidence base:** [CAP-008_BILLING_MODEL.md](./CAP-008_BILLING_MODEL.md) (Objectives 1–4: entities, tariff-option mechanics, ownership, events), [CAP-008_BILLING_THREAT_MODEL.md](../reviews/CAP-008_BILLING_THREAT_MODEL.md) (Objective 5), [CAP-008_SCENARIOS.md](../reviews/CAP-008_SCENARIOS.md) (Objective 6). All three are preserved as-written — this document is where the recommendation is made, not a retroactive edit of the evaluation that preceded it.
**Directly extends:** [DEC-018 — Billing Ownership Boundary Analysis](./DEC-018_BILLING_BOUNDARY_ANALYSIS.md), which already recommended a `ChargingSession → TariffSnapshot → Invoice` shape and explicitly left open the one question this document answers: _when_ is a `TariffSnapshot` captured?

---

## Recommendation: Option C — Tariff Snapshot, implemented so it degenerates exactly to Option A's behavior whenever no pricing-relevant boundary occurs

Not "Option C for complex deployments, Option A for simple ones" — one mechanism, whose cost scales with whether a session actually needs it. A snapshot is captured at session start, exactly as Option A would. An additional snapshot is captured only when a pricing-relevant boundary is actually crossed — a tariff edit, a scheduled peak/off-peak transition, a day/night rollover for a tariff that differentiates by time of day. A session under a flat, never-changed tariff (`CAP-008_SCENARIOS.md` §1, Residential; commonly §2, Shopping mall) accumulates exactly one snapshot and behaves identically, in cost and in complexity, to a pure Option A implementation. A session that crosses a boundary (`CAP-008_SCENARIOS.md` §3 Fleet, §5 Utility, §6/§7) accumulates additional snapshots and is priced accurately across each segment. **Simplicity is not traded away for the deployments that don't need complexity — the mechanism only pays for what a given session actually uses.**

Option B (continuous recalculation, no persisted point-in-time record) is rejected outright, not merely ranked lowest — see below.

---

## Why not Option A alone

Option A (fixed at session start, no snapshot mechanism at all beyond the one implicit value) is not wrong for every deployment — `CAP-008_SCENARIOS.md` §1 and, largely, §2 validate it as entirely sufficient there. It is rejected as the _general_ answer because it cannot represent a real, common, and in some deployments (§3 Fleet, §5 Utility) _routine_ fact: a tariff that legitimately differs across a session's duration. Forcing every deployment onto Option A would either misprice fleet/utility sessions against their own posted rate schedules (`CAP-008_BILLING_MODEL.md` Objective 2), or push those deployments toward inventing their own workaround later — exactly the retrofit-under-pressure risk `DEC-018` was written to prevent in the first place. Choosing C-that-degenerates-to-A gets Option A's exact behavior for the deployments that only need it, without foreclosing the deployments that don't.

## Why not Option B

**Rejected, not merely ranked lowest**, on every one of the four justification criteria below, and independently on `CAP-008_BILLING_THREAT_MODEL.md` Threat #1's finding: "recalculated continuously" with no persisted, point-in-time record is structurally the same shape as the bare live-tariff-reference design `DEC-018` already rejected and this document's own threat model classifies **UNSAFE** — a computed total that depends on _when_ it happens to be computed, not on any fixed fact about the session, is not reproducible after the fact. Option B is not "the accurate option with tradeoffs" — the accuracy it promises is illusory without exactly the snapshot mechanism Option C already provides, at which point it is not a distinct option at all, only Option C described less precisely. Additionally, Option B (taken literally, as continuous recalculation against live meter data) has no defined behavior for a session with sparse or zero `MeterValue` telemetry — a real, common, and per DEC-016 explicitly _expected_ case this schema was deliberately built to tolerate. Option B is incompatible with a guarantee (`ChargingSession` correctness independent of telemetry availability) this codebase has already committed to elsewhere.

---

## Justification

### Auditability

**Decisive for C.** A discrete, immutable, timestamped snapshot exists for every rate that ever applied to a session — the same conclusion `DEC-018` already reached ("a direct, auditable answer to 'what rate applied to this exact session' — a single join, not a reconstruction argument"). Option A is auditable but can be auditably _wrong_ relative to an operator's own posted time-varying schedule, for any deployment where such a schedule exists. Option B offers no audit trail at all in its literal form — there is nothing to look up after the fact except whatever the live `Tariff` table currently says, which `CAP-008_BILLING_THREAT_MODEL.md` Threat #1 already classifies as the **UNSAFE** baseline this whole analysis is measured against.

### Legal defensibility

**Decisive for C**, most sharply in `CAP-008_SCENARIOS.md` §5 (Utility company). `DEC-018`'s regulatory-audit finding — several jurisdictions require the price basis for a charging transaction to be reproducible and immutably tied to that specific transaction — is a requirement Option A cannot satisfy for a genuinely time-varying tariff (it doesn't track the schedule at all) and Option B cannot satisfy for _any_ tariff (nothing is fixed in place to defend). Option C is the only one of the three that produces, as a direct structural consequence rather than a bolt-on, exactly the artifact a regulator or auditor would ask for.

### Operational simplicity

**The one criterion where C is not the outright winner, honestly stated.** Option A is simpler — one lookup, no boundary-detection logic, no dependency on `MeterValue` density. Option C requires detecting pricing-relevant boundaries (a tariff edit, a scheduled schedule transition) and, per `CAP-008_BILLING_THREAT_MODEL.md` Threat #1 and Threat #7, still requires a separately-decided energy-attribution rule for splitting a session's total energy across snapshot boundaries when telemetry is sparse — a real, unresolved implementation detail, not free. Against Option B, however, C is unambiguously simpler: C only needs to detect discrete boundary _events_; Option B (literally) requires a continuously-live pricing computation with no defined behavior for the sparse-telemetry case at all. C's added complexity over A is real but bounded and one-time (boundary-detection logic, built once); it is not a standing operational burden the way Option B's live-computation dependency would be.

### Customer trust

**Genuinely close between A and C, decided by degeneration.** Option A offers maximal predictability — "the price you saw when you plugged in is the price you pay" — a real trust advantage, especially for `CAP-008_SCENARIOS.md` §2's walk-up, no-prior-relationship customer. Option C, because it degenerates to exactly Option A's single-snapshot behavior whenever no boundary is crossed, preserves that same predictability for every session that doesn't need to differ. Where a boundary _is_ crossed, `DEC-018` already notes a `TariffSnapshot` can back a driver-facing cost estimate shown _during_ an active session — meaning C's added complexity, unlike Option B's, does not have to translate into unpredictability for the person paying; it is a design question for whichever future work order builds the customer-facing surface, not a structural cost this decision imposes. Option B is the weakest here: an unpredictable final total, not knowable until the session ends, is a known trust liability in variable-rate consumer billing generally, and this document finds no scenario among the seven validated where B's promised accuracy translates into a customer-trust advantage over C's bounded, snapshot-backed predictability.

---

## What this decision does not resolve

Consistent with `DEC-018`'s own discipline of naming what remains open rather than implying false completeness:

1. **The exact triggering rule for a mid-session snapshot** (which specific events count as "pricing-relevant" — every admin tariff edit regardless of magnitude? Only edits that change the _effective_ rate for the session's organization/site? Every scheduled schedule transition, even ones the session doesn't overlap?) is not specified here — a real design question for whoever implements this.
2. **The energy-attribution rule for splitting a session's total energy across snapshot boundaries when `MeterValue` telemetry is sparse or absent** (`CAP-008_BILLING_THREAT_MODEL.md` Threats #1 and #7) is explicitly not resolved — this document identifies it as a required, separate decision, not an implementation detail that will resolve itself.
3. **Which clock governs pricing** — device-reported time (CAP-004's existing precedent for session identity) or MOVOS's own receipt time — is not decided here (`CAP-008_BILLING_THREAT_MODEL.md` Threat #4). This document only establishes that CAP-004's existing precedent must not be assumed to transfer silently.
4. **Who the debtor is**, for any deployment where the payer is not the operating `Organization` itself (`CAP-008_BILLING_MODEL.md` Objective 1's headline finding — no `Driver`/customer entity exists). This decision is scoped to _tariff_ semantics; it does not create `Driver`, `Vehicle`, or any B2B counterparty concept, and does not need to in order to be correct as far as it goes — but no `Invoice` can be addressed to anyone until that gap is closed by a future, separate work order.
5. **`Invoice`/`Payment`/`Refund` design** — entirely out of scope, per the work order's own constraints, and not designed here even at the conceptual level `TariffSnapshot` receives.

## What survives from `DEC-018`, unmodified

The ownership shape (`Organization → Site → ChargingSession → TariffSnapshot → Invoice`), the multi-tenant `organizationId` denormalization precedent, and the roaming case (a session may be priced from a different organization's tariff than the one operating the station) are all reaffirmed exactly as `DEC-018` stated them. This document adds _when_ a snapshot is captured; it does not revisit _whether_ one should exist, or how it's owned.

---

## ARGOS Approval Record (2026-08-03, WO-ARGOS-016A)

Everything above is preserved unedited as the original recommendation and analysis. ARGOS reviewed and accepted this decision — Option C (tariff snapshot, degenerating to Option A's behavior when no boundary is crossed) is confirmed as MOVOS's tariff-timing model. PR #32 merged to `main` at `2cbd5ddabed54feafa63b229343d7090aa706aab`, tagged `CAP-008_ARCHITECTURE_COMPLETE`.

**Open item #4 ("who the debtor is") was resolved separately, same review cycle:** `CAP-008_DEBT_OWNERSHIP.md` (WO-ARGOS-016A) evaluated `Organization`/`Driver`/`Vehicle`/`Fleet`/`BillingAccount`/`AuthorizationCredential` against seven questions and named `BillingAccount` — a new concept, not previously named anywhere in this codebase — as the canonical debt owner. This does not modify anything decided above; it closes the one item this document explicitly left open rather than attempting to answer.

**What remains open, unchanged by this approval:** the snapshot-triggering rule, the energy-attribution rule for sparse telemetry, and which clock governs pricing (open items #1–#3 above) are not resolved by this approval and are not resolved by `CAP-008_DEBT_OWNERSHIP.md` either. `Invoice`/`Payment`/`Refund` design remains entirely out of scope.

**Consequence of this approval:** CAP-009 — BillingAccount & TariffSnapshot Foundation — is registered in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (entry #52) as the next capability, authorized to build the schema and services this decision and `CAP-008_DEBT_OWNERSHIP.md` describe. Invoices, payments, taxes, discounts, accounting, Stripe integration, and UI remain unauthorized by this approval — as does RFID, Smart Charging, and OCPP 2.0.1 functional work, all unrelated to and unblocked by this decision.
