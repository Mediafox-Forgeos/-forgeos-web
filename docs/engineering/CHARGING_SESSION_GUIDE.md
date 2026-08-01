# Charging Session Implementation Guide

**Generated:** 2026-07-31 (WO-ARGOS-009)
**Code:** `apps/movos-api/src/sessions/`
**Architecture:** [CAP-004 Charging Sessions & Authorization Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md), [MOVOS ChargingSession Architecture v0.1](../domain/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md)

This is the implementation-level companion to the architecture documents above — what's actually in the code, where, and why.

## Module layout

```
sessions/
├── session-lifecycle.service.ts    — the only writer; see Session Lifecycle Guide
├── session-lifecycle.errors.ts     — InvalidSessionTransitionError
├── transaction-id-generator.service.ts — mints protocolTransactionId
├── meter-values.service.ts         — append-only MeterValue writer, keeps energyWh current
├── sessions.service.ts             — read-only query surface for the API
├── sessions.controller.ts          — GET /sessions, GET /sessions/:id, GET /sessions/:id/meter-values
├── sessions.module.ts
└── dto/list-sessions-query.dto.ts
```

## What ships in this vertical slice

`ChargingSession`, `MeterValue` Prisma models. Full read API. Full write path via OCPP: `Authorize` → `AuthorizationAttempt`, `StartTransaction` → session creation, `MeterValues` → telemetry + energy update, `StopTransaction` → termination. See the [OCPP Mapping Guide](./OCPP_MAPPING_GUIDE.md) for the handler-level detail.

## What does not ship

Billing, tariffs, payments, reservations, `Driver`/`Vehicle`/`Fleet` models, OCPP 2.0.1 functional support, RemoteStart/RemoteStop commands. See [CAP-004's §11](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#11-out-of-scope-in-this-work-order) for the complete exclusion list — all of it is architecture-approved, not architecturally omitted.

## Ownership fields are denormalized, deliberately

Unlike `Evse`/`Connector`, `ChargingSession` stores `organizationId`/`siteId`/`chargingStationId`/`evseId`/`connectorId` directly rather than deriving them through the parent chain — see [CAP-004 §2](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#2-domain-hierarchy) for why. This is what makes `GET /sessions` a single indexed `WHERE organizationId = ?` rather than a 4-way join.

## Energy is always resolvable without MeterValue rows

`ChargingSession.energyWh` is authoritative on its own — set at creation (0), updated as telemetry arrives, finalized at termination (`meterStop - meterStart`, floored at 0). Never computed by aggregating `MeterValue` rows on read. Both `energyWh` and `meterStart`/`meterStop` have database `CHECK (>= 0)` constraints in addition to the application-layer floor in `SessionLifecycleService.stopSession()`.

## Idempotency

`@@unique([chargingStationId, protocolTransactionId])` — but note `createSession()`'s actual duplicate-detection is by **connector**, not by transaction id, since 1.6J's `StartTransaction` has no transaction id yet when it's received (MOVOS assigns one). See [CAP-004 §13](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#13-idempotency) for the full reasoning.

## Testing

Unit tests only (mocked Prisma) — `session-lifecycle.service.spec.ts`, `meter-values.service.spec.ts`, plus the four OCPP handler specs under `src/ocpp/handlers/`. No live-database run has been performed for this vertical as of this work order (contrast with CAP-003's OCPP transport, which was separately validated against a real database under WO-ARGOS-008) — see the Final Report for WO-ARGOS-009 for the exact validation level claimed.

## Related guides

[Authorization Guide](./AUTHORIZATION_GUIDE.md) · [Session Lifecycle Guide](./SESSION_LIFECYCLE_GUIDE.md) · [OCPP Mapping Guide](./OCPP_MAPPING_GUIDE.md) · [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)
