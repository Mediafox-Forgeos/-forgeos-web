# OCPP Hardware Compatibility Validation Policy

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Part of:** [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md), [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## The policy

**No manufacturer, model, or firmware version may be described as compatible with MOVOS beyond the validation level actually earned**, using the six-level vocabulary defined in the [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md#hardware-validation-levels): `UNASSESSED` → `DOCUMENTATION_REVIEWED` → `SIMULATOR_VALIDATED` → `REMOTE_HARDWARE_VALIDATED` → `PHYSICAL_HARDWARE_VALIDATED` → `CERTIFICATION_EVIDENCE_AVAILABLE`.

This is not a formality — it exists because "we support OCPP" is a claim that's trivially easy to overstate and expensive to walk back once a pilot customer has heard it.

## Rules

1. **Never skip a level.** A vendor cannot be marked `PHYSICAL_HARDWARE_VALIDATED` on the strength of reading their documentation — that's `DOCUMENTATION_REVIEWED`, nothing more, until an actual test happens.
2. **`SIMULATOR_VALIDATED` proves the MOVOS engine, not the device.** Passing MOVOS's own OCPP simulator (`apps/movos-api/simulator/`) demonstrates that MOVOS correctly implements the protocol messages it claims to — it says nothing about whether any specific vendor's real firmware behaves identically. Do not present simulator success as hardware validation.
3. **`CERTIFICATION_EVIDENCE_AVAILABLE` requires actual evidence** — a real Open Charge Alliance (or equivalent) certification record for that specific vendor/model/firmware combination, not an assumption that "OCPP-certified hardware" in general will work.
4. **No level is claimed without a named evidence source.** Every compatibility statement should be traceable to what was actually done (which simulator run, which test unit, which certification document).

## What this work order's own implementation achieved

**`SIMULATOR_VALIDATED`, and no higher, for OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` only.**

This level was earned on 2026-07-31 under WO-ARGOS-008, not WO-ARGOS-007. WO-ARGOS-007 (CAP-003) built the engine and validated it only at the mocked-unit-test level; that work order's own final report explicitly did not claim `SIMULATOR_VALIDATED` (an earlier draft of this document overstated that claim before it was actually earned — corrected here). WO-ARGOS-008 performed the real run this policy requires:

- **Environment:** local development Postgres (`movos_dev`, all 4 migrations applied, including `20260730120000_add_ocpp_engine_foundation`), a real compiled `apps/movos-api` instance (`node dist/main.js`) listening on `localhost:4000`, a real `ws`-based simulator client connecting to `ws://localhost:4000/ocpp/{ocppIdentity}`.
- **Station provisioned via the real API** (`POST /charging-stations/:id/ocpp-provisioning`), not a manual database insert.
- **Scenarios executed:** valid connection + subprotocol negotiation, `BootNotification`, `Heartbeat`, `StatusNotification` (connector 1 and the connector-0 whole-station no-op), invalid credentials (HTTP 401, no registry entry), unknown identity (HTTP 401), duplicate connection (deterministic replacement, old socket closed with `replaced-by-new-connection`), disconnect/reconnect, malformed frame (connection survived, no crash), unsupported action (`Authorize` → explicit `CALLERROR`), OCPP 2.0.1 detection (connects, then every message explicitly rejected as unsupported).
- **Verified in the real database, not inferred:** `Connector.status` updated to `CHARGING`; 8 `OcppProtocolEvent` rows recorded with the correct `direction`/`messageType`/`processingStatus` for every scenario; no plaintext secret found anywhere in server logs, `AuditEvent.metadata`, or `OcppProtocolEvent.payload`.
- **Transport-layer test coverage added** (`ocpp-websocket.server.spec.ts`, real HTTP server + real `ws` client, 10 tests) and stale-connection-sweep coverage added (`connection-registry.service.spec.ts`, fake timers, 4 tests) — both were previously untested gaps, now closed.

No physical charger has been tested. No manufacturer, model, or firmware is certified or claimed compatible by this work order. `REMOTE_HARDWARE_VALIDATED` and above remain unearned.

## What this means for Kylum specifically

Nothing about Kylum's actual fleet is validated at any level yet, because no repository evidence exists about what hardware Kylum operates — see the [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md). Once that request is answered and a real unit is available (remotely or physically), the validation level for that specific vendor/model/firmware combination should be updated accordingly — starting from `DOCUMENTATION_REVIEWED` at best, until an actual connection is tested.

## Where this is tracked

Today: only in this document and the [Device Capability Architecture](../domain/MOVOS_DEVICE_CAPABILITY_ARCHITECTURE_v0.1.md)'s prose — no `CapabilityProfile` table exists yet to persist a validation level per device (Architecture Backlog #32–35). Populating that structure is future work, contingent on real vendor data.
