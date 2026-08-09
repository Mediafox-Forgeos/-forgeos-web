# Capability Inventory

**Work order:** WO-ARGOS-028 (ForgeOS Core Extraction)
**Status:** ARCHITECTURE DISCOVERY. No code, API, migration, or `schema.prisma` change. Nothing below is a proposal to move a single file — it is a classification of what has already been built, grounded in the real implementation as it exists on `main` today.
**Mission:** classify every major capability MOVOS has shipped as **ForgeOS Core** (belongs to the universal platform, any vertical could use it), **MOVOS Extension** (specific to mobility/EV-charging, would not generalize), or **Hybrid** (a universal mechanism wearing a mobility-specific skin — most of what follows lands here, because MOVOS has so far always built the general case in service of one concrete need).

## How to read "Hybrid"

Hybrid is not a hedge. In almost every capability below, the _mechanism_ — a state machine, a reconciliation loop, a snapshot-and-freeze pattern — was built without needing anything mobility-specific to work, but the _entities it operates over_ (`ChargingStation`, `RecommendationType`) are concrete MOVOS types, not yet abstracted. Extracting a Hybrid capability to Core means separating those two things — keeping the mechanism, generalizing the entity it points at — not building something new. [VERTICAL_BOUNDARIES.md](./VERTICAL_BOUNDARIES.md) draws that specific line for each one.

## The eight capabilities

### 1. Sessions — **Hybrid**

- **What's built:** `ChargingSession`, `AuthorizationCredential`, `AuthorizationAttempt`, `MeterValue` (CAP-004, `docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md`). An authorization-gated, lifecycle-managed record of a metered activity: a credential is presented and logged whether accepted or not (`AuthorizationAttempt`, stored unconditionally — "a rejected attempt is itself operationally meaningful," per the schema's own comment), a session starts, accrues periodic telemetry (`MeterValue`, append-only, never a correctness dependency per DEC-016), and terminates into one of ten named states with a termination reason.
- **Universal part:** the _pattern_ — credential-gated access, an append-only attempt log independent of outcome, a session with immutable start and a lifecycle engine that refuses double-termination, optional periodic telemetry that's never load-bearing for the session's own correctness. This shape fits a parking session, a coworking desk booking, a shared-equipment rental, or a solar-storage dispatch window as easily as it fits a charging session.
- **Mobility-specific part:** `ChargingSession`'s actual fields — `meterStart`/`meterStop`/`energyWh`, `protocolTransactionId`, `protocolVersion` — are OCPP/charging vocabulary through and through. `AuthorizationCredential`'s type enum (`RFID`, `QR`, `PLUG_AND_CHARGE`) is charging-specific too, though the _concept_ of a typed, revocable, expirable credential is not.
- **Classification rationale:** the underlying `Session`/`Credential`/`Attempt` triad is a strong Core candidate, but it has never been built independent of charging — there is no evidence yet (no second vertical) that the abstraction holds. Hybrid, not Core, until proven.

### 2. Connectivity — **Hybrid, leaning Core**

- **What's built:** `ConnectionRegistryService` (in-memory, per-process live WebSocket connection state) plus `ConnectivityCoordinatorService` (reconciles that live state into `ChargingStation.connectivityStatus`, `lastConnectedAt`/`lastDisconnectedAt`/`lastSeenAt`, including the startup-restart rule that forces `ONLINE → UNKNOWN` rather than trusting a value that predates a process restart — CAP-005, `docs/domain/CAP-005_CONNECTIVITY_ENGINE.md`).
- **Universal part:** "track whether a networked device is currently reachable, keep a coarse last-known-good timestamp that survives a process restart, and never let a stale in-memory belief silently outlive the process that held it" is a generic IoT/device-fleet primitive — it has nothing to do with charging specifically. It would work unchanged for a fleet of point-of-sale terminals, warehouse sensors, or any other WebSocket-connected device.
- **Mobility-specific part:** the persisted fields live directly on `ChargingStation`, not on a generic `Device` entity — the mechanism is general, the anchor point is not.
- **Classification rationale:** leaning Core because the reconciliation logic itself references nothing charging-specific — `ConnectivityCoordinatorService` would compile against any entity with an id and a connectivity-status field. The only reason it isn't Core today is that it was never asked to be.

### 3. Billing Foundation — **Hybrid**

- **What's built:** `BillingAccount` (the canonical debt owner, deliberately decoupled from which credential or vehicle was used — CAP-008/009, `docs/domain/CAP-008_DEBT_OWNERSHIP.md`) and `TariffSnapshot` (price components frozen at session-start and at each pricing-relevant boundary, never recomputed live — `docs/domain/CAP-009_TARIFF_SNAPSHOT_MODEL.md`).
- **Universal part:** "who owes for this" as a first-class concept separate from "who used it," and "price is captured as an immutable snapshot at the moment it applied, not derived after the fact" are both general-purpose billing/accounting patterns — they would hold for metered utility billing, coworking-space billing, or equipment-rental billing without modification to the _pattern_.
- **Mobility-specific part:** `TariffSnapshot`'s actual price fields — `energyPricePerKwh`, `pricePerMinute` — are charging vocabulary. A different vertical would need different price components (per-seat-hour, per-kg, per-transaction), even though the freeze-at-a-point-in-time discipline around them would not change.
- **Classification rationale:** Hybrid — the debt-ownership and price-snapshot _disciplines_ generalize cleanly; the concrete tariff shape does not, and hasn't been asked to.

### 4. Observability — **Hybrid, leaning Core**

- **What's built:** `StationHealthService` (CAP-X Sprint 1, WO-ARGOS-022) — a pure, read-only rollup that computes a 4-state health verdict (`healthy`/`degraded`/`offline`/`unknown`) from a device topology (station → EVSEs → connectors) with an explicit precedence rule: connectivity evidence (`OFFLINE`/`UNKNOWN`) always overrides fault evidence, and only once connectivity is affirmatively known does the service look at whether any connector/EVSE is `FAULTED`. Never persisted — recomputed on every read, same discipline as the Recommendation Engine below.
- **Universal part:** "roll a hierarchical asset tree's component-level states up into one verdict, with a defined precedence order between different _kinds_ of evidence (liveness vs. fault), computed fresh rather than stored" is a pattern that applies to any hierarchical fleet of monitored equipment — a building's floor/room/sensor tree, a vehicle's system/subsystem/component tree.
- **Mobility-specific part:** the topology itself (`ChargingStation`/`Evse`/`Connector`) and the specific precedence rule's vocabulary (`connectivityStatus === 'OFFLINE'`, `connector.status === 'FAULTED'`) are hardcoded to this schema's real enums, not parameterized over an abstract device tree.
- **Classification rationale:** leaning Core for the same reason as Connectivity — `computeHealth()`'s actual logic (precedence-then-rollup) has no charging-specific reasoning in it, only charging-specific field names.

### 5. Recommendation Engine — **Hybrid, leaning Core**

- **What's built:** `RecommendationService` (WO-ARGOS-025) — five independent detectors, each stateless, each recomputed fresh on every call, each returning at most its own single worst current instance, each carrying `title`/`severity`/`explanation`/`evidence`/`recommendedAction` (see `docs/implementation/OPERATIONAL_INTELLIGENCE_TECHNICAL_NOTES.md`).
- **Universal part:** the _contract_ — "a detector is a pure function from an organization's current data to at most one explained, evidenced insight, recomputed rather than stored" — is a shape any vertical's anomaly/insight detection could implement. The "5 methods, 5 possible cards, by construction" discipline (no display-layer truncation of a longer list) is a defensible engine-level rule independent of what the 5 methods actually check.
- **Mobility-specific part:** all five concrete detectors (`getEnergyAnomaly`, `getAuthFailureSpike`, `getIdleConnector`, `getComparativeUnderperformance`, `getEfficiencyDrift`) read `ChargingSession`/`AuthorizationAttempt`/`MeterValue`/`Connector` directly — every threshold and every query is charging-specific.
- **Classification rationale:** Core candidate for the _contract/interface_ a detector must satisfy (stateless, explained, evidenced, non-persistent); the 5 shipped detectors themselves are 100% MOVOS Extension.

### 6. Action Center — **Core** (the strongest candidate on this list)

- **What's built:** `Action` (WO-ARGOS-026) — a case-management state machine (`OPEN → ACKNOWLEDGED/ASSIGNED/RESOLVED/DISMISSED`, server-enforced via a transition map, never trusting a disabled frontend button), a first-interaction snapshot for durable explainability, an assignee, free-text resolution notes, and a cooldown window before the same subject can produce a fresh row (see `docs/implementation/OPERATIONAL_EXECUTION_LAYER_TECHNICAL_NOTES.md`).
- **Universal part:** almost the entire mechanism. A snapshot-on-first-touch, status-transition-enforced, assignable, note-taking workflow entity with a re-eligibility cooldown has no dependency on what triggered it or what it's attached to — it is a generic case/ticket primitive.
- **Mobility-specific part:** exactly two fields — `chargingStationId` (the subject) and `recommendationType` (a `RecommendationType` enum, itself MOVOS-specific). Genericizing them to `subjectId`/`subjectType` and `sourceType` would leave the mechanism completely unchanged.
- **Classification rationale:** classified Core, not Hybrid, because the mobility-specific surface here is two foreign keys, not logic — the thinnest specialization of anything in this inventory. [VERTICAL_BOUNDARIES.md](./VERTICAL_BOUNDARIES.md) treats this as the reference case for what "thin specialization over a Core primitive" looks like.

### 7. Operational Memory — **Hybrid** (concept only — nothing has shipped)

- **What's built:** nothing. [ORGANIZATIONAL_MEMORY.md](../product/ORGANIZATIONAL_MEMORY.md) (WO-ARGOS-027) defines five questions — chronic stations, best operators, common failure patterns, seasonal demand, maintenance efficiency — each as a rollup query over `Action` and `ChargingSession` rows that already exist. No table, no service, no scheduled job exists yet.
- **Universal part:** the _shape_ of every one of those five questions — "which subjects recur," "which handlers close cases cleanly," "which patterns repeat," "what's the seasonal curve," "is response time trending better or worse" — is completely industry-agnostic case-management analytics.
- **Mobility-specific part:** today, all of it — the only artifact that exists is a MOVOS product document naming mobility entities (stations, chargers) in its examples.
- **Classification rationale:** Hybrid, with the honest caveat that this is a design intent, not an implementation to inspect. Its Core potential is real but unverified — the same caution as Sessions above, more so, since there is no code to check the claim against.

### 8. Learning — **Hybrid** (concept only — nothing has shipped)

- **What's built:** nothing. [LEARNING_METRICS.md](../product/LEARNING_METRICS.md) (WO-ARGOS-027) defines five usefulness metrics (time to resolution, recurrence rate, operator acceptance rate, false-positive rate, avoided downtime) against the `Action` model, honestly noting which are computable today and which need a schema addition or remain permanently a proxy (avoided downtime has no counterfactual, in any vertical).
- **Universal part:** every metric defined is a generic case-outcome metric — "how long did it take," "did it recur," "was the response accepted" — none of the math is mobility-specific.
- **Mobility-specific part:** today, again, all of it exists only as a MOVOS document.
- **Classification rationale:** same caveat as Operational Memory — Hybrid by design intent, unverified by implementation.

## Summary table

| Capability            | Classification         | What's Core-shaped                                       | What's MOVOS-specific                                      |
| --------------------- | ---------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Sessions              | Hybrid                 | credential-gate + attempt log + lifecycle engine         | `ChargingSession` fields, OCPP vocabulary                  |
| Connectivity          | Hybrid → Core          | liveness reconciliation, restart-safe staleness rule     | anchored to `ChargingStation`, not a generic `Device`      |
| Billing Foundation    | Hybrid                 | debt-owner abstraction, snapshot-pricing discipline      | tariff field shape (`energyPricePerKwh`, etc.)             |
| Observability         | Hybrid → Core          | topology rollup + evidence precedence                    | `ChargingStation`/`Evse`/`Connector` topology              |
| Recommendation Engine | Hybrid → Core          | stateless, explained, evidenced, non-persistent contract | the 5 concrete detectors                                   |
| Action Center         | **Core**               | the entire state machine                                 | 2 foreign keys (`chargingStationId`, `recommendationType`) |
| Operational Memory    | Hybrid (unimplemented) | the 5 rollup-question shapes                             | everything — no code exists                                |
| Learning              | Hybrid (unimplemented) | the 5 metric definitions                                 | everything — no code exists                                |

## What this means going in

Only Action Center is unambiguously ready to be treated as Core today. Connectivity, Observability, and the Recommendation Engine's contract are strong candidates whose mechanisms are already vertical-agnostic in practice, just never asked to prove it outside mobility. Sessions and Billing carry real universal disciplines wrapped in genuinely charging-specific data shapes. Operational Memory and Learning are ideas, not evidence — their classification here is a bet, not a finding. [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md) picks up from here to name the primitives underneath all eight, independent of which capability happens to contain them today.
