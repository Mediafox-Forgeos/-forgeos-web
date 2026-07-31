# MOVOS Architecture Backlog v1.0

**Generated:** 2026-07-30 (WO-ARGOS-007)
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
- **Data-model status:** Conceptual only — no Prisma model.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession, #15 Local Authorization List, #47 Driver.
- **Decisions already approved:** none yet — architecture drafted, not approved.
- **Decisions still open:** whether RFID is the first authorization method implemented after CAP-003's boot vertical; secure-storage mechanism for card identifiers.
- **MVP relevance:** Not required for the first vertical slice (BootNotification/Heartbeat/StatusNotification only).
- **Recommended implementation phase:** First authorization method to build once ChargingSession is real — the most likely next capability after CAP-003's initial slice.
- **Risks if ignored:** None immediate; architecture is captured so it isn't reinvented later.
- **Evidence source:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

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
- **Data-model status:** None — explicitly not modeled in this work order.
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #17 OCPP transaction mapping, #8 RFID authorization (or another auth method) for a non-optional authorization reference.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 7; ADR-0012.
- **Decisions still open:** authorization/idTag identity dependency (no driver/vehicle identity concept exists yet — see #47/#48).
- **MVP relevance:** Not required for the first vertical slice; required for the next one (any real transaction handling).
- **Recommended implementation phase:** Immediately after CAP-003's boot vertical, before Authorize/StartTransaction/StopTransaction can be handled.
- **Risks if ignored:** `StartTransaction`/`StopTransaction` messages would have nowhere durable to write.
- **Evidence source:** [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), ADR-0012.

### 17. OCPP transaction mapping

- **Business purpose:** define precisely how a protocol-level transaction relates to a MOVOS `ChargingSession`.
- **Domain boundary:** the seam between Protocol Layer and Charging Operations.
- **Related entities:** `ChargingSession` (future), protocol-event log.
- **Related protocols:** OCPP 1.6J `transactionId`; OCPP 2.0.1 `transactionInfo`.
- **Architectural status:** ARCHITECTURE APPROVED — documented in both the ChargingSession Architecture and the Protocol Coexistence doc.
- **Data-model status:** None (depends on #16).
- **Interface-contract status:** Conceptual only.
- **Implementation status:** None.
- **Dependencies:** #16 ChargingSession.
- **Decisions already approved:** CAP-003 Architecture Decisions — Decision 7 (transaction vs. session distinction).
- **Decisions still open:** none beyond what #16 leaves open.
- **MVP relevance:** Not required for the first vertical slice.
- **Recommended implementation phase:** Same phase as #16.
- **Risks if ignored:** Conflating a protocol transaction with a business session, breaking reconnect-spanning semantics ARGOS already approved.
- **Evidence source:** [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

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
- **Related entities:** future `Tariff`, `Site`, `ChargingSession`.
- **Related protocols:** none directly; OCPP 1.6J has a limited `Local Auth List`/pricing display extension, OCPP 2.0.1 has native tariff messages, neither in scope.
- **Architectural status:** DISCOVERY — a mock frontend `Tariff` type already exists (`apps/movos-web/src/types/tariff.ts`, per the M001-A domain recovery), reflecting real prior design thinking, but disconnected from any backend.
- **Data-model status:** None on the backend.
- **Interface-contract status:** None.
- **Implementation status:** None (frontend mock only).
- **Dependencies:** #16 ChargingSession, #25 Billing.
- **Decisions already approved:** none.
- **Decisions still open:** everything — explicitly deferred per CAP-003 Decision 7's "belongs to later Tariff/Billing capabilities" note.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After ChargingSession is real.
- **Risks if ignored:** None immediate.
- **Evidence source:** [CAP-003 Architecture Decisions — Decision 7](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary), [MOVOS Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md).

### 25. Billing

- **Business purpose:** convert a completed, tariff-priced session into an invoice or statement.
- **Domain boundary:** Commercial.
- **Related entities:** future `Invoice`/billing record, `ChargingSession`, `Tariff`.
- **Related protocols:** none.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #24 Tariffs, #16 ChargingSession.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After Tariffs.
- **Risks if ignored:** None immediate.
- **Evidence source:** [MOVOS Feature Matrix](../product/MOVOS_FEATURE_MATRIX_v1.0.md) (named as a mock/planned capability elsewhere in the product).

### 26. Payments

- **Business purpose:** process the actual monetary transaction for a billed session.
- **Domain boundary:** Commercial.
- **Related entities:** future payment record, `Invoice`/billing record.
- **Related protocols:** none; a payment-provider integration concern.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #25 Billing.
- **Decisions already approved:** none.
- **Decisions still open:** everything, including PSP selection.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After Billing.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

### 27. Refunds

- **Business purpose:** reverse a payment for a disputed or failed session.
- **Domain boundary:** Commercial.
- **Related entities:** future refund record, payment record.
- **Related protocols:** none.
- **Architectural status:** UNDEFINED
- **Data-model status:** None.
- **Interface-contract status:** None.
- **Implementation status:** None.
- **Dependencies:** #26 Payments.
- **Decisions already approved:** none.
- **Decisions still open:** everything.
- **MVP relevance:** Not required for the MVP.
- **Recommended implementation phase:** After Payments.
- **Risks if ignored:** None immediate.
- **Evidence source:** none prior — first captured here.

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

---

## Summary by architectural status

| Status                | Count | Capabilities                                                                             |
| --------------------- | ----- | ---------------------------------------------------------------------------------------- |
| ARCHITECTURE APPROVED | 8     | #1, #2, #3, #5, #6, #16, #17, #35                                                        |
| ARCHITECTURE DRAFTED  | 11    | #4, #8, #15, #32, #33, #34, #36, #37, #38, #39, #42                                      |
| DISCOVERY             | 13    | #7, #9, #10, #11, #12, #19, #20, #24, #29, #30, #40, #43, #45                            |
| UNDEFINED             | 18    | #13, #14, #18, #21, #22, #23, #25, #26, #27, #28, #31, #41, #44, #46, #47, #48, #49, #50 |

Total: 50 capabilities registered. This table is a navigation aid — see each individual entry for its precise status and reasoning.

Nothing in this register is implemented merely by appearing here. See [CAP-003 implementation report] (this work order's final report) for exactly what shipped in this vertical slice: BootNotification, Heartbeat, StatusNotification, and the protocol/identity/authentication foundation only.
