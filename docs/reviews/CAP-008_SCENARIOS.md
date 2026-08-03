# CAP-008 — Billing Future Scenarios

**Generated:** 2026-08-03 (WO-ARGOS-016, Objective 6)
**Status:** Validation only. No option is chosen or recommended here — see the eventual `CAP-008_DECISION.md`. No code is written or changed by this document.
**Companion to:** [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) (the domain model each scenario is validated against), [CAP-008_BILLING_THREAT_MODEL.md](./CAP-008_BILLING_THREAT_MODEL.md)

Seven scenarios: five deployment shapes, evaluated against `CAP-008_BILLING_MODEL.md`'s findings (which entity owes money, which owns the invoice, what tariff semantics matter), and two session-timing edge cases, evaluated against Objective 2's three tariff options structurally rather than by recommending one.

---

## 1. Residential charger

**Shape:** a single EV owner charging at their own home connector — one `Organization` (the household, or a landlord managing a small building), typically one `Site`, one or a handful of `ChargingStation`/`Connector` rows, and one (or a small, stable, known set of) `AuthorizationCredential`.

**Where this sits against Objective 1's headline finding:** this is the scenario where the "who owes the money" gap matters **least**. There is usually no third party at all — the account owner is billing themselves, or not billing anyone, only tracking cost for their own records (e.g., against a home-office tax deduction or a landlord's tenant-recharge arrangement). Where a landlord does need to recharge a tenant, the tenant is still a small, known, stable party the operator already has an out-of-band relationship with (a lease) — the absence of a `Driver` model is a real gap but a low-severity one here, unlike Scenario 2.

**Tariff characteristics:** almost always a single flat rate, rarely if ever changed, no roaming. Session count is low-volume, session duration is typically overnight (routinely spans midnight) but against a flat tariff, so **Scenario 6's midnight-spanning question is structurally a non-event here** — see §6 below for why that's conditional on tariff shape, not session duration.

**Expected behavior:** the simplest possible instance of the model. Whichever tariff option Objective 7 selects, a residential deployment exercises none of its hard cases (no mid-session tariff edits in practice, no roaming, no meaningful clock-drift consequence since there's no time-of-use schedule to be wrong about). This scenario validates that the chosen model does not impose unnecessary complexity on the simplest real deployment — it does not stress-test the model's edge handling.

---

## 2. Shopping mall

**Shape:** public/semi-public charging for anonymous walk-up shoppers. One `Organization` (the mall operator or its charging concessionaire), one `Site`, multiple `ChargingStation`s, high session volume, short-to-medium session duration (shoppers rarely stay past closing).

**Where this sits against Objective 1's headline finding:** this is the scenario where the gap bites **hardest and soonest**. The billed party is frequently a genuinely one-off, anonymous individual with no prior relationship to the operator — paid via a kiosk, app, or QR code at the moment of use, with no expectation of ever becoming a durable, named entity in MOVOS. Objective 1 already found MOVOS has no schema representation of a paying customer at all; a shopping-mall deployment is the shape that needs an answer to that question _first_, before almost anything else in this domain model, because there is no fallback "bill them later, out of band" option the way a residential landlord or a fleet operator's existing invoicing relationship could tolerate.

**Tariff characteristics:** typically a simple, predictable rate (flat, or a coarse fast/slow-charging tier tied to `Connector.maxPowerKw` — an example of `Connector`'s role as tariff-selection _context_, per Objective 1, not a billing party itself) — the mall wants revenue predictability, not complex time-of-use pricing. Peak pricing tied to the mall's own busy hours (weekend afternoons) is plausible; midnight-spanning sessions are rare, since the mall itself closes.

**Expected behavior:** this scenario validates the model's handling of Threat #6's neighbor question (an unmodeled, possibly-anonymous payer) more than any tariff-timing complexity. Whichever tariff option is chosen, it must be usable in a context where the _payer_ may never be resolved to a persisted MOVOS record at all — the pricing calculation (Objective 2) and the party who owes it (Objective 1/3) are genuinely separable concerns here, more visibly than in any other scenario.

---

## 3. Fleet operator

**Shape:** a fleet manager operating multiple vehicles, charged at a depot (which may be the fleet's own `Organization`, or a _different_ `Organization` — a third-party depot the fleet roams onto, DEC-018's named future case). `AuthorizationCredential` rows plausibly correspond 1:1 with individual vehicles or drivers (RFID cards issued per vehicle) — exactly the shape CAP-004 anticipated when it named `AuthorizationCredential.ownerRef` as the eventual `Driver`/`Vehicle`/`Fleet` join point (a field that, per `CAP-008_BILLING_MODEL.md` Objective 1, does not actually exist in the shipped schema today, only in older architecture documents' conceptual description).

**Where this sits against Objective 1's headline finding:** this is the scenario that most _needs_ `Vehicle`/`Driver` to be real, not just conceptual — a fleet manager's core requirement is per-vehicle cost allocation ("what did van #12 cost this month"), which is unanswerable from today's schema beyond the coarse level of "which `AuthorizationCredential` was used," itself only resolvable to the operating organization, not an individual vehicle, unless the fleet operator informally encodes vehicle identity into `AuthorizationCredential.metadata` (an untyped `Json?` field, not a structured relationship).

**Tariff characteristics:** this is where midnight-spanning and tariff-change timing matter **most**, not as an edge case but as the routine, deliberately-sought case — fleet depot charging is very commonly scheduled overnight specifically _to exploit off-peak rates_. A tariff model that gets this wrong doesn't just misstate an edge case; it misstates the fleet's core cost-optimization strategy, and — since the depot itself is paying a real utility bill with its own time-of-use structure — a MOVOS total that doesn't track the actual rate schedule stops being useful to the depot operator, not just imprecise.

**Expected behavior:** this scenario most strongly exercises Objective 2's Option B/C accuracy questions (both for genuine mid-session tariff edits and for the very common scheduled day/night boundary) and Objective 1's Vehicle/Driver gap simultaneously. It is also the clearest concrete instance of Objective 1's "Organization: ambiguous payee/payer" finding — a roaming fleet charging at a third-party depot is a real B2B billing relationship this schema does not yet model at all.

---

## 4. Condominium

**Shape:** shared charging infrastructure serving multiple unit owners/residents in one building — one `Organization` (the condo association/HOA), one `Site`, a small number of `ChargingStation`s, and a _known, stable, identifiable_ set of users (unlike Scenario 2's anonymous shoppers) who nonetheless have no persisted MOVOS entity to represent them, for the same reason as every other scenario here: no `Driver`/customer model exists.

**Where this sits against Objective 1's headline finding:** structurally the same gap as the shopping mall (no persisted payer), but with a materially different character — the condo's residents are known, repeat, identifiable people the association already has an out-of-band relationship with (a unit/lease), so the _absence_ of a `Driver` entity is more tolerable operationally (billing can piggyback on the existing HOA-fee/unit-billing relationship) even though the schema gap itself is identical to Scenario 2's.

**Tariff characteristics:** frequently a pass-through of the building's own actual utility cost, which itself may carry demand charges or time-of-use components the condo association wants accurately reflected per-unit, rather than a marked-up flat rate the way a commercial operator might set. This is a real argument, in this scenario specifically, for Option B/C's accuracy over Option A's simplicity — stated here as a scenario-level observation for Objective 7 to weigh, not a recommendation this document makes.

**Expected behavior:** validates that the model supports cost allocation to a small, closed, known set of parties without requiring a full customer-relationship-management capability — a lighter-weight version of Scenario 3's Fleet needs, and a variant of Scenario 2's payer gap where the operational workaround (bill through the existing HOA relationship) is more readily available.

---

## 5. Utility company

**Shape:** MOVOS used by, or supplying data to, an actual electric utility or grid operator — where the tariff **is** the utility's own live, regulatory-filed rate schedule (time-of-use, demand response, seasonal pricing), not an operator-chosen markup.

**Where this sits against every other objective:** this is the scenario with the highest stakes for nearly every finding in this document set. `DEC-018`'s "regulatory audits" section — several jurisdictions require the price basis for a charging transaction to be reproducible and immutably tied to that specific transaction, independent of later changes to live pricing configuration — is written with exactly this scenario in mind. Threat #4 (clock drift) matters most here: a utility's time-of-use schedule is precisely why the pricing clock must be trustworthy, and a naive inheritance of CAP-004's "trust the device's reported time" principle (correct for session identity, unverified for money) is least tolerable in this scenario of all seven. Objective 1's "Organization: ambiguous payee/payer" finding also surfaces most sharply here — a utility company may be billing individual accounts, other organizations, or operating in a wholesale/settlement capacity this schema has no representation for at all.

**Tariff characteristics:** genuinely dynamic, multi-tier, seasonal, and demand-responsive — the scenario most likely to exercise every mid-session boundary case Objective 2 describes, routinely rather than exceptionally.

**Expected behavior:** this scenario is the strongest validation case for whichever option Objective 7 ultimately selects needing an immutable, point-in-time, audit-reproducible pricing record (`TariffSnapshot`, in DEC-018's naming) — not because this document recommends one, but because this is the deployment shape where getting it wrong has consequences beyond a customer-service dispute (a regulatory audit finding, per `DEC-018`).

---

## 6. Session spanning midnight

Restated as a validated scenario, structurally, against all three of Objective 2's options — the finding is the same regardless of which deployment shape (1–5 above) produces it:

**The session layer is entirely unaffected.** `ChargingSession.startedAt`/`endedAt` are plain `DateTime` values; nothing in the session lifecycle (CAP-004 §8/§12) treats a calendar-day boundary specially. Midnight-spanning is purely a **pricing** question, never a session-lifecycle question.

**Whether midnight matters at all is entirely a function of the organization's tariff structure, not session duration:**

- If the tariff is flat (no day/night differentiation — plausible for Scenario 1's residential case, common for Scenario 2's mall), a session spanning midnight is a **complete non-event** under any of Options A, B, or C. There is no rate to change, so there is nothing to attribute across a boundary that doesn't exist for pricing purposes.
- If the tariff differentiates by time of day (plausible-to-likely for Scenarios 3–5), then: under **Option A**, the entire session bills at whatever rate applied at `startedAt` — midnight has no effect on the calculation, only on its accuracy against the operator's intended schedule (already covered in Objective 2). Under **Option B/C**, midnight is treated identically to any other scheduled rate-schedule boundary (no different from a peak-window entry/exit) — a snapshot or recalculation point is introduced at 00:00, and the same energy-attribution question already flagged in the threat model (Threat #1) applies.

**Expected behavior:** midnight is not a special case requiring its own mechanism — it validates as a specific instance of the general "scheduled tariff boundary" case Objective 2/Threat #1 already cover, not a distinct problem.

---

## 7. Session spanning a tariff change

Restated as a validated scenario, corresponding directly to Threat #1:

**Ad hoc admin edit vs. scheduled boundary — same mechanism, different trigger.** Whether a mid-session rate change comes from an operator manually editing a tariff (an unscheduled, arbitrary-timing event) or from a scheduled day/night or peak/off-peak transition (§6 above), the structural handling is identical under every option: **Option A** ignores it entirely (the start-time rate governs the whole session, by construction — see Objective 2). **Option B/C** must record the boundary and attribute energy on each side of it, subject to the same `MeterValue`-availability constraint already named as a residual risk in the threat model (Threat #1) and sharpened further by Threat #7 (a tariff change occurring _during_ an `OFFLINE` gap has literally no telemetry to attribute against, regardless of which option governs the rest of the session).

**Expected behavior:** this scenario is the direct validation case for Threat #1's finding — it does not surface any new risk beyond what the threat model already classified, only confirms that the risk is real and reachable through an ordinary, expected operational action (an admin changing a price), not merely a hypothetical.

---

## Cross-scenario summary

| Scenario                  | Primary gap exercised                                                                      | Tariff-timing sensitivity                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1. Residential            | None materially — validates the model imposes no unnecessary complexity on the simple case | Low — flat tariff typical                                                     |
| 2. Shopping mall          | Objective 1's payer gap, most acutely (anonymous customer)                                 | Low-medium — simple/tiered tariff typical                                     |
| 3. Fleet operator         | Objective 1's `Vehicle`/`Driver` gap; B2B/roaming ambiguity                                | **High** — overnight off-peak charging is the routine case, not the edge case |
| 4. Condominium            | Objective 1's payer gap, with a known/closed party set (lighter-weight than Scenario 2)    | Medium — utility-cost pass-through favors accuracy                            |
| 5. Utility company        | Every finding, most acutely — regulatory audit stakes, clock-trust question                | **Highest** — dynamic, multi-tier, seasonal by design                         |
| 6. Midnight-spanning      | N/A — validates as a specific case of scheduled tariff boundaries                          | Conditional entirely on tariff shape, not session duration                    |
| 7. Tariff-change-spanning | Threat #1 directly                                                                         | Direct validation of the threat model's central finding                       |
