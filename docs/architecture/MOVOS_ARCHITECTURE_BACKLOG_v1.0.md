# MOVOS Architecture Backlog v1.0

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Updated:** 2026-07-31 — WO-ARGOS-009 (CAP-004) updated entries #8 (RFID authorization), #16 (ChargingSession), and #17 (OCPP transaction mapping) to reflect real implementation of the generic credential/session/transaction-mapping infrastructure. See each entry for detail.
**Updated:** 2026-08-01 — WO-ARGOS-009A opened entry #51 (CAP-005: Authorization & Connectivity) as a post-merge action following PR #25's approval, carrying forward DEC-017's offline-policy recommendation and CAP-004's deferred RFID-specific behavior. No other entry changed.
**Updated:** 2026-08-02 — WO-ARGOS-010 implemented the connectivity half of entry #51 (DEC-017 approved and built as CAP-005); the RFID half of #51 remains open and untouched — see the entry's own 2026-08-02 update note. No other entry changed.
**Updated:** 2026-08-03 — WO-ARGOS-016/016A (CAP-008, documentation only, PR #32 merged at `2cbd5ddabed54feafa63b229343d7090aa706aab`, tagged `CAP-008_ARCHITECTURE_COMPLETE`): entries #24 (Tariffs) and #25 (Billing) move from `DISCOVERY`/`UNDEFINED` to `ARCHITECTURE APPROVED` — the full billing domain model, ownership chain, financial-integrity threat model, deployment-shape validation, tariff-timing decision, and canonical debt owner (`BillingAccount`) are all decided; nothing is implemented. Entries #46 (Fleet), #47 (Driver), #48 (Vehicle) each gain an update note recording their evaluation and rejection as debt-owner candidates, without resolving their own open product-scope questions. New entry #52 registers CAP-009 (BillingAccount & TariffSnapshot Foundation) as the next capability.
**Part of:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md)

**This is not a task backlog.** It is the official register of every future MOVOS charging-ecosystem capability whose architectural position must not be lost to chat memory or a single work order's report. Nothing registered here is implemented merely by being listed — see each entry's own status fields for what's actually true today. No database model was created solely to make this register look complete; several entries below are intentionally `UNDEFINED` or `DISCOVERY` with no schema at all.

## Status vocabulary

**Architectural status** (how settled the design is): `UNDEFINED` → `DISCOVERY` → `ARCHITECTURE DRAFTED` → `ARCHITECTURE APPROVED` → `CONTRACTS DEFINED` → `PARTIALLY IMPLEMENTED` → `IMPLEMENTED` → `VALIDATED` → `DEFERRED BY DECISION` (explicitly ruled out or postponed by a named decision, not merely unstarted).

**Data-model status / Interface-contract status / Implementation status** use plain language (`None` / `Conceptual only` / `Partial` / `Complete`) since the WO does not prescribe a fixed vocabulary for these three — precision matters more than a forced enum here.

## How entries relate to other documents

Every entry's "Evidence source" links to where the real analysis lives — this register is an index, not a duplicate of that analysis. Full designs live in the architecture docs it points to ([Charging Ecosystem](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md), [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md)) or the [CAP-003 Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) / [Architecture Decision Register](./MOVOS_ARCHITECTURE_DECISION_REGISTER_v1.0.md).

---

## Cluster A — Protocol & Transport

### 1. OCPP 1.6J

- **Business purpose:** the wire protocol for real-time communication with the first generation of pilot-compatible charging hardware.
- **Domain boundary:** Protocol Layer only — never leaks into domain handlers or persisted models.
- **Related entities:** `ChargingStation`, `Evse`, `Connector`, OCPP protocol-event log.
- **Related protocols:** OCPP 1.6J (JSON over WebSocket).
- **Architectural status:** ARCHITECTURE APPROVED
- **Data-model status:** Complete for the first vertical (BootNotification/Heartbeat/StatusNotification); incomplete for the full message set.
- **Interface-contract status:** Complete for the normalized events this WO implements; partial for the rest of the 1.6J message catalogue.
- **Implementation status:** Partial — BootNotification, Heartbeat, StatusNotification implemented; remaining 1.6J actions (Authorize, StartTransaction, StopTransaction, MeterValues, remote-command CALLs, etc.) not implemented. **Updated 2026-07-31 (WO-ARGOS-008):** the implemented subset is now `SIMULATOR_VALIDATED` — run against a real booted `apps/movos-api` instance, a real PostgreSQL database, and a real WebSocket connection, not just mocked unit tests. Still `Partial`, not `IMPLEMENTED`/`VALIDATED` in the full-entry sense, because most of the 1.6J message catalogue remains unbuilt. See [CAP-003 Architecture Decisions — WO-ARGOS-008 Runtime Validation Record](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#wo-argos-008-runtime-validation-record-2026-07-31).
- **Dependencies:** #3 Protocol adapter boundary, #5 Device identity, #6 Device authentication.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 3; ADR-0008.
- **Decisions still open:** none for the approved scope; message-by-message sequencing for the remaining catalogue is unscoped.
- **MVP relevance:** Core to the MVP — this is the first vertical slice's protocol.
- **Recommended implementation phase:** Now (CAP-003, this work order) for the boot vertical; near-term follow-up for Authorize/Transaction messages once #16/#17 (ChargingSession, transaction mapping) are implemented.
- **Risks if ignored:** None currently — actively being built.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md), [Hardware Compatibility Validation Policy](../engineering/OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md).

### 2. OCPP 2.0.1

- **Business purpose:** the wire protocol for newer-generation hardware and future roaming/Plug & Charge/ISO 15118 capability.
- **Domain boundary:** Protocol Layer only.
- **Related entities:** `ChargingStation`, `Evse`, `Connector`.
- **Related protocols:** OCPP 2.0.1 (JSON over WebSocket, transaction-event model).
- **Architectural status:** ARCHITECTURE APPROVED — the adapter boundary, capability mapping, and message families are designed (per ARGOS's explicit expansion of CAP-003 Decision 3); no message is functionally implemented.
- **Data-model status:** Conceptual only.
- **Interface-contract status:** Boundary/interface defined (protocol detection, adapter registration); no message-level contracts implemented.
- **Implementation status:** None functional — this WO implements protocol _detection_ and an explicit "unsupported" response only, never a working 2.0.1 message handler.
- **Dependencies:** #3 Protocol adapter boundary.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 3 (expanded scope); ADR-0008.
- **Decisions still open:** whether/when a concrete 2.0.1 adapter is built at all depends on Kylum hardware confirmation (see [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md)) — not yet answered.
- **MVP relevance:** Not required for the MVP vertical slice; its _boundary_ is required now so 1.6J work doesn't foreclose it.
- **Recommended implementation phase:** Deferred until hardware confirms need; boundary/design phase is now (this WO).
- **Risks if ignored:** Building 1.6J without this boundary risks a full protocol-layer rewrite later if 2.0.1 hardware appears in the fleet.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 3. Protocol adapter boundary

- **Business purpose:** keep the MOVOS domain permanently independent of any one OCPP wire version.
- **Domain boundary:** the seam between Protocol Layer and domain handlers — normalized events in, normalized commands out.
- **Related entities:** none directly (a structural/interface concept, not a persisted entity).
- **Related protocols:** OCPP 1.6J, OCPP 2.0.1, future revisions, simulator/hardware adapters.
- **Architectural status:** ARCHITECTURE APPROVED
- **Data-model status:** N/A (interface concept).
- **Interface-contract status:** Complete for the normalized vocabulary this WO defines (device boot, heartbeat, connector/EVSE status, and 12 others — see the coexistence doc); the remainder of the vocabulary is drafted but not implemented.
- **Implementation status:** Partial — the boundary and the 1.6J concrete adapter exist; the 2.0.1 adapter is a stub that fails explicitly.
- **Dependencies:** none (foundational).
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 3, Decision 4; ADR-0008, ADR-0009.
- **Decisions still open:** none.
- **MVP relevance:** Core to the MVP — everything else in Cluster A depends on this existing first.
- **Recommended implementation phase:** Now (CAP-003, this work order).
- **Risks if ignored:** Domain code coupling directly to OCPP DTOs, making every future protocol change a domain-layer rewrite.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md).

### 4. Vendor extensions

- **Business purpose:** accommodate manufacturer-specific, non-standard OCPP behavior without corrupting the core protocol contracts.
- **Domain boundary:** Protocol Layer, isolated per-adapter — never in the OCPP core or domain handlers.
- **Related entities:** `ChargingStation` (via future vendor/model reference, see #32–34).
- **Related protocols:** vendor-specific message types/error codes layered on OCPP 1.6J/2.0.1.
- **Architectural status:** ARCHITECTURE DRAFTED — a handling strategy is named in the coexistence doc; no concrete extension has been designed against real vendor documentation.
- **Data-model status:** None.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #3 Protocol adapter boundary, #32 Vendor profiles, [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md) (known vendor-extension question).
- **Decisions already approved:** none specific to this item; inherits Decision 3's "vendor extensions" requirement.
- **Decisions still open:** whether to build a generic extension-registration mechanism now or per-vendor as needed.
- **MVP relevance:** Not required for the MVP vertical slice.
- **Recommended implementation phase:** After real vendor documentation is available (post hardware-information request).
- **Risks if ignored:** Manufacturer-specific conditional logic leaking into the OCPP core — explicitly forbidden by this work order's own Phase 8 instruction.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

---

## Cluster B — Device Identity & Trust

### 5. Device identity

- **Business purpose:** give every physical charging station a stable, non-secret protocol identity distinct from its internal database key.
- **Domain boundary:** Charging Infrastructure (`ChargingStation`).
- **Related entities:** `ChargingStation.ocppIdentity`.
- **Related protocols:** OCPP 1.6J/2.0.1 connection identity.
- **Architectural status:** ARCHITECTURE APPROVED
- **Data-model status:** Complete — `ocppIdentity` field added, globally unique, not the primary key.
- **Interface-contract status:** Complete for provisioning/lookup; no public API exposes it for editing beyond provisioning flows in this WO.
- **Implementation status:** Implemented (this WO).
- **Dependencies:** none.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 1; ADR-0010.
- **Decisions still open:** none.
- **MVP relevance:** Core to the MVP.
- **Recommended implementation phase:** Now (CAP-003, this work order).
- **Risks if ignored:** No way to route an incoming WebSocket connection to a `ChargingStation` row.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 1](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-1--charging-station-network-identity), [Device Provisioning Guide](../engineering/OCPP_DEVICE_PROVISIONING_GUIDE.md).

### 6. Device authentication

- **Business purpose:** ensure only a legitimately provisioned device can present itself as a given `ChargingStation`.
- **Domain boundary:** Device Lifecycle (Provisioning) / Protocol Layer (Authentication).
- **Related entities:** `ChargingStation` (secret hash storage).
- **Related protocols:** OCPP 1.6J Security Profile 1/2 (HTTP Basic over WSS).
- **Architectural status:** ARCHITECTURE APPROVED
- **Data-model status:** Complete for the MVP mechanism (hashed secret storage).
- **Interface-contract status:** Complete (provisioning, rotation, revocation flows).
- **Implementation status:** Implemented (this WO) for the MVP mechanism; mutual TLS not implemented.
- **Dependencies:** #5 Device identity.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 2; ADR-0010.
- **Decisions still open:** timing of the mutual-TLS upgrade, contingent on hardware confirmation.
- **MVP relevance:** Core to the MVP.
- **Recommended implementation phase:** Now (CAP-003, this work order) for Basic Auth; future for mTLS.
- **Risks if ignored:** Unauthenticated device connections accepted into production — unacceptable for a real pilot customer.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 2](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-2--device-authentication), [Secret Rotation Guide](../engineering/OCPP_SECRET_ROTATION_GUIDE.md).

### 7. Certificate management

- **Business purpose:** support the future mutual-TLS authentication upgrade and, eventually, ISO 15118/Plug & Charge certificate chains.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** future `ChargingStation` certificate reference (not modeled).
- **Related protocols:** OCPP 2.0.1 Security Profile 3; ISO 15118 (see #49).
- **Architectural status:** DISCOVERY — named as a future upgrade path in ADR-0010 and as a `CapabilityProfile` field in the Device Capability Architecture; no issuance/rotation/revocation design exists.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #6 Device authentication (future mTLS), #49 ISO 15118 certificates.
- **Decisions already approved:** none directly; touched by CAP-003 Decision 2's "future stronger mechanism."
- **Decisions still open:** whether MOVOS operates its own CA, uses a managed PKI service, or relies on vendor-issued certificates.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After mTLS is prioritized (post-pilot, hardware-dependent).
- **Risks if ignored:** None immediate — correctly sequenced after the MVP.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), ADR-0010.

---

## Cluster C — Authorization

### 8. RFID authorization

- **Business purpose:** let a driver start a charging session by tapping a physical RFID card/fob.
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `RFID`), `ChargingSession`.
- **Related protocols:** OCPP 1.6J `idTag`; OCPP 2.0.1 `idToken` (type `ISO14443`/`ISO15693`).
- **Architectural status:** ARCHITECTURE DRAFTED — explicitly designed in depth per this work order's Phase 6 requirement (identifier normalization, storage, status, validity, assignment, revocation, replacement, local-list sync, offline behavior, protocol mapping, physical-card-vs-credential-ID distinction).
- **Data-model status:** Partial — **updated 2026-07-31 (WO-ARGOS-009):** `AuthorizationCredential` is now a real Prisma model with `RFID` as one of 8 supported `AuthCredentialType` values, generic CRUD only. No RFID-specific fields (no UID-normalization tracking, no local-list-sync state).
- **Interface-contract status:** Partial — generic credential issue/list/revoke contracts are real (`POST/GET /credentials`, `PATCH /credentials/:id/revoke`); no RFID-specific contract (UID normalization, local-list push) exists.
- **Implementation status:** Partial — generic credential CRUD and generic `AuthorizationAttempt` resolution (unknown/revoked/expired/blocked) work for any credential type including RFID; RFID-specific behavior (UID normalization to canonical hex, Local Authorization List sync, offline-authorization-then-reconcile flow) remains unimplemented.
- **Dependencies:** #16 ChargingSession (done — CAP-004), #15 Local Authorization List, #47 Driver.
- **Decisions already approved:** none yet for RFID-specific behavior — the generic credential infrastructure it depends on is now implemented (CAP-004), but that was not itself an RFID-specific decision.
- **Decisions still open:** secure-storage mechanism for card identifiers beyond generic credential storage; whether/when Local Authorization List sync gets built.
- **MVP relevance:** Not required for the first vertical slice (BootNotification/Heartbeat/StatusNotification/Authorize/StartTransaction/MeterValues/StopTransaction).
- **Recommended implementation phase:** RFID-specific behavior (UID normalization, local-list sync) is the natural next increment now that the generic credential model exists.
- **Risks if ignored:** None immediate; architecture is captured so it isn't reinvented later.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md), [Authorization Guide](../engineering/AUTHORIZATION_GUIDE.md).

### 9. QR authorization

- **Business purpose:** let a driver start a session by scanning a QR code (app-less flow).
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `QR`).
- **Related protocols:** none directly protocol-level; typically resolves to a remote-start command.
- **Architectural status:** DISCOVERY — named as a credential type in the Authorization Architecture; no detailed design (only RFID was required to be designed in depth this WO).
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #11 Remote authorization, #16 ChargingSession.
- **Decisions already approved:** none.
- **Decisions still open:** QR payload format, session binding mechanism.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After RFID, alongside App authorization.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

### 10. App authorization

- **Business purpose:** let a driver start/stop a session from a MOVOS or Kylum-branded mobile app.
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `App`), `User`.
- **Related protocols:** resolves to Remote Start/Stop (#36/#37).
- **Architectural status:** DISCOVERY
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #11 Remote authorization, #36 Remote Start, #37 Remote Stop.
- **Decisions already approved:** none.
- **Decisions still open:** whether App auth reuses the existing `User`/`Membership` model or needs a separate driver-facing identity (see #47).
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot, once a driver-facing app surface exists at all (none does today).
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

### 11. Remote authorization

- **Business purpose:** the general mechanism by which any non-card credential (App, QR, API) triggers a session without the device itself validating an on-board `idTag`.
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `Remote`), `AuthorizationAttempt`, `AuthorizationDecision`.
- **Related protocols:** OCPP `RemoteStartTransaction`/`RemoteStopTransaction` (1.6J), transaction-event model (2.0.1).
- **Architectural status:** DISCOVERY — conceptually named as the mechanism underlying #9/#10/#12, not independently designed.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #36 Remote Start, #37 Remote Stop.
- **Decisions already approved:** none.
- **Decisions still open:** authorization-decision ownership (does MOVOS or the device make the final call?).
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Alongside Remote Start/Stop.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

### 12. API authorization

- **Business purpose:** allow a third-party integration or fleet-management system to authorize sessions programmatically.
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `API`).
- **Related protocols:** none protocol-level; a MOVOS API concern.
- **Architectural status:** DISCOVERY
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #11 Remote authorization, #13 Fleet authorization.
- **Decisions already approved:** none.
- **Decisions still open:** API-key vs. OAuth-style credential shape for third-party callers.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot, demand-driven.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

### 13. Fleet authorization

- **Business purpose:** authorize sessions on behalf of a commercial fleet operator rather than an individual driver.
- **Domain boundary:** Authorization.
- **Related entities:** future `AuthorizationCredential` (type `Fleet`), #46 Fleet.
- **Related protocols:** none protocol-level beyond standard authorization flows.
- **Architectural status:** UNDEFINED — named only as a credential type; no relationship to a `Fleet` entity has been sketched since #46 Fleet is itself undefined.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #46 Fleet, #11 Remote authorization.
- **Decisions already approved:** none.
- **Decisions still open:** everything — this is one of the least-scoped items in the register.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped; depends on a future fleet-customer product decision.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md) (named, not designed).

### 14. Plug & Charge / ISO 15118

- **Business purpose:** let a vehicle authorize and start a session automatically on physical connection, with no card/app/QR step.
- **Domain boundary:** Authorization / Device Lifecycle (certificates).
- **Related entities:** future `AuthorizationCredential` (type `PlugAndCharge`), #49 ISO 15118 certificates.
- **Related protocols:** ISO 15118, OCPP 2.0.1's Plug & Charge feature set.
- **Architectural status:** UNDEFINED — named as a credential type only; requires OCPP 2.0.1 (#2) and certificate management (#7) first, neither of which is implemented.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #2 OCPP 2.0.1, #7 Certificate management, #49 ISO 15118 certificates.
- **Decisions already approved:** none.
- **Decisions still open:** everything; this is a materially later capability than the pilot needs.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Long-term, post-2.0.1 adoption.
- **Risks if ignored:** None immediate — correctly sequenced last among authorization methods.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

### 15. Local Authorization List

- **Business purpose:** let a charging station authorize known RFID cards even while offline/disconnected from MOVOS.
- **Domain boundary:** Authorization / Protocol Layer.
- **Related entities:** future `AuthorizationCredential` list, synced to device.
- **Related protocols:** OCPP 1.6J `SendLocalList`/`GetLocalListVersion`; OCPP 2.0.1 equivalent local-authorization-list messages.
- **Architectural status:** ARCHITECTURE DRAFTED — synchronization and offline-authorization behavior are explicitly addressed in the RFID design (Phase 6 requirement).
- **Data-model status:** None.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #8 RFID authorization.
- **Decisions already approved:** none.
- **Decisions still open:** sync cadence, conflict resolution between local list and MOVOS's live authorization state.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Alongside RFID.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

---

## Cluster D — Charging Operations

### 16. ChargingSession

- **Business purpose:** the durable business record of one charging event, independent of the underlying protocol connection.
- **Domain boundary:** Charging Operations.
- **Related entities:** `Connector` (owning relation), `Evse`, `ChargingStation`, `Site`, `Organization` (derived).
- **Related protocols:** OCPP 1.6J `StartTransaction`/`StopTransaction`, OCPP 2.0.1 transaction-event model.
- **Architectural status:** ARCHITECTURE APPROVED — CAP-003 Architecture Decisions Decision 7, refined and approved by ARGOS (WO-ARGOS-007), with a dedicated architecture document.
- **Data-model status:** Complete for the mandatory shape — **updated 2026-07-31 (WO-ARGOS-009):** `ChargingSession` is now a real Prisma model with all required fields (identity/ownership, `protocolVersion`/`protocolTransactionId`, `status`/`terminationReason`, `meterStart`/`meterStop`/`energyWh`, `startedAt`/`endedAt`). No pricing/invoice/payment fields — those remain explicitly out of scope.
- **Interface-contract status:** Complete for the first vertical — `SessionLifecycleService`'s full method set (`createSession`/`activateSession`/`suspendSession`/`resumeSession`/`stopSession`/`failSession`/`cancelSession`/`updateEnergy`) and a validated transition table.
- **Implementation status:** Partial — session creation, lifecycle transitions, and OCPP 1.6J wiring (`Authorize`→attempt, `StartTransaction`→create, `MeterValues`→energy, `StopTransaction`→terminate) are implemented and unit-tested. **Not yet validated against a live database or real WebSocket connection** (unlike CAP-003's OCPP transport). No billing/cost calculation, no `Driver`/`Vehicle`/`Fleet` linkage (conceptual only via `AuthorizationCredential.ownerRef`, which doesn't exist as a column).
- **Dependencies:** #17 OCPP transaction mapping (done — CAP-004), #8 RFID authorization (generic credential infrastructure done — CAP-004; RFID-specific behavior still open).
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 7; ADR-0012; DEC-013–DEC-016 (WO-ARGOS-009, ACCEPTED).
- **Decisions still open:** authorization/idTag identity dependency beyond `AuthorizationCredential` (no driver/vehicle identity concept exists yet — see #47/#48).
- **MVP relevance:** Core — first real transaction-handling vertical, built on top of CAP-003's boot vertical.
- **Recommended implementation phase:** Done (CAP-004, this entry) for the mandatory shape; live-database/runtime validation is the next required step before this can be claimed `SIMULATOR_VALIDATED`.
- **Risks if ignored:** N/A — implemented. Residual risk: no runtime validation performed yet (see Implementation status).
- **Evidence source:** [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [CAP-004 Charging Sessions Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md), [Charging Session Guide](../engineering/CHARGING_SESSION_GUIDE.md), [Session Lifecycle Guide](../engineering/SESSION_LIFECYCLE_GUIDE.md), ADR-0012.

### 17. OCPP transaction mapping

- **Business purpose:** define precisely how a protocol-level transaction relates to a MOVOS `ChargingSession`.
- **Domain boundary:** the seam between Protocol Layer and Charging Operations.
- **Related entities:** `ChargingSession` (future), protocol-event log.
- **Related protocols:** OCPP 1.6J `transactionId`; OCPP 2.0.1 `transactionInfo`.
- **Architectural status:** ARCHITECTURE APPROVED — documented in both the ChargingSession Architecture and the Protocol Coexistence doc.
- **Data-model status:** Complete for 1.6J — `ChargingSession.protocolTransactionId`, unique per `chargingStationId`, MOVOS-assigned (see implementation note below).
- **Interface-contract status:** Complete for 1.6J — `TransactionStart`/`TransactionUpdate`/`TransactionEnd` normalized events (reserved by CAP-003, implemented by CAP-004) map onto `SessionLifecycleService` calls; documented-only for 2.0.1.
- **Implementation status:** Partial — 1.6J mapping fully implemented (`Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction` → `AuthorizationHandler`/`TransactionStartHandler`/`TransactionUpdateHandler`/`TransactionEndHandler`), unit-tested, not yet runtime-validated. OCPP 2.0.1's `TransactionEvent` mapping remains documentation-only, consistent with the 2.0.1 adapter itself.
- **Dependencies:** #16 ChargingSession (done — CAP-004).
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 7 (transaction vs. session distinction); DEC-014 (WO-ARGOS-009, ACCEPTED — session-creation boundary).
- **Decisions still open:** none beyond what #16 leaves open.
- **MVP relevance:** Core — implemented as part of the first real transaction-handling vertical.
- **Recommended implementation phase:** Done (CAP-004, this entry) for 1.6J.
- **Risks if ignored:** N/A — implemented. The reconnect-spanning semantics ARGOS approved (session continuity tied to transaction continuity, not connection continuity) are documented in [CAP-004 §8](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#8-session-lifecycle) but not yet exercised by a live-reconnect test — tracked as a residual gap alongside #16's runtime-validation note.
- **Evidence source:** [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [OCPP Mapping Guide](../engineering/OCPP_MAPPING_GUIDE.md).

### 18. Reservations

- **Business purpose:** let a driver reserve a specific connector for a future time window.
- **Domain boundary:** Charging Operations.
- **Related entities:** future `Reservation`, `Connector`, `ChargingSession`.
- **Related protocols:** OCPP 1.6J `ReserveNow`/`CancelReservation`; OCPP 2.0.1 equivalent.
- **Architectural status:** DISCOVERY — named in the Charging Ecosystem Architecture's Charging Operations area; no detailed design.
- **Data-model status:** None.
- **Interface-contract status:** None (named in the normalized-vocabulary list as a future concept, not defined).
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot, demand-driven.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md).

### 19. Availability control

- **Business purpose:** let an operator administratively mark an EVSE/Connector unavailable (e.g. for maintenance) independent of live device status.
- **Domain boundary:** Charging Operations / Charging Infrastructure.
- **Related entities:** `Evse`, `Connector` (administrative status, already partially real via CAP-002 CRUD).
- **Related protocols:** OCPP 1.6J `ChangeAvailability`; OCPP 2.0.1 equivalent.
- **Architectural status:** DISCOVERY — CAP-002 already gives administrative status writes; the OCPP remote-command side (device-initiated availability change) is undesigned.
- **Data-model status:** Partial — `Evse.status`/`Connector.status` already exist and support administrative writes (CAP-002).
- **Interface-contract status:** None for the remote-command direction.
- **Implementation status:** Partial (administrative CRUD only, pre-existing).
- **Dependencies:** #40 (listed as its own item below, but conceptually the same capability — see note there).
- **Decisions already approved:** CAP-002's existing status-write conventions.
- **Decisions still open:** how a remote `ChangeAvailability` command interacts with the CAP-002 CRUD write path (same dual-writer question as Decision 5, extended to commands).
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Alongside Remote Start/Stop/Reset/Unlock (#36–39).
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path).

---

## Cluster E — Energy

### 20. Smart Charging

- **Business purpose:** dynamically adjust a station's charging power based on grid, site, or tariff constraints.
- **Domain boundary:** Energy.
- **Related entities:** future charging-profile records, `Evse`, `ChargingSession`.
- **Related protocols:** OCPP 1.6J `SetChargingProfile`/`ClearChargingProfile`; OCPP 2.0.1 equivalent (more granular).
- **Architectural status:** DISCOVERY — named in the normalized vocabulary (charging profile) and the Charging Ecosystem Architecture; no design.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #21 Load balancing, #22 Energy management.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot; a materially large capability.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md).

### 21. Load balancing

- **Business purpose:** share available power across multiple EVSEs/stations at one Site without exceeding a site-level electrical limit.
- **Domain boundary:** Energy.
- **Related entities:** `Site`, `ChargingStation`, `Evse` (aggregate power).
- **Related protocols:** implemented via Smart Charging profiles (#20).
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #20 Smart Charging.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md) (named, not designed).

### 22. Energy management

- **Business purpose:** the umbrella capability coordinating Smart Charging, load balancing, and future grid-interaction concerns for a Site.
- **Domain boundary:** Energy.
- **Related entities:** `Site` and below.
- **Related protocols:** OCPP Smart Charging feature set.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #20 Smart Charging, #21 Load balancing.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md) (named, not designed).

### 23. Demand response

- **Business purpose:** allow a utility or grid operator to signal MOVOS to reduce charging load during peak demand.
- **Domain boundary:** Energy.
- **Related entities:** `Site`, future external-integration record.
- **Related protocols:** OCPP Smart Charging; potentially OpenADR or a utility-specific integration (outside OCPP entirely).
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #22 Energy management.
- **Decisions already approved:** none.
- **Decisions still open:** everything, including whether this is ever in scope for MOVOS vs. a utility-side concern.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Charging Ecosystem Architecture](./MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md) (named, not designed).

---

## Cluster F — Commercial

### 24. Tariffs

- **Business purpose:** define how a charging session is priced.
- **Domain boundary:** Commercial.
- **Related entities:** future `Tariff`, `TariffSnapshot`, `Site`, `ChargingSession`.
- **Related protocols:** none directly; OCPP 1.6J has a limited `Local Auth List`/pricing display extension, OCPP 2.0.1 has native tariff messages, neither in scope.
- **Architectural status:** ARCHITECTURE APPROVED — CAP-008 (WO-ARGOS-016/016A) decided tariff-timing semantics: a `TariffSnapshot` captured at session start and again at each pricing-relevant boundary crossed (a tariff edit, a scheduled peak/off-peak or day/night transition), degenerating to a single snapshot for any session that crosses none. See the 2026-08-03 update note below.
- **Data-model status:** None on the backend — CAP-008 is documentation only, no `Tariff`/`TariffSnapshot` model exists.
- **Interface-contract status:** None.
- **Implementation status:** None (frontend mock only).
- **Dependencies:** #16 ChargingSession (done — CAP-004), #25 Billing, #52 CAP-009 (BillingAccount & TariffSnapshot Foundation — the implementation of this decision).
- **Decisions already approved:** tariff-timing model (Option C, snapshot-on-boundary) — [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md).
- **Decisions still open:** the exact snapshot-triggering rule (which edits count as "pricing-relevant"), the energy-attribution rule for splitting a session's energy across snapshot boundaries when `MeterValue` telemetry is sparse, and which clock governs pricing (device-reported vs. MOVOS-received) — all explicitly left open by `CAP-008_DECISION.md` for CAP-009 to resolve.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Now unblocked architecturally — CAP-009 is the next capability (see #52).
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 7](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary), [MOVOS Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md), [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md), [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md).

**2026-08-03 update (WO-ARGOS-016/016A):** see the Cluster F header note and entry #25 below — this entry's architectural status changed as a direct consequence of CAP-008, not an independent update.

### 25. Billing

- **Business purpose:** convert a completed, tariff-priced session into an invoice or statement.
- **Domain boundary:** Commercial.
- **Related entities:** future `Invoice`, `BillingAccount`, `ChargingSession`, `TariffSnapshot`.
- **Related protocols:** none.
- **Architectural status:** ARCHITECTURE APPROVED — CAP-008 (WO-ARGOS-016/016A) defined the full billing domain model (billable entities and events, ownership chain, financial-integrity threat model, 5 deployment-shape validations) and named the canonical debt owner. See the 2026-08-03 update note below.
- **Data-model status:** None — CAP-008 is documentation only; no `Invoice`/`BillingAccount` model exists.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #24 Tariffs, #16 ChargingSession (done — CAP-004), #52 CAP-009 (BillingAccount & TariffSnapshot Foundation).
- **Decisions already approved:** the entity that generates revenue is `ChargingSession`, not a party; the canonical debt owner is `BillingAccount`, a new concept, not `Organization`/`Driver`/`Vehicle`/`Fleet`/`AuthorizationCredential` (all evaluated and rejected) — [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md), [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md).
- **Decisions still open:** `BillingAccount`'s schema (fields, `Organization` scoping already established as a principle, not yet as a migration), duplicate-invoice prevention's exact constraint shape, and everything named as open in `CAP-008_DECISION.md`/`CAP-008_DEBT_OWNERSHIP.md`'s own "what this does not resolve" sections.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Now unblocked architecturally — CAP-009 is the next capability (see #52).
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md), [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md), [CAP-008_BILLING_THREAT_MODEL.md](../reviews/CAP-008_BILLING_THREAT_MODEL.md), [CAP-008_SCENARIOS.md](../reviews/CAP-008_SCENARIOS.md), [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md), [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md).

**2026-08-03 update (WO-ARGOS-016/016A):** PR #32 merged to `main` at `2cbd5ddabed54feafa63b229343d7090aa706aab`, tagged `CAP-008_ARCHITECTURE_COMPLETE`. This entry moves from `UNDEFINED` to `ARCHITECTURE APPROVED` — the domain shape, ownership, and canonical debt owner are decided; the schema, migration, and every implementation detail remain entirely unbuilt. See #52 for the registered next capability.

### 26. Payments

- **Business purpose:** process the actual monetary transaction for a billed session.
- **Domain boundary:** Commercial.
- **Related entities:** future payment record, `Invoice`, `BillingAccount`.
- **Related protocols:** none; a payment-provider integration concern.
- **Architectural status:** UNDEFINED — CAP-008 named `PAYMENT_RECEIVED` in its billing-events vocabulary ([CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) Objective 4) and Threat #6 (failed payment) in its threat model, both explicitly as placeholders with no design — CAP-008's own work order forbade designing Payments at all ("Do not implement... payments... Stripe"). This entry's status is unchanged.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #25 Billing.
- **Decisions already approved:** none.
- **Decisions still open:** everything, including PSP selection.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After Billing.
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) Objective 4 (named, not designed), [CAP-008_BILLING_THREAT_MODEL.md](../reviews/CAP-008_BILLING_THREAT_MODEL.md) Threat #6.

### 27. Refunds

- **Business purpose:** reverse a payment for a disputed or failed session.
- **Domain boundary:** Commercial.
- **Related entities:** future refund record, payment record.
- **Related protocols:** none.
- **Architectural status:** UNDEFINED — CAP-008 named `REFUND_CREATED` in its billing-events vocabulary ([CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) Objective 4) as a placeholder with no design, consistent with its own explicit scope exclusion. This entry's status is unchanged.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #26 Payments.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After Payments.
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md) Objective 4 (named, not designed).

### 28. Roaming / OCPI

- **Business purpose:** let drivers from other charging networks use MOVOS-operated stations (and vice versa) via the Open Charge Point Interface.
- **Domain boundary:** Commercial / cross-cutting (also touches Authorization).
- **Related entities:** future roaming-partner record, `ChargingStation` (public exposure), `ChargingSession`.
- **Related protocols:** OCPI, distinct from OCPP entirely.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession, #11 Remote authorization.
- **Decisions already approved:** none.
- **Decisions still open:** everything, including whether MOVOS ever participates in roaming networks at all.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped — a strategic product decision, not an engineering sequencing question.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

---

## Cluster G — Device Lifecycle

### 29. Firmware management

- **Business purpose:** track and remotely trigger firmware updates on charging stations.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** `ChargingStation`, future `FirmwareVersion` (see #34).
- **Related protocols:** OCPP 1.6J `UpdateFirmware`/`FirmwareStatusNotification`; OCPP 2.0.1 equivalent.
- **Architectural status:** DISCOVERY — named as a `CapabilityProfile` field in the Device Capability Architecture; no update-orchestration design.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #34 Firmware profiles.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

### 30. Diagnostics

- **Business purpose:** retrieve diagnostic logs/reports from a station on demand for troubleshooting.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** `ChargingStation`.
- **Related protocols:** OCPP 1.6J `GetDiagnostics`/`DiagnosticsStatusNotification`; OCPP 2.0.1 equivalent.
- **Architectural status:** DISCOVERY — a `diagnostics/` folder is reserved in the OCPP engine's internal structure (this WO), but unimplemented.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None (folder reserved, empty).
- **Dependencies:** #31 Device logs.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot.
- **Risks if ignored:** None immediate.
- **Evidence source:** [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md) (structure only).

### 31. Device logs

- **Business purpose:** durable storage of retrieved diagnostic/log data for later review.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** `ChargingStation`, future log-artifact record.
- **Related protocols:** downstream of #30 Diagnostics.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #30 Diagnostics.
- **Decisions already approved:** none.
- **Decisions still open:** storage medium (blob store vs. DB) and retention policy — same class of question as Decision 5's telemetry-retention constraint.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Alongside Diagnostics.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

### 32. Vendor profiles

- **Business purpose:** record what a given manufacturer's hardware line is known to support, to avoid manufacturer-specific conditionals in the OCPP core.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** future `Vendor` → `DeviceModel` → `FirmwareVersion` → `CapabilityProfile` tree.
- **Related protocols:** all — this is where protocol/feature support per vendor is recorded.
- **Architectural status:** ARCHITECTURE DRAFTED — full conceptual tree defined per this work order's Phase 8 requirement.
- **Data-model status:** None.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #33 Model profiles, #34 Firmware profiles, #35 Hardware compatibility validation.
- **Decisions already approved:** none — drafted, not approved.
- **Decisions still open:** whether to model this before or after real Kylum hardware data narrows the actual vendor set needed.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After the Kylum hardware information request is answered.
- **Risks if ignored:** Vendor-specific conditional logic creeping into the OCPP core over time — explicitly forbidden by this work order.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

### 33. Model profiles

- **Business purpose:** the device-model tier of the vendor-profile tree (#32) — what a specific model line supports, independent of firmware version.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** future `DeviceModel` (child of `Vendor`, parent of `FirmwareVersion`).
- **Related protocols:** inherits from #32.
- **Architectural status:** ARCHITECTURE DRAFTED — part of the same tree as #32.
- **Data-model status:** None.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #32 Vendor profiles.
- **Decisions already approved:** none.
- **Decisions still open:** same as #32.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Same as #32.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

### 34. Firmware profiles

- **Business purpose:** the firmware-version tier of the vendor-profile tree — what a specific firmware build supports (which can differ from the model's general capability).
- **Domain boundary:** Device Lifecycle.
- **Related entities:** future `FirmwareVersion` (child of `DeviceModel`, parent of `CapabilityProfile`).
- **Related protocols:** inherits from #32.
- **Architectural status:** ARCHITECTURE DRAFTED
- **Data-model status:** None.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #33 Model profiles, #29 Firmware management.
- **Decisions already approved:** none.
- **Decisions still open:** same as #32.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Same as #32.
- **Risks if ignored:** None immediate.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

### 35. Hardware compatibility validation

- **Business purpose:** track, per vendor/model/firmware, how thoroughly MOVOS has actually verified real-world compatibility — never overclaiming certification.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** `CapabilityProfile` (future), the validation-level enum used directly by this work order's simulator testing.
- **Related protocols:** all.
- **Architectural status:** ARCHITECTURE APPROVED — the six-level validation vocabulary (`UNASSESSED` → `CERTIFICATION_EVIDENCE_AVAILABLE`) is defined and actively used by this work order to report the first vertical slice's own validation level.
- **Data-model status:** None persisted yet (used descriptively in documentation only, not stored per-device).
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None as a queryable system; the vocabulary itself is in active use.
- **Dependencies:** #32 Vendor profiles (for a persisted version of this).
- **Decisions already approved:** the vocabulary itself, via this work order.
- **Decisions still open:** whether/when to persist validation levels per device rather than track them only in documentation.
- **MVP relevance:** The _vocabulary_ is used in the MVP's own reporting; a persisted, queryable version is not required.
- **Recommended implementation phase:** Vocabulary now (this WO); persisted tracking alongside #32.
- **Risks if ignored:** Overclaiming hardware compatibility without evidence — the exact failure mode this vocabulary exists to prevent.
- **Evidence source:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), [Hardware Compatibility Validation Policy](../engineering/OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md).

---

## Cluster H — Remote Commands & Control

### 36. Remote Start

- **Business purpose:** let MOVOS (on behalf of an operator or an authorized driver) start a charging session remotely.
- **Domain boundary:** Charging Operations / Protocol Layer.
- **Related entities:** `ChargingSession` (future), `Evse`, `Connector`.
- **Related protocols:** OCPP 1.6J `RemoteStartTransaction`; OCPP 2.0.1 `RequestStartTransaction`.
- **Architectural status:** ARCHITECTURE DRAFTED — named in the normalized outbound-command vocabulary (Protocol Coexistence doc); not implemented.
- **Data-model status:** None.
- **Interface-contract status:** Normalized command name reserved; payload contract not fully specified.
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession, #11 Remote authorization.
- **Decisions already approved:** none specific.
- **Decisions still open:** authorization prerequisites for issuing the command (which `MemberRole`s, per Decision 7's authorization-reference note).
- **MVP relevance:** Not required for the first vertical slice (this WO is inbound-message-only: Boot/Heartbeat/Status).
- **Recommended implementation phase:** After ChargingSession (#16).
- **Risks if ignored:** None immediate.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 37. Remote Stop

- **Business purpose:** let MOVOS remotely stop an in-progress session.
- **Domain boundary:** Charging Operations / Protocol Layer.
- **Related entities:** `ChargingSession` (future).
- **Related protocols:** OCPP 1.6J `RemoteStopTransaction`; OCPP 2.0.1 `RequestStopTransaction`.
- **Architectural status:** ARCHITECTURE DRAFTED
- **Data-model status:** None.
- **Interface-contract status:** Normalized command name reserved.
- **Implementation status:** None.
- **Dependencies:** #36 Remote Start, #16 ChargingSession.
- **Decisions already approved:** none specific.
- **Decisions still open:** same as #36.
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Same as #36.
- **Risks if ignored:** None immediate.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 38. Reset

- **Business purpose:** remotely reboot a station (soft or hard reset).
- **Domain boundary:** Protocol Layer / Device Lifecycle.
- **Related entities:** `ChargingStation`.
- **Related protocols:** OCPP 1.6J/2.0.1 `Reset`.
- **Architectural status:** ARCHITECTURE DRAFTED — named in the normalized vocabulary.
- **Data-model status:** None.
- **Interface-contract status:** Normalized command name reserved.
- **Implementation status:** None.
- **Dependencies:** none beyond the protocol adapter boundary (#3).
- **Decisions already approved:** none specific.
- **Decisions still open:** authorization prerequisites, interaction with an in-progress session (should a Reset be blocked or force-terminate a session?).
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Alongside Remote Start/Stop.
- **Risks if ignored:** None immediate.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 39. Unlock Connector

- **Business purpose:** remotely release a stuck connector latch.
- **Domain boundary:** Protocol Layer.
- **Related entities:** `Connector`.
- **Related protocols:** OCPP 1.6J/2.0.1 `UnlockConnector`.
- **Architectural status:** ARCHITECTURE DRAFTED — named in the normalized vocabulary.
- **Data-model status:** None.
- **Interface-contract status:** Normalized command name reserved.
- **Implementation status:** None.
- **Dependencies:** none beyond the protocol adapter boundary (#3).
- **Decisions already approved:** none specific.
- **Decisions still open:** authorization prerequisites.
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Alongside Remote Start/Stop/Reset.
- **Risks if ignored:** None immediate.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 40. Availability control (remote command variant)

- **Business purpose:** the device-command counterpart to #19 — MOVOS pushing an availability change to the device rather than only recording an administrative status.
- **Domain boundary:** Protocol Layer / Charging Operations.
- **Related entities:** `Evse`, `Connector`.
- **Related protocols:** OCPP 1.6J/2.0.1 `ChangeAvailability`.
- **Architectural status:** DISCOVERY — see #19 for the administrative side; this entry tracks the remote-command direction specifically to avoid the two being conflated.
- **Data-model status:** Partial (shared with #19's existing status fields).
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #19 Availability control (administrative).
- **Decisions already approved:** none specific.
- **Decisions still open:** same dual-writer question as #19.
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Alongside #36–39.
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path).

---

## Cluster I — Telemetry & Observability

### 41. Telemetry

- **Business purpose:** the umbrella concept for all device-reported operational data beyond simple status (power draw, energy delivered, temperature, etc.).
- **Domain boundary:** cross-cutting — touches Protocol Layer (ingestion), Charging Infrastructure (association), and future Energy capabilities.
- **Related entities:** `Evse`, `Connector`, protocol-event log.
- **Related protocols:** OCPP `MeterValues` and related measurand vocabulary.
- **Architectural status:** ARCHITECTURE APPROVED conceptually (Decision 5 distinguishes telemetry from current state/business history/audit); no persisted telemetry store exists.
- **Data-model status:** None dedicated (raw-event log captures message payloads generically, not telemetry-optimized).
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #42 Meter values, #3 Protocol adapter boundary.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 5 (conceptual distinction only).
- **Decisions still open:** dedicated time-series storage strategy — explicitly deferred by Decision 5 as "its own future decision."
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Once real energy-metering/billing requirements are scoped.
- **Risks if ignored:** None immediate — correctly deferred.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path).

### 42. Meter values

- **Business purpose:** periodic energy/power readings reported during an active session.
- **Domain boundary:** Protocol Layer / Telemetry.
- **Related entities:** `ChargingSession` (future), protocol-event log.
- **Related protocols:** OCPP 1.6J/2.0.1 `MeterValues`.
- **Architectural status:** ARCHITECTURE DRAFTED — named in the normalized vocabulary; this work order explicitly evaluates (per Phase 13) whether to include it in the first vertical and, if included, does so only via the raw-event log, not a dedicated telemetry model.
- **Data-model status:** None dedicated — see the CAP-003 implementation section of this report for whether raw `MeterValues` frames are captured this WO.
- **Interface-contract status:** Normalized event name reserved.
- **Implementation status:** See implementation report — evaluated, not guaranteed.
- **Dependencies:** #41 Telemetry, #16 ChargingSession (for any value tied to a specific session).
- **Decisions already approved:** none specific beyond Decision 5's general telemetry deferral.
- **Decisions still open:** whether/how to associate meter values with a session before ChargingSession exists.
- **MVP relevance:** Evaluated for the first vertical slice; not guaranteed to be included.
- **Recommended implementation phase:** Now if it can be captured via the raw-event log without inventing telemetry infrastructure; otherwise deferred alongside #41.
- **Risks if ignored:** None immediate if deferred — explicitly permitted by this work order's Phase 13 instruction.
- **Evidence source:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

### 43. Alerts

- **Business purpose:** surface operational problems (device faults, connectivity loss, etc.) to operators.
- **Domain boundary:** cross-cutting — an existing MOVOS product concept (frontend mock today), potentially fed by OCPP `StatusNotification`/`FirmwareStatusNotification`/error codes in the future.
- **Related entities:** existing mock `Alert` type (`apps/movos-web/src/types/alert.ts`); no backend relation yet.
- **Related protocols:** could be sourced from any OCPP status/error message once implemented.
- **Architectural status:** UNDEFINED for any OCPP-sourced version; the existing Alert concept is a pre-existing, unrelated mock feature (see [Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md)).
- **Data-model status:** None (backend).
- **Interface-contract status:** None.
- **Implementation status:** None (frontend mock only, pre-existing, unrelated to CAP-003).
- **Dependencies:** #30 Diagnostics, #41 Telemetry, StatusNotification handling (implemented this WO, but not yet wired to any alert concept).
- **Decisions already approved:** none.
- **Decisions still open:** whether OCPP-sourced alerts reuse the existing mock `Alert` concept or need a new model.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Post-pilot, once real device error/fault reporting exists to alert on.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md).

### 44. Incidents

- **Business purpose:** track a more formal operational incident (a sustained or escalated Alert) through resolution.
- **Domain boundary:** cross-cutting, downstream of #43 Alerts.
- **Related entities:** none yet.
- **Related protocols:** none directly.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #43 Alerts.
- **Decisions already approved:** none.
- **Decisions still open:** everything, including whether this is a distinct entity from Alert at all (a prior M001-A recovery finding noted no evidence Incident needs to be separate from Alert).
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [M001-A Ubiquitous Language — Incident](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#incident).

### 45. Maintenance

- **Business purpose:** track scheduled or reactive maintenance work on a station.
- **Domain boundary:** Device Lifecycle.
- **Related entities:** `ChargingStation`/`Site` (existing `MAINTENANCE` status value precedent on `SiteStatus`/legacy `StationStatus`).
- **Related protocols:** could relate to #19/#40 Availability control (a station under maintenance is typically marked unavailable).
- **Architectural status:** DISCOVERY — exists today only as a status _value_ (not a workflow), per prior M001-A recovery findings.
- **Data-model status:** Partial (the status value exists on unrelated pre-existing enums; no maintenance workflow/ticket/schedule model exists).
- **Interface-contract status:** None.
- **Implementation status:** None (as a workflow).
- **Dependencies:** #19/#40 Availability control.
- **Decisions already approved:** none.
- **Decisions still open:** whether a real maintenance workflow (scheduling, tickets, history) is ever in scope.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [M001-A Ubiquitous Language — Maintenance](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#maintenance).

---

## Cluster J — Fleet, Driver, Vehicle & Advanced

### 46. Fleet

- **Business purpose:** represent a commercial customer operating multiple vehicles that charge across MOVOS-managed infrastructure.
- **Domain boundary:** cross-cutting (Authorization + a future customer-relationship concept).
- **Related entities:** none yet.
- **Related protocols:** none directly.
- **Architectural status:** UNDEFINED — confirmed absent from the product's recovered vocabulary entirely (M001-A recovery: zero repository evidence, not even in roadmap prose).
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** none (a scope question, not a sequencing one).
- **Decisions already approved:** none.
- **Decisions still open:** whether Fleet is in scope for MOVOS at all — flagged by the M001-A recovery as the item with the least contextual grounding of any recovered term.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped — needs an explicit product scope decision before any sequencing question is meaningful.
- **Risks if ignored:** None immediate.
- **Evidence source:** [M001-A Ubiquitous Language — Fleet](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#fleet).

**2026-08-03 update (WO-ARGOS-016A):** `CAP-008_DEBT_OWNERSHIP.md` evaluated `Fleet` as a canonical-debt-owner candidate and rejected it — a fleet is an operational grouping (a division, a set of vehicles under common management), not itself the legal/financial party; the company that operates the fleet is who actually holds the liability, and would be represented by a `BillingAccount` (entry #25), with `Fleet` (if ever built) as a grouping _within_ that account's scope. This does **not** resolve the open product-scope question above (whether `Fleet` is in scope for MOVOS at all) — it only establishes the relationship `Fleet` would have to Billing _if_ it is ever built.

### 47. Driver

- **Business purpose:** represent the individual person operating a vehicle and initiating charging sessions.
- **Domain boundary:** Authorization / cross-cutting.
- **Related entities:** future `AuthorizationCredential` owner reference; distinct from the existing `User` (a MOVOS operator/staff account, not a driver).
- **Related protocols:** OCPP `idTag`/`idToken` ownership.
- **Architectural status:** UNDEFINED — confirmed absent as a domain entity (M001-A recovery); the "Electric Vehicle" substring appears only in product positioning prose, never as a modeled concept.
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** none directly, but #8 RFID authorization's "assignment to user, driver, or fleet" design point depends on this existing eventually.
- **Decisions already approved:** none.
- **Decisions still open:** whether Driver is in scope at all — MOVOS's positioning is explicitly about charging _infrastructure_ operators, not fleet/vehicle owners (per the M001-A recovery's own reasoning), so treating Driver as in-scope is an assumption, not a recovery.
- **MVP relevance:** Not required for the MVP; this is the exact dependency the ChargingSession Architecture flags as `[NEEDS ARGOS]` for a future authorization-reference decision.
- **Recommended implementation phase:** Not scoped — a real product-scope decision precedes any engineering sequencing.
- **Risks if ignored:** RFID/authorization architecture (#8) cannot be fully implemented (only drafted) without this being resolved.
- **Evidence source:** [M001-A Ubiquitous Language — Driver](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#driver), [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

**2026-08-03 update (WO-ARGOS-016A):** `CAP-008_DEBT_OWNERSHIP.md` evaluated `Driver` as a canonical-debt-owner candidate and rejected it — it conflates _use_ (who plugged in the car) with _financial responsibility_ (who is contractually liable), which fails for the company-car/fleet-turnover case specifically. A `Driver`, if built, would be at most one of several people authorized to use a `BillingAccount` (entry #25), never the account itself. This does **not** resolve the open product-scope question above (whether `Driver` is in scope for MOVOS at all) — it only establishes the relationship `Driver` would have to Billing _if_ it is ever built.

### 48. Vehicle

- **Business purpose:** represent the electric vehicle being charged, potentially informing charging profile/rate decisions.
- **Domain boundary:** cross-cutting.
- **Related entities:** future `ChargingSession` reference (which vehicle charged).
- **Related protocols:** ISO 15118 exposes vehicle-reported data (e.g. battery state) in Plug & Charge flows.
- **Architectural status:** UNDEFINED — confirmed absent as a domain entity (M001-A recovery).
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #47 Driver, #14 Plug & Charge / ISO 15118.
- **Decisions already approved:** none.
- **Decisions still open:** same scope question as #46/#47.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped.
- **Risks if ignored:** None immediate.
- **Evidence source:** [M001-A Ubiquitous Language — Vehicle](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#vehicle).

**2026-08-03 update (WO-ARGOS-016A):** `CAP-008_DEBT_OWNERSHIP.md` evaluated `Vehicle` as a canonical-debt-owner candidate and rejected it outright, on principle rather than practicality — a vehicle has no legal personhood, cannot enter a contract, and cannot hold a payment method. It fails specifically on resale: tying financial responsibility to the asset would mean a new owner inherits an unrelated debt relationship, or the concept dissolves the moment the asset changes hands. At most a cost-_allocation_ key once built, never a payer; the payer would be a `BillingAccount` (entry #25). Does not resolve the open product-scope question above.

### 49. ISO 15118 certificates

- **Business purpose:** the certificate chain (vehicle, station, and certificate-authority certificates) that ISO 15118 Plug & Charge requires to establish automatic, cryptographic authorization.
- **Domain boundary:** Device Lifecycle / Authorization.
- **Related entities:** #7 Certificate management, #14 Plug & Charge.
- **Related protocols:** ISO 15118, OCPP 2.0.1's certificate-management message set.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #7 Certificate management, #2 OCPP 2.0.1, #14 Plug & Charge.
- **Decisions already approved:** none.
- **Decisions still open:** everything — this is one of the most distant capabilities in the register, correctly sequenced last.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Long-term, contingent on #2 and #14 both progressing first.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

### 50. V2G / bidirectional charging

- **Business purpose:** allow a connected vehicle to discharge energy back into the site/grid (vehicle-to-grid), not just consume it.
- **Domain boundary:** Energy / Charging Operations.
- **Related entities:** `ChargingSession` (future, bidirectional), #22 Energy management.
- **Related protocols:** OCPP 2.0.1's bidirectional power extensions; ISO 15118-20.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #2 OCPP 2.0.1, #22 Energy management, #16 ChargingSession.
- **Decisions already approved:** none.
- **Decisions still open:** everything — the most forward-looking capability in the register; not evaluated for product fit yet.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Not scoped — long-term, hardware- and market-dependent.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

### 51. CAP-005: Authorization & Connectivity

- **Business purpose:** close the two gaps CAP-004's own validation gate (WO-ARGOS-009A) identified without fixing — a `ChargingSession` accurately reflecting real device connectivity, and RFID moving from generic-credential-only to its designed-in-depth behavior actually working.
- **Domain boundary:** the seam between the Transport Layer (`ConnectionRegistryService`, CAP-003) and Charging Operations (`SessionLifecycleService`, CAP-004); Authorization (RFID specifically).
- **Related entities:** `ChargingSession.status` (`OFFLINE`/`SUSPENDED` transitions), `AuthorizationCredential` (type `RFID`).
- **Related protocols:** none new — reuses CAP-003's existing connection-loss signal and CAP-004's existing `Authorize`/idTag handling.
- **Architectural status:** ARCHITECTURE DRAFTED — `DEC-017` (offline policy) provides the trigger-condition analysis; RFID-specific behavior was already designed in depth by the CAP-003-era Authorization Architecture, just never implemented.
- **Data-model status:** None required — no new model. `ChargingSession.status`/`AuthorizationCredential` already have the fields this needs.
- **Interface-contract status:** Partial — `SessionLifecycleService.suspendSession(id, 'OFFLINE')` and `resumeSession(id)` already exist and are correct; `ConnectionRegistryService` already emits connection-loss information, just not to any subscriber.
- **Implementation status:** None. `suspendSession(id, 'OFFLINE')` has never been called by any code path other than a direct test call — confirmed by code search during WO-ARGOS-009A, zero cross-references between the two services in either direction.
- **Dependencies:** #16 ChargingSession (done — CAP-004), #6 Device authentication/connection registry (done — CAP-003), #8 RFID authorization (generic credential infrastructure done — CAP-004; RFID-specific behavior itself is this entry's second half).
- **Decisions already approved:** DEC-017 is a recommendation, not yet an ARGOS-approved decision — this entry exists so the recommendation isn't lost, not because it's authorized to build.
- **Decisions still open:** whether ARGOS approves DEC-017's specific recommendation (Option B, coordinated with the existing stale-sweep) as-is, or amends it; sequencing between the connectivity half and the RFID half (they don't depend on each other and could ship separately).
- **MVP relevance:** Not required for CAP-004's own scope; a real gap for any operator relying on `ChargingSession.status` to reflect actual device connectivity in production.
- **Recommended implementation phase:** Next capability after CAP-004 — both halves build directly on infrastructure that already exists (CAP-003's connection registry, CAP-004's session lifecycle and generic credentials), no new foundational work required first.
- **Risks if ignored:** A session can show `ACTIVE` indefinitely after its underlying connection is verifiably gone, with no automatic correction — directly affects any dashboard, alerting, or billing logic that trusts session status as a proxy for "is this station actually charging right now."
- **Evidence source:** [DEC-017 Offline Policy](../domain/DEC-017_OFFLINE_POLICY.md), [MOVOS Authorization Architecture — RFID section](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md#rfid--designed-in-depth), [CAP-004 Post-Mortem](../postmortems/CAP-004_POST_MORTEM.md).

**2026-08-02 update (WO-ARGOS-010):** the two halves of this entry shipped separately, as this entry itself already anticipated ("the connectivity half and the RFID half ... could ship separately"). **The connectivity half is now IMPLEMENTED** — DEC-017 was approved (RECOMMENDATION → ACCEPTED, Option B/3× heartbeat interval, coordinated with the existing stale-sweep, not an independent timer) and built as CAP-005, real-boot/real-Postgres/real-WebSocket validated. `SessionLifecycleService.suspendSession(id, 'OFFLINE')` is now called by production code (`ConnectivityCoordinator`) for the first time — the "never called by any code path other than a direct test call" line above is no longer true for the connectivity half. **The RFID half remains exactly as drafted, untouched** — WO-ARGOS-010's scope was explicitly connectivity-only ("do not begin RFID ... functional work"). See [CAP-005 Connectivity Engine](../domain/CAP-005_CONNECTIVITY_ENGINE.md) for the implemented half; this entry stays open for the RFID half alone. A known limitation from the connectivity implementation: a _clean_ (non-stale) disconnect still does not move a session to `OFFLINE` — see CAP-005 §4.

### 52. CAP-009: BillingAccount & TariffSnapshot Foundation

- **Business purpose:** implement the billing domain CAP-008 architected — the schema, migrations, and services for `BillingAccount` (the canonical debt owner) and `TariffSnapshot` (the tariff-timing mechanism), so a `ChargingSession` can finally be priced and attributed to a payer.
- **Domain boundary:** Commercial — the implementation half of entries #24 (Tariffs) and #25 (Billing).
- **Related entities:** new `BillingAccount`, `TariffSnapshot` models; references `Organization` (tenant scope, per DEC-022 precedent) and `ChargingSession`/`AuthorizationCredential` (existing).
- **Related protocols:** none directly.
- **Architectural status:** ARCHITECTURE APPROVED — the domain model, ownership, tariff-timing semantics, and canonical debt owner are all decided by CAP-008 ([CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md), [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md), [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md)). No schema, migration, or contract has been drafted yet — this entry is registered, not started.
- **Data-model status:** None. `BillingAccount`'s fields, its relationship to `AuthorizationCredential` (an `ownerRef`-style link, redirected from the never-built CAP-004-era concept toward this entity), and whether it needs its own status/lifecycle are all undesigned.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession (done — CAP-004), #24 Tariffs (architecture approved — CAP-008), #25 Billing (architecture approved — CAP-008).
- **Decisions already approved:** canonical debt owner = `BillingAccount`, scoped to exactly one `Organization` (never spanning tenants, per DEC-022); tariff timing = snapshot-on-boundary, degenerating to a single snapshot when no boundary is crossed.
- **Decisions still open:** `BillingAccount`'s exact schema; the snapshot-triggering rule; the energy-attribution rule for sparse-telemetry sessions; which clock governs pricing; how an ephemeral/one-off `BillingAccount` (the shopping-mall walk-up case) differs structurally from a durable one; how `Fleet` (if ever built) groups within a `BillingAccount`'s scope. All named explicitly in `CAP-008_DECISION.md`/`CAP-008_DEBT_OWNERSHIP.md`'s own "what this does not resolve" sections — this entry does not need to rediscover them.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** Next capability — explicitly authorized scope is `BillingAccount`/`TariffSnapshot` foundation only. **Do not implement invoices, payments, taxes, discounts, accounting, Stripe, or UI as part of this entry** — those remain entries #26/#27 and beyond, UNDEFINED, unblocked only once this entry ships. Do not begin RFID (#8's remaining half, tracked under #51), Smart Charging (#20), or OCPP 2.0.1 (#2) as part of this entry either — explicitly out of scope per the same authorization that registered this entry.
- **Risks if ignored:** None immediate — Billing remains a documented-but-unbuilt capability, exactly as it has been since CAP-003.
- **Evidence source:** [CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md), [CAP-008_BILLING_THREAT_MODEL.md](../reviews/CAP-008_BILLING_THREAT_MODEL.md), [CAP-008_SCENARIOS.md](../reviews/CAP-008_SCENARIOS.md), [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md), [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md), [CAP-008 Post-Mortem](../postmortems/CAP-008_POST_MORTEM.md).

---

## Summary by architectural status

| Status                | Count | Capabilities                                                                        |
| --------------------- | ----- | ----------------------------------------------------------------------------------- |
| ARCHITECTURE APPROVED | 11    | #1, #2, #3, #5, #6, #16, #17, #24, #25, #35, #52                                    |
| ARCHITECTURE DRAFTED  | 12    | #4, #8, #15, #32, #33, #34, #36, #37, #38, #39, #42, #51                            |
| DISCOVERY             | 12    | #7, #9, #10, #11, #12, #19, #20, #29, #30, #40, #43, #45                            |
| UNDEFINED             | 17    | #13, #14, #18, #21, #22, #23, #26, #27, #28, #31, #41, #44, #46, #47, #48, #49, #50 |

Total: 52 capabilities registered (50 from the original WO-ARGOS-007 register, #51 CAP-005: Authorization & Connectivity opened 2026-08-01 by WO-ARGOS-009A, and #52 CAP-009: BillingAccount & TariffSnapshot Foundation opened 2026-08-03 by WO-ARGOS-016A as the registered next capability following CAP-008's architecture-complete billing foundation). This table is a navigation aid — see each individual entry for its precise status and reasoning.

Nothing in this register is implemented merely by appearing here. See the CAP-003 (WO-ARGOS-007/008) final reports for exactly what shipped in that vertical slice: BootNotification, Heartbeat, StatusNotification, and the protocol/identity/authentication foundation, `SIMULATOR_VALIDATED`. See the CAP-004 (WO-ARGOS-009) final report for what shipped on top of it: `ChargingSession`/`AuthorizationCredential`/`AuthorizationAttempt`/`MeterValue` models, a validated session-lifecycle state machine, and `Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction` handling for 1.6J — unit-tested only, not yet runtime-validated. Entries #8, #16, and #17 above reflect this CAP-004 progress at the field level (Data-model/Interface-contract/Implementation status); their top-level Architectural status is unchanged, so the table above still counts them correctly.
