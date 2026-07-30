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

Unit tests only (mocked Prisma/dependencies) — 63 tests across 11 spec files under `src/ocpp/`. **No true end-to-end WebSocket-against-a-real-database test exists**, consistent with the rest of this codebase's testing discipline (CI has no live database service — see [Testing Strategy](./TESTING_STRATEGY.md)). The simulator exists for manual/local verification against a real, developer-run instance, not for automated CI execution. Do not claim e2e coverage for this module.

## Related guides

[OCPP 1.6J Adapter Guide](./OCPP_16J_ADAPTER_GUIDE.md) · [OCPP 2.0.1 Architecture Guide](./OCPP_201_ARCHITECTURE_GUIDE.md) · [OCPP/Domain Status Mapping](./OCPP_DOMAIN_STATUS_MAPPING.md) · [Simulator Guide](./OCPP_SIMULATOR_GUIDE.md) · [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md) · [Secret Rotation Guide](./OCPP_SECRET_ROTATION_GUIDE.md) · [Single-Instance Deployment Constraint](./OCPP_SINGLE_INSTANCE_CONSTRAINT.md) · [Hardware Compatibility Validation Policy](./OCPP_HARDWARE_COMPATIBILITY_VALIDATION_POLICY.md)
