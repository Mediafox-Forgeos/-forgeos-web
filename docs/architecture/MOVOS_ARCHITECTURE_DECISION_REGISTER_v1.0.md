# MOVOS Architecture Decision Register v1.0

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Purpose:** the single formal register of every architecture-level decision touching the MOVOS charging ecosystem — so no important decision survives only inside a work-order report. Complements, and cross-references, the [ADR index](../adr/README.md) (which holds the full narrative for decisions formalized as ADRs) and the [Architecture Backlog](./MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (which tracks capabilities, not decisions).

## Register

| Decision ID                                       | Title                            | Status   | Owner                  | Implementation phase                                 | Review trigger                                                                          |
| ------------------------------------------------- | -------------------------------- | -------- | ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [AD-001](#ad-001-ocpp-16j-initial-implementation) | OCPP 1.6J initial implementation | APPROVED | ARGOS                  | Now (CAP-003)                                        | Kylum hardware information request answered                                             |
| [AD-002](#ad-002-ocpp-201-architectural-support)  | OCPP 2.0.1 architectural support | APPROVED | ARGOS                  | Boundary now (CAP-003); concrete adapter deferred    | Kylum hardware confirms 2.0.1-only fleet, or a roaming/Plug-and-Charge product decision |
| [AD-003](#ad-003-protocol-adapter-boundary)       | Protocol adapter boundary        | APPROVED | ARGOS                  | Now (CAP-003)                                        | A third protocol version or a vendor-extension need materializes                        |
| [AD-004](#ad-004-authorization-abstraction)       | Authorization abstraction        | DRAFTED  | VULCAN (pending ARGOS) | After CAP-003's boot vertical                        | RFID (or any credential type) implementation is scheduled                               |
| [AD-005](#ad-005-rfid-model)                      | RFID model                       | DRAFTED  | VULCAN (pending ARGOS) | After AD-004 is approved                             | RFID implementation is scheduled                                                        |
| [AD-006](#ad-006-chargingsession-boundary)        | ChargingSession boundary         | APPROVED | ARGOS                  | Immediately after CAP-003's boot vertical            | Authorize/StartTransaction/StopTransaction handling is scheduled                        |
| [AD-007](#ad-007-vendor-profile-boundary)         | Vendor-profile boundary          | DRAFTED  | VULCAN (pending ARGOS) | After Kylum hardware information request is answered | Real vendor data becomes available                                                      |
| [AD-008](#ad-008-smart-charging-boundary)         | Smart Charging boundary          | UNSCOPED | Unassigned             | Not scoped                                           | Energy-management product decision                                                      |
| [AD-009](#ad-009-certificate-management-boundary) | Certificate-management boundary  | UNSCOPED | Unassigned             | After mutual TLS is prioritized                      | Hardware confirms mTLS support, or fleet size justifies PKI cost                        |
| [AD-010](#ad-010-ocpi-and-roaming-boundary)       | OCPI and roaming boundary        | UNSCOPED | Unassigned             | Not scoped                                           | A roaming-partnership product decision                                                  |
| [AD-011](#ad-011-v2g-future-boundary)             | V2G future boundary              | UNSCOPED | Unassigned             | Not scoped                                           | Hardware/market signal for bidirectional charging demand                                |

**Status vocabulary:** `UNSCOPED` (named, no design work at all) → `DRAFTED` (VULCAN has proposed an architecture, ARGOS has not ruled) → `APPROVED` (ARGOS has ruled) → `SUPERSEDED` (a later decision replaces this one — none yet).

---

## AD-001: OCPP 1.6J initial implementation

- **Status:** APPROVED (WO-ARGOS-007)
- **Owner:** ARGOS
- **Rationale:** OCPP 1.6J is, by general industry prevalence, the most commonly deployed version in existing charger fleets; building it first, behind a protocol-agnostic boundary (AD-003), minimizes time-to-production risk for the pilot while keeping a real second-protocol path open.
- **Options considered:** 1.6J only (no abstraction); 2.0.1 only; both from the start; adapter-based abstraction with 1.6J as the first concrete implementation (chosen).
- **Consequence:** protocol implementation could begin without hardware confirmation blocking the _boundary_ work, but the _concrete_ adapter choice remains contingent on the Kylum hardware information request.
- **Implementation phase:** Now — this is what CAP-003 (this work order) implements for BootNotification/Heartbeat/StatusNotification.
- **Review trigger:** if the Kylum hardware information request reveals a 2.0.1-only fleet, this decision's _concrete adapter_ choice (not the boundary) is revisited.
- **Related:** ADR-0008, [CAP-003 Architecture Decisions — Decision 3](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope).

## AD-002: OCPP 2.0.1 architectural support

- **Status:** APPROVED (WO-ARGOS-007) — approved with expanded scope beyond VULCAN's original recommendation.
- **Owner:** ARGOS
- **Rationale:** ARGOS explicitly rejected treating 2.0.1 as an undefined future idea — its boundary, capability mapping, and message families must be designed now (not merely implied by the adapter interface shape), even though no message is functionally implemented.
- **Options considered:** treat 2.0.1 as a vague future placeholder (rejected by ARGOS); design the full boundary and message-family mapping now without implementing messages (chosen).
- **Consequence:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md) exists as a real design document; the CAP-003 implementation includes a 2.0.1 protocol-detection stub that fails every message explicitly (never a silent accept).
- **Implementation phase:** Boundary/detection now (CAP-003); concrete message implementation deferred, contingent on hardware.
- **Review trigger:** Kylum hardware information request confirms 2.0.1 hardware in the fleet, or a Plug & Charge/roaming product decision requires 2.0.1's richer feature set.
- **Related:** ADR-0008 (updated), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

## AD-003: Protocol adapter boundary

- **Status:** APPROVED (WO-ARGOS-007)
- **Owner:** ARGOS
- **Rationale:** the domain must never depend on a specific OCPP version's DTOs — a normalized event/command vocabulary is the only thing domain handlers ever see.
- **Options considered:** direct protocol-DTO usage in domain handlers (rejected); a thin translation layer without a formal contract (rejected — too easy to erode over time); a fully-specified `ProtocolAdapter` interface with a normalized vocabulary (chosen).
- **Consequence:** every future protocol (a 2.x point release, a vendor extension, a simulator) implements the same interface; the domain layer is insulated from all of them.
- **Implementation phase:** Now (CAP-003) — the boundary and the 1.6J concrete adapter.
- **Review trigger:** a third protocol version, or a vendor-extension need with no existing registration mechanism.
- **Related:** ADR-0009, [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md).

## AD-004: Authorization abstraction

- **Status:** DRAFTED — architecture proposed (this work order), not yet put to ARGOS for a standalone ruling (it rides alongside AD-005/AD-006 conceptually but was not itself named in the CAP-003 decision package's seven decisions).
- **Owner:** VULCAN (pending ARGOS)
- **Rationale:** seven-plus authorization methods (RFID, QR, App, Remote, API, Fleet, Plug & Charge) need one canonical abstraction (`AuthorizationCredential`) rather than seven parallel, drifting implementations.
- **Options considered:** a separate table/flow per credential type (rejected — duplication, drift risk); one polymorphic `AuthorizationCredential` concept with a `type` discriminator (chosen).
- **Consequence:** any future credential type is an addition to an existing enum and shape, not a new subsystem.
- **Implementation phase:** After CAP-003's boot vertical, when RFID (the first credential type slated for real implementation) is scheduled.
- **Review trigger:** RFID (or any other credential type) implementation is scheduled — this decision should be formally ratified (or revised) at that point, not assumed still valid by default.
- **Related:** [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md).

## AD-005: RFID model

- **Status:** DRAFTED
- **Owner:** VULCAN (pending ARGOS)
- **Rationale:** RFID is the most likely first real authorization method (simplest hardware story, most common in existing pilot fleets), so it was designed in depth per this work order's explicit Phase 6 requirement.
- **Options considered:** minimal RFID support (UID only, no lifecycle) — rejected as insufficient for a real pilot (no revocation/replacement story); full lifecycle design (identifier normalization, status, validity, assignment, revocation, replacement, local-list sync, offline behavior) — chosen.
- **Consequence:** RFID's eventual implementation has a complete reference design rather than needing discovery work at implementation time.
- **Implementation phase:** After AD-004 is ratified.
- **Review trigger:** RFID implementation is scheduled.
- **Related:** [Authorization Architecture — RFID section](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md#rfid--designed-in-depth).

## AD-006: ChargingSession boundary

- **Status:** APPROVED (WO-ARGOS-007) — approved with a material refinement (reconnect-spanning tied to transaction continuity) over VULCAN's original "no" recommendation.
- **Owner:** ARGOS
- **Rationale:** a `ChargingSession` must be conceptually distinct from a WebSocket connection, a raw OCPP transaction, an authorization attempt, a payment, and a billing record — conflating any of these breaks reconnect handling, billing separation, or both.
- **Options considered:** treat connection lifetime as session lifetime (rejected — breaks on any network blip); treat OCPP transaction as the session record directly (rejected — no home for MOVOS-level business concerns); a separate `ChargingSession` referencing a protocol transaction ID, with reconnect-spanning gated on transaction continuity (chosen, ARGOS-refined).
- **Consequence:** a dropped-and-restored WebSocket connection does not spuriously end an active session, provided the device continues the same transaction; a genuinely new transaction after reconnect correctly starts a new session.
- **Implementation phase:** Immediately after CAP-003's boot vertical — the next real capability.
- **Review trigger:** `Authorize`/`StartTransaction`/`StopTransaction` handling is scheduled for implementation.
- **Related:** ADR-0012, [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md).

## AD-007: Vendor-profile boundary

- **Status:** DRAFTED
- **Owner:** VULCAN (pending ARGOS)
- **Rationale:** manufacturer-specific behavior must never leak into the OCPP protocol core as conditional logic — a `Vendor → DeviceModel → FirmwareVersion → CapabilityProfile` tree gives it a structured home instead.
- **Options considered:** manufacturer conditionals inline in protocol handlers (explicitly rejected by this work order); a capability-profile lookup tree (chosen).
- **Consequence:** adding support for a new vendor/model/firmware is a data addition, not a protocol-core code change.
- **Implementation phase:** After the Kylum hardware information request is answered — populating this tree before real vendor data exists would mean inventing hardware facts.
- **Review trigger:** Kylum hardware information request answered; or a second pilot customer with different hardware is onboarded.
- **Related:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md).

## AD-008: Smart Charging boundary

- **Status:** UNSCOPED
- **Owner:** Unassigned
- **Rationale:** not yet analyzed — Smart Charging (dynamic power-limit profiles) is named in the ecosystem architecture's Energy area but has received no design work, per this work order's own scope limits.
- **Options considered:** none evaluated yet.
- **Consequence:** none — correctly deferred, no immediate risk.
- **Implementation phase:** Not scoped.
- **Review trigger:** an Energy-management product decision (Smart Charging, Load Balancing, or Demand Response prioritized).
- **Related:** [MOVOS Charging Ecosystem Architecture — §5 Energy](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#5-energy), Architecture Backlog #20.

## AD-009: Certificate-management boundary

- **Status:** UNSCOPED
- **Owner:** Unassigned
- **Rationale:** named as the future upgrade path for device authentication (AD's sibling — CAP-003 Decision 2 / ADR-0010's "future stronger mechanism") and for ISO 15118, but no issuance/rotation/revocation/PKI-ownership design exists.
- **Options considered:** none evaluated yet (MOVOS-operated CA vs. managed PKI service vs. vendor-issued certificates — all unexamined).
- **Consequence:** none — correctly deferred; the MVP authentication mechanism (Basic Auth, AD-approved via CAP-003 Decision 2) does not depend on this.
- **Implementation phase:** After mutual TLS is prioritized.
- **Review trigger:** Kylum hardware confirms mTLS/certificate support, or pilot fleet size grows enough to justify PKI operational cost.
- **Related:** ADR-0010, [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), Architecture Backlog #7.

## AD-010: OCPI and roaming boundary

- **Status:** UNSCOPED
- **Owner:** Unassigned
- **Rationale:** roaming (letting other networks' drivers use MOVOS stations, and vice versa) is a strategic product question, not yet an engineering one — no design work exists.
- **Options considered:** none evaluated.
- **Consequence:** none — correctly deferred.
- **Implementation phase:** Not scoped.
- **Review trigger:** a roaming-partnership business decision.
- **Related:** [MOVOS Charging Ecosystem Architecture — §6 Commercial](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#6-commercial), Architecture Backlog #28.

## AD-011: V2G future boundary

- **Status:** UNSCOPED
- **Owner:** Unassigned
- **Rationale:** bidirectional (vehicle-to-grid) charging is the most forward-looking capability in the entire register — no product-fit evaluation has been done, let alone architecture.
- **Options considered:** none evaluated.
- **Consequence:** none — correctly deferred.
- **Implementation phase:** Not scoped.
- **Review trigger:** a hardware or market signal for V2G demand.
- **Related:** [MOVOS Charging Ecosystem Architecture — §5 Energy](../architecture/MOVOS_CHARGING_ECOSYSTEM_ARCHITECTURE_v0.1.md#5-energy), Architecture Backlog #50.
