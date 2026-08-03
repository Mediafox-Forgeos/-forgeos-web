# CAP-008 — Billing Threat Model

**Generated:** 2026-08-03 (WO-ARGOS-016, Objective 5)
**Status:** Evaluation only. No option is recommended here — see the eventual `CAP-008_DECISION.md`. No code is written or changed by this document.
**Companion to:** [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) (the domain model this threat model is evaluated against), [CAP-008_SCENARIOS.md](./CAP-008_SCENARIOS.md)
**Baseline assumption, stated once:** this analysis assumes the underlying OCPP transport, authentication, and multi-tenant isolation layers (CAP-003/CAP-004/CAP-005, DEC-022) are functioning as documented and already reviewed. It does not re-litigate connection security, credential theft, or cross-tenant access — those have their own threat models. This document is scoped to _financial correctness and integrity_ risks specific to billing.

Classification key (reused from `DEC-022_THREAT_MODEL.md` for methodological consistency): **SAFE** (no material exposure) · **RISK** (a real exposure exists, bounded/detectable/tolerable) · **UNSAFE** (a real exposure exists with no bound, no detection path, or no acceptable tolerance).

---

## 1. Tariff changes mid-session

**Scenario:** an operator edits a tariff's rate while a `ChargingSession` is actively drawing energy.

**Why it matters:** if a future implementation resolves pricing via a live reference (a bare `tariffId` foreign key read at invoice-generation time — `DEC-018`'s already-rejected Option A), the price applied to a session depends on _when the invoice happens to be generated_ relative to the edit, not on any fact about the session itself. Two invoices generated for the identical session, at different times, could compute different totals from the same underlying data — not a rounding difference, a genuinely different answer to "what did this cost."

| Design                                                           | Classification                         | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bare live-tariff reference (no snapshot)                         | **UNSAFE**                             | No bound on how much the computed total can drift from what actually applied at the time of use; no detection path distinguishes a "correct" recomputation from a silently-wrong one — the FK still resolves, just to different numbers, exactly as `DEC-018` already found.                                                                                                                                                                                                                                                                                                                                                                              |
| `CAP-008_BILLING_MODEL.md` Objective 2 Option A (fixed at start) | **SAFE**, for this threat specifically | The rate is captured once, immutably, before any mid-session edit can affect it. Trivially immune — at the cost of accuracy against the operator's intended schedule, a separate, non-safety concern.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Objective 2 Option B (continuous) or Option C (snapshot)         | **RISK**                               | Both correctly capture the rate that applied at each moment, closing the "silently rewrites history" problem — but both depend on being able to attribute energy to specific time windows, which requires `MeterValue` data that CAP-004/DEC-016 guarantee is optional and may not exist. The pricing-integrity risk (wrong historical price) is closed; a new, bounded, detectable risk (imprecise energy attribution within a session) replaces it. Detectable because the gap between "total session energy" (always known) and "sum of attributed segments" (only known when telemetry exists) is directly computable and can be flagged, not silent. |

---

## 2. Duplicate invoices

**Scenario:** the same `ChargingSession` is billed twice — a retry after a timeout, a race between two invoice-generation triggers, or a re-run of a billing job.

**Existing precedent in this codebase:** `ChargingSession` itself already solves the structurally identical problem for session creation — `@@unique([chargingStationId, protocolTransactionId])` makes a duplicate `StartTransaction` fail at the database level, not just at the application level, and CAP-004 §13 confirms this is enforced by the constraint _plus_ an application-level pre-check, not either alone.

**Classification: RISK.** Real and material if a future `Invoice` model is built without an equivalent natural-key uniqueness constraint (e.g., `@@unique([organizationId, chargingSessionId])`, assuming a one-invoice-per-session model — see the open question in `DEC-018` about incremental/partial invoicing, which this document does not resolve). Not **UNSAFE**, because the fix is not a research problem — it is a direct, low-cost replication of a pattern this codebase already uses correctly one table over. The risk is entirely in _whether_ that pattern gets applied, not in whether a solution is known.

---

## 3. Negative balances

**Scenario:** a refund exceeding the original charge, a calculation bug, or a meter-reading anomaly (`meterStop < meterStart`) produces a negative amount owed, a negative running balance, or a negative line-item total.

**Existing precedent in this codebase:** `ChargingSession.energyWh` is already guarded against the structurally identical problem by **two independent layers** — CAP-004 §14's failure-scenarios table confirms a service-layer check rejects a negative computed value before any write (transitioning the session to `FAILED` instead), _and_ an independent database `CHECK` constraint (`energyWh >= 0`) enforces the same invariant even if the service-layer check were ever bypassed or buggy.

**Classification: RISK.** Same reasoning as duplicate invoices — this is a solved problem in this codebase's own established style (defense in depth: application check + database constraint), just not yet applied to a monetary field. Not **UNSAFE**, for the identical reason: the pattern to close this risk is already proven and directly adjacent, not hypothetical.

---

## 4. Clock drift

**Scenario:** a charging station's onboard clock disagrees with true wall-clock time — potentially by minutes, hours, or (a station offline long enough to matter, or with a dead real-time-clock battery) far more.

**Existing behavior, and why it cuts the wrong way for billing specifically:** CAP-004 §15 and `DEC-017` establish, for good reasons at the session-identity layer, that device-reported timestamps are authoritative for `startedAt`/`endedAt` — "the record describes what happened physically, not what MOVOS observed." This principle is correct for session sequencing and offline reconciliation. It is **directly dangerous if inherited silently for pricing**, because time-of-use tariffs (day/night, peak/off-peak — the exact mechanisms named in Objective 2 and validated per-scenario in `CAP-008_SCENARIOS.md`) are looked up _by time_. A station whose clock is wrong by even a few minutes, sitting near a rate-schedule boundary, would have its session priced according to a clock nobody has verified against reality.

**Classification: RISK**, and the least-mitigated of the seven examined here — nothing in the current system validates a device-reported timestamp against MOVOS's own receipt time, flags a large discrepancy, or offers any alternative clock source for pricing purposes specifically. Not **UNSAFE**, because the exposure is bounded (a session can only be mispriced by however far the device's clock has actually drifted, and typical drift for a networked device with periodic connectivity is small) and because the underlying `ChargingSession` record itself is never corrupted — only its _price_, if pricing naively reuses `startedAt`/`endedAt` without a documented decision about which clock governs money. This document takes no position on which clock should govern pricing; it flags that CAP-004's existing precedent must not be assumed to transfer, and that whoever builds Tariff/`TariffSnapshot` needs to decide this explicitly rather than inherit it by default.

---

## 5. Replayed `StopTransaction`

**Scenario:** a station retransmits `StopTransaction` for a session that has already been terminated — ordinary OCPP network-jitter behavior, not an attack.

**Existing mitigation, verified:** CAP-004 §13/§14 state directly that a `StopTransaction` for an already-`COMPLETED` session is a no-op — "returns the existing terminal state, does not re-run termination logic or error." This is enforced by two independent facts already true in shipped code: the lifecycle engine refuses to terminate a session whose `endedAt` is already non-null (CAP-004 §12 — "a session cannot finish twice"), and the `(chargingStationId, protocolTransactionId)` unique constraint identifies the session unambiguously regardless of how many times the message arrives.

**Classification: SAFE, at the session-lifecycle layer** — already implemented, already the documented, tested behavior, not something this WO needs to design.

**The billing-relevant corollary this document must flag separately:** this session-layer safety does **not** automatically extend to a future billing trigger. If invoice generation is wired to fire directly off the raw `StopTransaction` _message_ rather than off the `ChargingSession`'s own terminal-state _transition_ (which the no-op behavior correctly suppresses on replay), a retransmitted `StopTransaction` could still cause a second invoice-generation attempt to fire, even though the session itself was correctly protected — because "the message arrived twice" and "the session transitioned to COMPLETED twice" are different facts, and only the second is actually false. This is the concrete mechanism by which Threat #2 (duplicate invoices) would most likely occur in practice, and is why `INVOICE_CREATED` (`CAP-008_BILLING_MODEL.md` Objective 4) must be triggered by the session's state transition, never by the protocol message directly.

---

## 6. Failed payment

**Scenario:** an `Invoice` is generated and a payment attempt against it fails (declined, processor timeout, insufficient funds).

**Current state:** entirely conceptual. No `Payment`, `Invoice`, or payment-processor integration exists anywhere in this codebase — verified by the absence of any payment-related dependency in `apps/movos-api/package.json` and no payment module under `src/`.

**Classification: RISK**, and explicitly **not further evaluable from existing precedent** — unlike Threats #2 and #3, there is no structurally-identical problem already solved elsewhere in this codebase to point to. OCPP's own message-retry/idempotency handling (Threat #5) is a _protocol_ retry pattern; a failed payment needs a _financial reconciliation_ state machine on the `Invoice`/`Payment` side (e.g., `PENDING → FAILED → RETRYING`/`WRITTEN_OFF`) with no precedent anywhere in the current schema. This is explicitly out of scope for this work order (no Stripe, no payments, per the WO's constraints) — named here only so this document does not silently imply the problem is smaller than it is.

---

## 7. Station offline

**Scenario:** a station loses connectivity mid-session, for any duration — including long enough to span a tariff boundary or midnight.

**Existing behavior, verified (CAP-005/`DEC-017`):** a disconnect alone never completes or fails a session — only an explicit `StopTransaction` or administrative action does. `ConnectivityCoordinator.RECOVERY_WINDOW_MS` (900,000ms / 15 minutes, 3× the configured heartbeat interval) governs whether a _reconnect_ is treated as a resume of the same session; it does **not** force-terminate a session that exceeds it — per `DEC-017`'s Approval Record point 4, insufficient evidence keeps the session `OFFLINE` rather than guessing. A session can therefore remain `OFFLINE` for an unbounded period, with real energy potentially having been delivered (if the station kept charging on its own Local Authorization List logic) that MOVOS has zero visibility into until the device eventually reports back.

**Why this is the most complex of the seven for billing specifically:** during an `OFFLINE` gap, by definition, no `MeterValue` telemetry can arrive (there is no connection to carry it). Any tariff mechanism that prices by time-of-delivery (Objective 2's Option B, or Option C when a rate boundary falls inside the gap) has **no data at all** to attribute energy against for that period — the only number that will ever exist for it is whatever the eventual `StopTransaction`'s aggregate `meterStop` delta implies, with no sub-gap resolution possible even in principle, not just in practice.

**Classification: RISK**, deliberately not UNSAFE, and the reasoning matters: nothing about this scenario corrupts or loses data — `ChargingSession.energyWh` remains correct and fully resolvable regardless of any offline gap, exactly as DEC-016 already guarantees independent of billing. The exposure is bounded to a _pricing-accuracy_ question (which rate applied to energy delivered during a period with no timestamped evidence), not a data-integrity or availability question, and it is fully detectable — a session with an `OFFLINE` interval overlapping a tariff-relevant boundary is a directly identifiable condition, not a silent failure. This is the strongest concrete argument this threat model surfaces for why Objective 7's decision cannot treat Option B/C as strictly superior to Option A without also specifying an explicit, documented estimation or fallback rule for exactly this case — stated here as a finding for that decision to weigh, not as a recommendation.

---

## Summary

| #   | Threat                     | Classification                                                                             | Bound / detection path                                                                                                                                                    |
| --- | -------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tariff changes mid-session | RISK (UNSAFE if a bare live-tariff reference is used)                                      | Closed by a snapshot mechanism (Option A trivially, B/C with residual attribution risk)                                                                                   |
| 2   | Duplicate invoices         | RISK                                                                                       | Directly solvable via the same unique-constraint pattern already proven on `ChargingSession`                                                                              |
| 3   | Negative balances          | RISK                                                                                       | Directly solvable via the same two-layer (service + DB `CHECK`) pattern already proven on `energyWh`                                                                      |
| 4   | Clock drift                | RISK                                                                                       | Bounded by realistic drift magnitude; currently zero validation of device time for pricing purposes — least-mitigated of the seven                                        |
| 5   | Replayed `StopTransaction` | SAFE at the session layer; billing must not regress this by triggering off the raw message | Already implemented, already tested (CAP-004)                                                                                                                             |
| 6   | Failed payment             | RISK, not further evaluable                                                                | No existing precedent in this codebase to reuse; genuinely out of scope for this WO                                                                                       |
| 7   | Station offline            | RISK                                                                                       | Bounded to a pricing-accuracy question, not data loss; detectable via `OFFLINE`-interval overlap with tariff boundaries; no sub-gap resolution possible even in principle |

**No threat evaluated here is classified UNSAFE as this work order's own model (`CAP-008_BILLING_MODEL.md`) would build it.** The one UNSAFE finding (Threat #1's bare-live-reference variant) is explicitly the design DEC-018 already rejected and this document's own Objective 2 does not propose — it is included as the negative baseline the rest of the analysis is measured against, not as a live risk in the model this WO describes.
