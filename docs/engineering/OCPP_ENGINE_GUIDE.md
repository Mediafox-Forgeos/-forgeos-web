# OCPP Engine Implementation Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/`
**Architecture:** [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md), [CAP-003 Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md)

This is the implementation-level companion to the architecture documents above — what's actually in the code, where, and why, for an engineer picking this up next.

## Module layout

```
apps/movos-api/src/ocpp/
├── transport/                  WebSocket upgrade handshake, connection lifecycle
│   └── ocpp-websocket.server.ts
├── connection-registry/        In-memory Map<ocppIdentity, connection>
│   └── connection-registry.service.ts
├── authentication/              Connection-time auth + provisioning/rotation/revocation
│   ├── ocpp-authentication.service.ts
│   ├── ocpp-provisioning.service.ts
│   ├── ocpp-provisioning.controller.ts   (HTTP: provision/rotate/revoke)
│   └── future-authorization-contracts.ts (types only — Architecture Backlog #4-15)
├── protocol/
│   ├── common/                  Protocol-agnostic contracts every adapter implements
│   │   ├── normalized-events.ts   NormalizedInboundEvent/NormalizedOutboundCommand/ProtocolAdapter
│   │   ├── ocpp-frame.ts          Shared OCPP-J envelope (CALL/CALLRESULT/CALLERROR)
│   │   ├── protocol-detector.ts   Subprotocol -> OcppProtocolVersion
│   │   └── errors.ts
│   ├── ocpp16/                  Concrete adapter: BootNotification/Heartbeat/StatusNotification
│   │   └── ocpp16-adapter.ts
│   └── ocpp201/                 Boundary-only stub — every message -> explicit CALLERROR
│       └── ocpp201-adapter.ts
├── normalization/                NormalizedDeviceStatus -> EvseStatus/ConnectorStatus
│   └── status-mapping.ts
├── routing/                      The seam: parses envelopes, dispatches to handlers, persists
│   └── ocpp-message-router.service.ts
├── handlers/                     Domain logic — never see a raw OCPP DTO
│   ├── boot-notification.handler.ts
│   ├── heartbeat.handler.ts
│   └── status-notification.handler.ts
├── commands/                     Empty — reserved for future outbound commands (Remote Start etc.)
├── persistence/                  Append-only raw-event log writer
│   └── ocpp-protocol-event.service.ts
├── diagnostics/                  Empty — reserved (Architecture Backlog #30)
├── simulator-contracts/          Shared types the simulator (outside src/) depends on
│   └── simulator-config.ts
├── ocpp.module.ts
└── vendor-neutrality.spec.ts      Static guard: no hardcoded vendor conditionals anywhere above
```

`commands/` and `diagnostics/` are intentionally empty except for this guide's mention of them — they are reserved module boundaries, not placeholder code. Adding a file there without a real capability behind it would be exactly the kind of "reserve the name" anti-pattern this work order's Phase 11 instruction forbids for database tables, and the same principle applies to code structure.

## What ships in this vertical slice

- Device identity (`ChargingStation.ocppIdentity`) and MVP authentication (WSS + Basic Auth, bcrypt-hashed secret).
- Provisioning, rotation, and revocation via `OcppProvisioningController` (OWNER/ADMIN only).
- An in-memory, single-instance connection registry (Decision 6) — one live connection per `ocppIdentity`, deterministic reconnection, stale-connection sweep.
- The OCPP 1.6J adapter for `BootNotification`, `Heartbeat`, `StatusNotification` — every other 1.6J action resolves to `UnsupportedMessage` and a protocol-correct `CALLERROR`.
- The OCPP 2.0.1 adapter boundary — protocol detection works, every message explicitly fails with `NotImplemented`, never a silent accept.
- The append-only `OcppProtocolEvent` raw-message log.
- A development/test simulator (`apps/movos-api/simulator/`, outside the production build).

## What does not ship

Everything else in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) — `Authorize`/`StartTransaction`/`StopTransaction`, `MeterValues`, any remote command (Remote Start/Stop/Reset/Unlock), RFID, `ChargingSession`, Smart Charging, Reservations, Billing, and everything downstream of those. Do not infer support for any of these from the fact that this module exists.

## Retention policy for `OcppProtocolEvent`

Per ARGOS's explicit requirement on Decision 5 ("unlimited telemetry retention is forbidden without an explicit policy"): during the pilot phase, at pilot fleet volume, rows are retained indefinitely and **no automatic purge is implemented by CAP-003**. This is a stated interim policy, not silence. A scheduled purge/archival strategy must be designed before general-availability message volume makes unbounded growth a real operational problem — track that as a follow-up, not an assumption that this table is safe to leave alone forever.

## Connection URL convention

`wss://<host>/ocpp/<ocppIdentity>` — Basic Auth in the WebSocket upgrade request, OCPP version selected via the `Sec-WebSocket-Protocol` header (`ocpp1.6` or `ocpp2.0.1`). See [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md) for how `ocppIdentity` and the secret are issued.

## Testing

**As shipped by CAP-003 (WO-ARGOS-007):** unit tests only (mocked Prisma/dependencies) — 63 tests across 11 spec files under `src/ocpp/`. No true end-to-end WebSocket-against-a-real-database test existed, and `ocpp-websocket.server.ts` (the transport class itself) had zero test coverage of any kind.

**Updated 2026-07-31 (WO-ARGOS-008):** both gaps are now closed.

- `ocpp-websocket.server.spec.ts` — a real Node HTTP server + a real `ws` client (not mocked sockets), 10 tests covering the upgrade handshake, subprotocol negotiation, Basic Auth handoff (accept and reject paths), message delivery to the router, malformed-frame handling, duplicate-connection replacement, clean close/unregister, and server survival after an abrupt client-side termination.
- `connection-registry.service.spec.ts` gained a `stale connection sweep` describe block — 4 tests using Jest fake timers (not a changed production threshold) proving the sweep actually removes idle connections past the 5-minute threshold, retains touched ones, and doesn't evict a newer connection that replaced a since-gone-stale older one.
- **A one-time manual runtime validation run** was also performed: a real compiled `apps/movos-api` instance booted against a real local PostgreSQL database (all 4 migrations applied), a station provisioned through the real HTTP provisioning endpoint, and the repository simulator run against it over a real WebSocket connection through all 12 scenarios in [CAP-003 Architecture Decisions — WO-ARGOS-008 validation record](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md). Database state (`Connector.status`, 8 `OcppProtocolEvent` rows) and log/audit output were inspected directly and showed no secret leakage. This run is not part of the automated CI suite — CI still has no live database service (see [Testing Strategy](./TESTING_STRATEGY.md)) — so it is a point-in-time validation record, not regression-tested on every commit. Result: **`SIMULATOR_VALIDATED`** — see the [Hardware Compatibility Validation Policy](./OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md) for the exact evidence and what this level does and does not claim.

Automated test count as of WO-ARGOS-008: 77 tests across 13 spec files under `src/ocpp/` (63 original + 10 transport + 4 stale-sweep).

## Known risks (updated 2026-07-31, WO-ARGOS-008)

- **No live-database CI coverage exists or is planned.** Every automated test — including the new transport and stale-sweep tests — runs against mocked Prisma. The `SIMULATOR_VALIDATED` claim rests on a one-time manual run (see the [Runtime Validation Record](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#wo-argos-008-runtime-validation-record-2026-07-31)), not a regression-tested pipeline — a future change could silently break runtime behavior that unit tests alone wouldn't catch.
- **`OcppProtocolEvent` has no enforced retention.** Growth is unbounded in production until a purge/archival policy is actually implemented (documented as an accepted interim gap, not a surprise — see the model's schema comment).
- **OCPP 2.0.1's real shape is still contingent on unanswered Kylum hardware questions** — the current boundary-only adapter could need revision once real answers arrive.
- **No station-level "last connected" field is persisted to the database.** Connection recency lives only in the in-memory registry (as designed for the single-instance MVP — Decision 6) and is lost on every restart; this is a real operational limitation for anyone trying to answer "when did this station last talk to us" outside of scanning the raw protocol-event log.
- Every deferred capability listed in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) remains a scope gap, not a defect — `Authorize`/`StartTransaction`/`StopTransaction`, `ChargingSession`, RFID, remote commands, and functional OCPP 2.0.1 are all still unbuilt.

**Resolved by WO-ARGOS-008, no longer risks:** the WebSocket transport class previously had zero test coverage of any kind — now covered by 10 real HTTP+WebSocket integration tests. The connection-registry stale-sweep was previously implemented but untested — now covered by 4 deterministic fake-timer tests. The engine had never been run against a real database or a real socket before this work order — it now has, with a documented, evidence-backed result.

## Related guides

[OCPP 1.6J Adapter Guide](./OCPP_16J_ADAPTER_GUIDE.md) · [OCPP 2.0.1 Architecture Guide](./OCPP_201_ARCHITECTURE_GUIDE.md) · [OCPP/Domain Status Mapping](./OCPP_DOMAIN_STATUS_MAPPING.md) · [Simulator Guide](./OCPP_SIMULATOR_GUIDE.md) · [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md) · [Secret Rotation Guide](./OCPP_SECRET_ROTATION_GUIDE.md) · [Single-Instance Deployment Constraint](./OCPP_SINGLE_INSTANCE_CONSTRAINT.md) · [Hardware Compatibility Validation Policy](./OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md)
