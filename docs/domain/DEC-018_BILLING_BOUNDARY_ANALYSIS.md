# DEC-018 — Billing Ownership Boundary Analysis

**Generated:** 2026-08-01 (WO-ARGOS-009A)
**Status:** ANALYSIS AND RECOMMENDATION ONLY — no model created, no field added, no migration generated. Billing remains entirely out of scope for CAP-004, unchanged.
**Related:** [CAP-004 §16 — Future integration points](./CAP-004_CHARGING_SESSIONS_FOUNDATION.md#16-future-integration-points), Architecture Backlog #24 (Tariffs), #25 (Billing), #26 (Payments)

## The question

When Billing is eventually built, what sits between `ChargingSession` and `Invoice`?

- **Option A:** `ChargingSession → Invoice` (direct).
- **Option B:** `ChargingSession → TariffSnapshot → Invoice` (an immutable, point-in-time copy of the pricing terms interposed between the session and its invoice).

## Constraint this analysis must respect

CAP-004 already committed to keeping `ChargingSession` free of pricing fields: _"[Billing/Tariff] is designed to be a clean reference target for these later capabilities — it does not grow pricing/invoice/payment fields itself"_ ([CAP-004 §16](./CAP-004_CHARGING_SESSIONS_FOUNDATION.md#16-future-integration-points)). Both options below honor that; the question is only what shape the _later_ capability takes, not whether `ChargingSession` changes now (it doesn't, either way).

## Historical consistency

A `ChargingSession` can be invoiced hours, days, or (for disputed/re-audited charges) months after it completed. If the price applied is looked up from a live `Tariff` row at invoice-generation time (Option A's natural implementation — a bare `tariffId` FK with no captured values), **a tariff price change between the session and the invoice silently rewrites history.** Regenerating or auditing that invoice later would compute a different total than the original, because the FK still resolves, just to different numbers. Option A can be made safe, but only by embedding a full price snapshot directly into `Invoice` — which is functionally the same data Option B proposes, just without a name of its own and not reusable before an invoice exists (see "Reproducibility before billing" below).

Option B makes this structurally impossible to get wrong: `TariffSnapshot` is written once, at the moment it's captured, and never updated. The `Invoice` references the snapshot, not the live `Tariff`. Ten years later, the snapshot still says exactly what was charged and why.

## Tariff changes

`Tariff` (Architecture Backlog #24, `DISCOVERY`) is presumably a mutable, admin-editable record — organizations will change prices over time; that's the entire point of the entity existing. Option A's direct link either (a) tolerates the historical-consistency problem above, or (b) requires every consumer of session pricing (invoice generation, a driver-facing "what will this cost" estimate, a dispute-resolution export) to independently re-implement snapshot-capture logic, each slightly differently. Option B centralizes that capture in one place, written once per session.

## Regulatory audits

Several jurisdictions relevant to EV charging (EU metering/calibration law being the most stringent example) require that the price basis for a charging transaction be reproducible and immutably tied to that specific transaction, independent of what happens to the operator's live pricing configuration afterward. `TariffSnapshot` is a direct, auditable answer to "what rate applied to this exact session" — a single join, not a reconstruction argument. Option A can only offer the same guarantee by pushing the same snapshot semantics into `Invoice`, which then has to justify its own existence as _implicitly_ a tariff snapshot with extra fields — a less honest shape than naming the concept directly.

## Multi-tenant billing

Both options can be made tenant-safe with an `organizationId` column, consistent with the `ChargingSession` denormalization precedent (DEC-013). Option B has a real edge for one specific multi-tenant scenario this codebase already anticipates: **roaming** (Architecture Backlog #28, OCPI). A roaming session may be priced using a _different_ organization's tariff than the one operating the station. Option A's direct `tariffId` FK implicitly assumes the tariff and the session share one tenant boundary — that assumption breaks under roaming. `TariffSnapshot` captures "this is the rate that applied, from wherever it came from" as a fact about the session, independent of which organization's live `Tariff` table it was read from — the natural place to record cross-tenant pricing provenance.

## Future dynamic pricing

A single static `tariffId` per session (Option A) cannot represent a rate that changes _during_ a session — e.g. a charge spanning a peak/off-peak boundary, or a future spot-market-linked rate. Representing that requires either a many-to-many join or a dedicated snapshot-like entity keyed by time range within the session — which is exactly what `TariffSnapshot` already is, generalized. Option A has no extension path to this without inventing, after the fact, the entity Option B proposes now — with a harder migration, since `Invoice` rows would already exist and encode the single-tariff assumption.

## What Option B costs

To be even-handed: Option B is not free. It is one more entity, one more write (when it happens — see open question below), and one more hop in the query path from session to invoice. For an operator with one flat, rarely-changed tariff and no roaming or dynamic pricing on any near-term roadmap, Option A is simpler and would work correctly _as long as nothing about pricing ever changes retroactively_ — a real-world assumption that tends to break exactly when it matters most (a billing dispute, an audit).

## Recommendation

**Option B: `ChargingSession → TariffSnapshot → Invoice`.**

Justified specifically by the four criteria above (historical consistency, tariff mutability, regulatory audit posture, and roaming/dynamic-pricing extensibility) — not a default preference for more layers. `TariffSnapshot` also has a use independent of `Invoice`: a driver-facing cost estimate shown _during_ an active session (before any invoice exists) can reference the same snapshot, which Option A's invoice-embedded pricing cannot support without inventing a second copy of the same data.

## Open question this analysis does not resolve

_When_ is a `TariffSnapshot` captured — at `StartTransaction` (session creation), continuously as pricing conditions change during the session, or only at billing time from the session's recorded `startedAt`/`endedAt`/`energyWh`? This determines whether `TariffSnapshot` is 1:1 or 1:N per `ChargingSession`, and is a real design question for whoever picks up Tariffs/Billing (Architecture Backlog #24/#25) — explicitly not decided here, since neither Tariff nor Billing exists yet to make the question concrete.

## What this document does not do

No `TariffSnapshot`, `Invoice`, or `Tariff` model is created. No field is added to `ChargingSession`. This is a recommendation for whoever eventually implements Architecture Backlog #24/#25/#26, not an implementation.
