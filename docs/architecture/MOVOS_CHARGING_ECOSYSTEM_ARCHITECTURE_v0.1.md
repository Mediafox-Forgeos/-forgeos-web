# MOVOS Charging Ecosystem Architecture v0.1

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Companion documents:** [Architecture Backlog](./MOVOS_ARCHITECTURE_BACKLOG_v1.0.md), [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md), [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md), [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), [CAP-003 Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md)

This document is the top-level conceptual map of the full MOVOS charging ecosystem — where every future capability belongs, before any of it is built. It exists so that CAP-003's necessarily narrow first vertical slice doesn't get mistaken for the whole system, and so nobody has to reconstruct "where would X go" from scratch in a future mission. It does not implement anything; implementation status for each area is stated explicitly and is deliberately mostly "not yet."

## The tree

```
MOVOS Domain
├── Charging Infrastructure   (§1)
│   ├── Site
│   ├── ChargingStation
│   ├── EVSE
│   └── Connector
│
├── Protocol Layer            (§2)
│   ├── OCPP 1.6J Adapter
│   ├── OCPP 2.0.1 Adapter
│   ├── Vendor Extension Adapter
│   └── Simulator Adapter
│
├── Authorization              (§3)
│   ├── RFID
│   ├── QR
│   ├── App
│   ├── Remote
│   ├── API
│   ├── Fleet
│   └── Plug & Charge
│
├── Charging Operations        (§4)
│   ├── ChargingSession
│   ├── Reservation
│   ├── Remote Start
│   ├── Remote Stop
│   └── Availability Control
│
├── Energy                     (§5)
│   ├── Meter Values
│   ├── Smart Charging
│   ├── Load Balancing
│   ├── Energy Management
│   └── V2G
│
├── Commercial                 (§6)
│   ├── Tariff
│   ├── Billing
│   ├── Payment
│   ├── Refund
│   └── Roaming
│
└── Device Lifecycle           (§7)
    ├── Provisioning
    ├── Firmware
    ├── Diagnostics
    ├── Certificates
    ├── Maintenance
    └── Vendor Profiles
```

---

## §1 Charging Infrastructure

**Purpose:** the physical/organizational hierarchy every other area attaches to. Answers "what exists and who owns it," never "what is it doing right now."

**Canonical concepts:** `Site` (a physical location, org-scoped), `ChargingStation` (the physical device installed at a Site), `Evse` (an independently operable supply unit within a station), `Connector` (the physical interface a vehicle plugs into). Approved hierarchy: `Organization → Site → ChargingStation → EVSE → Connector` (M001-A-DEC-005).

**Boundaries:** owns identity and administrative/structural state only (name, code, manufacturer, commissioning status). Does not own live operational state beyond a last-known-value cache (see §2/§4 for who writes that). Does not own commercial or authorization data.

**Dependencies:** none upward — this is the foundation everything else references.

**Data ownership:** `apps/movos-api/prisma/schema.prisma` — `Site`, `ChargingStation`, `Evse`, `Connector` models (CAP-002, already implemented).

**Protocol relationships:** `ChargingStation.ocppIdentity` (this work order) is the join point to the Protocol Layer — the value a WebSocket connection authenticates against. `Evse.externalId`/`Connector.externalId` are the equivalent join points at their tiers.

**Current implementation state:** IMPLEMENTED — full CRUD (CAP-002), connected frontend (WO-ARGOS-004/005), tenant-isolated, audited. This is the only area of the whole ecosystem tree that is genuinely production-grade today.

**Future implementation state:** stable as the foundation; changes here should be rare and carefully migrated, since every other area depends on it.

**Risks of coupling:** the biggest risk is already-mitigated by CAP-002's own conventions (no denormalized `organizationId` on child entities, ownership resolved through the parent chain) — but any future area that's tempted to shortcut that chain (e.g., a Telemetry table caching `organizationId` directly "for query speed") reintroduces exactly the risk CAP-002 avoided. Don't do that.

**Explicit non-goals for CAP-003:** no new fields on `Site`; the only Charging Infrastructure change in CAP-003 is `ChargingStation.ocppIdentity` and its authentication-secret storage (§2/§7 territory, landing on this model).

---

## §2 Protocol Layer

**Purpose:** speak whatever wire protocol a physical device speaks, and translate it into something the rest of MOVOS never has to know the wire format of.

**Canonical concepts:** a protocol **adapter** (one per wire version — 1.6J, 2.0.1, future versions, a vendor-extension layer, and a simulator adapter for testing), a **normalized inbound event** (protocol-agnostic representation of "what the device just told us"), a **normalized outbound command** (protocol-agnostic representation of "what MOVOS wants the device to do"), and a **raw protocol-event log** (append-only capture of the actual wire messages, for audit/debugging).

**Boundaries:** this is the _only_ place OCPP-version-specific code is allowed to exist. Nothing outside this layer may import or depend on an OCPP 1.6J or 2.0.1 DTO. See [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md) for the full contract design.

**Dependencies:** §1 Charging Infrastructure (resolves `ocppIdentity` → `ChargingStation`); §7 Device Lifecycle (authentication).

**Data ownership:** the raw protocol-event log (this work order); no other persisted state — the adapters themselves are stateless translators, and connection state lives in an in-memory registry (§2 implementation detail, not a database concern).

**Protocol relationships:** this entire area _is_ the protocol relationship layer for the rest of the system.

**Current implementation state:** PARTIALLY IMPLEMENTED (this work order) — the adapter boundary, the OCPP 1.6J concrete adapter for BootNotification/Heartbeat/StatusNotification, and the OCPP 2.0.1 detection-and-explicit-rejection stub. See the CAP-003 implementation report for the exact scope.

**Future implementation state:** a full 1.6J message catalogue, a functional 2.0.1 adapter (contingent on hardware confirmation), a vendor-extension registration mechanism.

**Risks of coupling:** the single largest architectural risk in the entire ecosystem. If domain handlers (§4 Charging Operations, especially) ever receive a raw OCPP DTO instead of a normalized event, every future protocol change becomes a domain-layer rewrite — the exact failure this layer exists to prevent.

**Explicit non-goals for CAP-003:** no OCPP 2.0.1 message is functionally implemented; no vendor-extension mechanism is built; no full 1.6J message catalogue (Authorize, StartTransaction, StopTransaction, remote commands) is implemented — only the boot/status vertical.

---

## §3 Authorization

**Purpose:** decide whether a given credential (card, app, QR, API caller, fleet account, or an automatic vehicle handshake) is allowed to start a session, and record that decision.

**Canonical concepts:** `AuthorizationCredential` (the canonical concept per this work order's Phase 6 requirement), `AuthorizationAttempt`, `AuthorizationDecision`. Seven credential types named: RFID, QR, App, Remote, API, Fleet, Plug & Charge (plus Guest and LocalList per the detailed design). See [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md) for the full conceptual design, with RFID designed in depth as required.

**Boundaries:** decides _whether_ a session may start; does not itself start one (that's §4's `ChargingSession`/Remote Start). Does not own driver/vehicle/fleet identity (those are undefined dependencies — see Architecture Backlog #46–48).

**Dependencies:** §4 Charging Operations (`ChargingSession` is what gets authorized); a future Driver/Vehicle/Fleet identity concept (undefined — Architecture Backlog #46–48); §2 Protocol Layer (`idTag`/`idToken` mapping).

**Data ownership:** none yet — entirely conceptual (`ARCHITECTURE DRAFTED` for RFID/Local List, `DISCOVERY` or less for the rest — see Architecture Backlog Cluster C).

**Protocol relationships:** OCPP 1.6J `idTag` (a bare string); OCPP 2.0.1 `idToken` (a typed, richer structure) — both map onto the same `AuthorizationCredential` concept, with the physical card identifier kept explicitly distinct from the MOVOS credential's own ID (never using the card's raw identifier as a primary key, matching the same discipline CAP-002 established for `externalId` fields).

**Current implementation state:** ARCHITECTURE DRAFTED only. Nothing implemented.

**Future implementation state:** RFID first (most likely next capability after CAP-003's boot vertical), then App/QR, with API/Fleet/Plug & Charge materially later.

**Risks of coupling:** conflating the physical credential identifier (a card's printed/encoded ID) with MOVOS's internal credential record risks the same class of problem CAP-002 avoided by keeping `externalId` distinct from `id` everywhere else in the domain.

**Explicit non-goals for CAP-003:** no `AuthorizationCredential` model, no RFID implementation, no `Authorize` OCPP message handling — architecture only.

---

## §4 Charging Operations

**Purpose:** the durable business record of what actually happened during a charging event, and the commands that control it in real time.

**Canonical concepts:** `ChargingSession` (the business-domain session — explicitly not a WebSocket connection, a raw OCPP transaction, an authorization attempt, a payment, or a billing record), `Reservation`, Remote Start/Stop, Availability Control. See [ChargingSession Architecture](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md) for the full design.

**Boundaries:** owns the session lifecycle and its relationship to the ownership chain (`Connector → Evse → ChargingStation → Site → Organization`), start/stop timestamps, terminal energy value, and status. Does not own tariff/billing/payment calculation (§6) — only references it. Does not own protocol-level transaction bookkeeping directly (§2 owns the raw event; §4 owns the business interpretation of it).

**Dependencies:** §1 (ownership chain), §2 (transaction events arrive as normalized events, not raw DTOs), §3 (an authorization reference, optional in the first implementation).

**Data ownership:** none yet — `ChargingSession` is approved conceptually (CAP-003 Decision 7, ADR-0012) but explicitly not modeled by this work order.

**Protocol relationships:** OCPP 1.6J `StartTransaction`/`StopTransaction` (`transactionId`); OCPP 2.0.1's transaction-event model. A MOVOS session may survive a WebSocket reconnect specifically when the device continues the same underlying transaction (ARGOS-approved refinement, WO-ARGOS-007) — session continuity is tied to transaction continuity, not connection continuity.

**Current implementation state:** ARCHITECTURE APPROVED, not implemented. This work order's vertical slice (Boot/Heartbeat/Status) does not touch this area at all — there is no session to create yet.

**Future implementation state:** the next capability after CAP-003's boot vertical — `Authorize`/`StartTransaction`/`StopTransaction` handling has nowhere to write without this existing first.

**Risks of coupling:** treating a WebSocket connection's lifetime as the session's lifetime would break the ARGOS-approved reconnect-spanning behavior; treating an OCPP transaction ID as the session's primary key would break the "session may span reconnects, transaction may not" distinction.

**Explicit non-goals for CAP-003:** no `ChargingSession` Prisma model, no `Authorize`/`StartTransaction`/`StopTransaction` handling, no Reservation, no Remote Start/Stop implementation — approved architecture only.

---

## §5 Energy

**Purpose:** everything about how much power flows, when, and how it's balanced or shaped.

**Canonical concepts:** Meter Values (periodic readings during a session), Smart Charging (dynamic power-limit profiles), Load Balancing (sharing power across a Site), Energy Management (the umbrella coordinating concept), V2G (bidirectional flow).

**Boundaries:** owns real-time and historical power/energy data. Does not own session identity (§4) or billing calculation (§6) — informs both.

**Dependencies:** §2 (meter readings arrive as protocol events), §4 (readings are typically session-scoped), §1 (Site-level power limits).

**Data ownership:** none — entirely `UNDEFINED` or `DISCOVERY` (see Architecture Backlog Cluster E), except that Meter Values' _evaluation_ for inclusion via the raw-event log is explicitly in this work order's scope (not a dedicated telemetry model, just a possible raw-frame capture).

**Protocol relationships:** OCPP `MeterValues`, `SetChargingProfile`/`ClearChargingProfile`.

**Current implementation state:** UNDEFINED, except Meter Values which is ARCHITECTURE DRAFTED (named in the normalized vocabulary) and evaluated (not guaranteed) for the first vertical slice.

**Future implementation state:** a dedicated telemetry/time-series strategy is explicitly deferred as its own future decision (CAP-003 Decision 5) — not designed in this document, deliberately.

**Risks of coupling:** building ad hoc telemetry storage under time pressure (e.g., cramming meter readings into the generic raw-event log indefinitely) without ever making the dedicated-storage decision Decision 5 flagged as deferred.

**Explicit non-goals for CAP-003:** no Smart Charging, Load Balancing, Energy Management, or V2G design at all; Meter Values limited to "evaluate for raw-event capture," never a dedicated model.

---

## §6 Commercial

**Purpose:** turn a completed session into revenue.

**Canonical concepts:** Tariff (pricing definition), Billing (invoice generation), Payment (money movement), Refund, Roaming/OCPI (cross-network commercial relationships).

**Boundaries:** owns pricing, invoicing, and payment state. References `ChargingSession` (§4) as its input; never the reverse — §4 must not depend on §6 existing.

**Dependencies:** §4 Charging Operations (a session must exist and be complete before it can be billed).

**Data ownership:** none on the backend. A mock frontend `Tariff` type exists (`apps/movos-web/src/types/tariff.ts`) reflecting real prior design thinking, entirely disconnected from any backend.

**Protocol relationships:** essentially none — OCPP 2.0.1 has limited native tariff-display support, but MOVOS's actual pricing/billing logic is a MOVOS-side concern regardless of protocol version.

**Current implementation state:** UNDEFINED on the backend; frontend mock only.

**Future implementation state:** Tariff first, then Billing, then Payment, then Refund — a strictly sequential dependency chain, each stage depending on the last.

**Risks of coupling:** letting §4 `ChargingSession` grow tariff/pricing fields directly (schema creep) instead of keeping this a clean downstream reference — exactly the boundary CAP-003 Decision 7 already drew ("mandatory for CAP-003" vs. "belongs to later Tariff/Billing capabilities").

**Explicit non-goals for CAP-003:** absolutely nothing in this area — no Tariff, Billing, Payment, Refund, or Roaming/OCPI model, logic, or integration of any kind.

---

## §7 Device Lifecycle

**Purpose:** everything about managing the physical device itself, independent of any single charging session — provisioning, firmware, diagnostics, certificates, maintenance, and knowing what a given vendor/model/firmware combination actually supports.

**Canonical concepts:** Provisioning (issuing `ocppIdentity` + auth secret — this work order), Firmware (tracking and updating device software), Diagnostics (retrieving logs/reports on demand), Certificates (future mTLS/ISO 15118 PKI), Maintenance (scheduled/reactive device upkeep), Vendor Profiles (`Vendor → DeviceModel → FirmwareVersion → CapabilityProfile`, per [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md)).

**Boundaries:** owns device-identity, credential, and capability metadata. Does not own live operational status (§1/§2 own the last-known-state cache) — Device Lifecycle answers "what is this device, and what can it do," not "what is it doing right now."

**Dependencies:** §1 Charging Infrastructure (`ChargingStation` is the anchor entity); §2 Protocol Layer (authentication is exercised at connection time).

**Data ownership:** `ChargingStation.ocppIdentity` and its authentication-secret storage (this work order, landing on the §1 model); the Vendor/DeviceModel/FirmwareVersion/CapabilityProfile tree (architecture drafted, not modeled).

**Protocol relationships:** OCPP Security Profiles (authentication), `UpdateFirmware`/`FirmwareStatusNotification`, `GetDiagnostics`/`DiagnosticsStatusNotification`, future certificate-management messages.

**Current implementation state:** PARTIALLY IMPLEMENTED — provisioning and authentication (this work order) are real; Firmware, Diagnostics, Certificates, Maintenance, and Vendor Profiles are all undesigned or architecture-drafted only.

**Future implementation state:** Vendor Profiles next (once real Kylum hardware data narrows the actual vendor set), then Firmware/Diagnostics as operational needs demand them, Certificates alongside the future mTLS upgrade.

**Risks of coupling:** letting vendor-specific conditional logic leak into §2's OCPP core instead of living behind the Vendor Profile / Vendor Extension Adapter boundary — explicitly forbidden by this work order.

**Explicit non-goals for CAP-003:** no Firmware, Diagnostics, or Certificate management implementation; no persisted Vendor/DeviceModel/FirmwareVersion/CapabilityProfile records — only the provisioning/authentication slice of this area ships.

---

## Cross-cutting principle

Every area above follows the same rule CAP-002 already established for Charging Infrastructure: **no area stores a denormalized reference to something derivable through its own parent chain.** A future Telemetry table doesn't need its own `organizationId`; it needs a `connectorId` (or `evseId`) and the chain does the rest. This is not a stylistic preference — it's the same tenant-isolation discipline that makes every access check in this codebase a single relation-filtered query instead of a redundant, driftable copy.
