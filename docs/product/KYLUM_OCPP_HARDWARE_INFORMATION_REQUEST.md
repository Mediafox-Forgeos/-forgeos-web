# Kylum OCPP Hardware Information Request

**Generated:** 2026-07-29 (WO-ARGOS-006)
**Purpose:** A concise checklist of real charger information MOVOS needs from Kylum Energy before CAP-003 (OCPP) implementation begins. Every item below is a question to ask Kylum — **nothing in this document is a claim about Kylum's actual hardware.** No prior repository evidence exists about Kylum's real charger fleet; several CAP-003 decisions ([OCPP Version Scope](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope), [Device Authentication](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-2--device-authentication)) are explicitly contingent on the answers here.

**How to use this document:** send it to Kylum's technical/operations contact, or use it as an interview checklist during a site visit / vendor call. Answers should be recorded per charger **model** (a pilot fleet may have more than one).

---

## 1. Identity

- [ ] **Manufacturer** (e.g. ABB, Alpitronic, Kempower, Wallbox, etc.)
- [ ] **Model name and hardware revision**
- [ ] **Firmware version** currently running on each installed unit
- [ ] **Station identity format** — what value does the charger send as its own identity when connecting (its configured "charge point ID" / station ID)? Is it factory-set, or configurable by the installer/operator?

## 2. Protocol support

- [ ] **Supported OCPP version(s)** — 1.6J, 2.0.1, both, or something else? Confirm per firmware version if it's changed over time.
- [ ] **Known vendor-specific OCPP extensions** — any non-standard message types, vendor error codes, or proprietary behavior the firmware relies on beyond the base spec?
- [ ] **Vendor documentation** — is there an OCPP conformance statement, integration guide, or protocol implementation profile available from the manufacturer?

## 3. Connection configuration

- [ ] **WebSocket URL configuration options** — can the charger's target WebSocket URL (CSMS endpoint) be configured remotely, or only locally via a physical/web interface? Is the URL path configurable (needed to carry the station identity)?
- [ ] **Supported authentication methods** — does the firmware support HTTP Basic Authentication over the WebSocket upgrade request? Mutual TLS / client certificates? Anything else?
- [ ] **TLS/certificate support** — does the charger support WSS (TLS)? What TLS versions and cipher suites? Can it validate a server certificate from a standard CA, or does it require a specific certificate/pinning setup?
- [ ] **Network connectivity** — how does each unit reach the internet (fixed broadband, cellular/SIM, site Wi-Fi)? Does the connectivity method use a fixed or dynamic IP? (Relevant to whether IP allowlisting is a viable additional security layer.)

## 4. Physical/electrical topology

- [ ] **Number of EVSEs per physical unit** — does each installed charger have one independently-controllable EVSE, or multiple?
- [ ] **Number of connectors per EVSE**
- [ ] **Connector types** present (CCS2, Type 2, CHAdeMO, or others)
- [ ] **Rated power** per EVSE/connector

## 5. Operational and testing readiness

- [ ] **Vendor test/staging environment** — does the manufacturer provide a test CSMS, simulator, or sandbox that MOVOS can validate against before connecting a real pilot unit?
- [ ] **Remote-command support** — which OCPP remote commands does the firmware actually implement (e.g. RemoteStartTransaction, RemoteStopTransaction, UnlockConnector, Reset)? Vendor "supports OCPP" claims don't guarantee every optional command is implemented.
- [ ] **Firmware-update support** — can firmware be updated remotely via OCPP (`UpdateFirmware`), or only locally/manually?
- [ ] **Sample configuration screenshots or manuals** — the charger's own local configuration UI (or CLI/manual) showing where OCPP settings (server URL, auth, identity) are entered, if available.

---

## What happens with these answers

- **Manufacturer/model/firmware/OCPP version** feed directly into [CAP-003 Architecture Decisions — Decision 3 (OCPP Version Scope)](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope).
- **Authentication/TLS support** feed directly into [Decision 2 (Device Authentication)](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-2--device-authentication) — specifically whether mutual TLS is realistic as anything other than a future upgrade.
- **Station identity format** feeds into [Decision 1 (Charging Station Network Identity)](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-1--charging-station-network-identity) — confirms whether MOVOS can assign its own identity value or must accommodate a vendor-fixed one.
- **EVSE/connector topology** should be cross-checked against the already-implemented CAP-002 data model (`ChargingStation → Evse → Connector`) to confirm no additional tier or field is needed before real devices are provisioned.

This document does not need to be fully answered before CAP-003 architecture is approved in principle, but **must** be answered before the OCPP version scope and authentication mechanism decisions are finalized for implementation.
