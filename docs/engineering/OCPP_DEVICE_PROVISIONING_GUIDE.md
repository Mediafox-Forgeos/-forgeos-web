# OCPP Device Provisioning Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/authentication/ocpp-provisioning.service.ts`, `ocpp-provisioning.controller.ts`
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md), [CAP-003 Architecture Decisions — Decision 1 & 2](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md)

## Provisioning flow

1. An OWNER or ADMIN calls `POST /api/v1/charging-stations/:id/ocpp-provisioning` for a `ChargingStation` that has never been provisioned (`ocppIdentity` is `null`).
2. The service generates:
   - `ocppIdentity` — a globally unique, non-secret value (format `movos-<8 hex chars>`), never derived from `code`, `serialNumber`, or the internal `id`.
   - A 256-bit random secret, base64url-encoded.
3. The secret is hashed with bcrypt (12 rounds, matching `prisma/seed.ts`'s existing convention) and stored as `ocppSecretHash`. **The plaintext secret is never persisted anywhere.**
4. The API response contains `{ ocppIdentity, plaintextSecret }` — this is the **only** place the plaintext secret ever appears. It is not logged (NestJS's default request logging does not include response bodies), not stored, not retrievable again through any other endpoint.
5. An `OCPP_STATION_PROVISIONED` audit event is recorded, carrying `ocppIdentity` in its metadata — never the secret.
6. Whoever is physically commissioning the station configures the charger's OCPP client with this identity and secret. The connection URL convention is `wss://<host>/ocpp/<ocppIdentity>`.

## Re-provisioning

A station with an existing `ocppIdentity` cannot be re-provisioned via the same endpoint (`409 Conflict`) — use rotation (below) instead. This is deliberate: provisioning a _new_ identity for an already-provisioned station is identity reassignment, which [CAP-003 Architecture Decisions — Decision 1](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-1--charging-station-network-identity) treats as reprovisioning (revoke + re-provision), not something this work order's endpoints implement — changing an already-assigned `ocppIdentity` is out of CAP-003's scope.

## Authorization

All three provisioning endpoints (provision, rotate, revoke) require `OWNER` or `ADMIN` — the same privileged-role gate CAP-002 already uses for create operations, via the existing `RolesGuard`/`@Roles()` pattern. No new authorization mechanism was introduced.

## What never happens

- The plaintext secret is never written to any log line, anywhere in this codebase (`OcppProtocolEventService` additionally scrubs any accidentally-secret-shaped payload key as defense in depth, though a real code path should never trigger it — see the [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)).
- The plaintext secret is never returned by any `GET` endpoint or included in a `ChargingStation` API projection.
- `ocppSecretHash` itself is a database column only — no presenter or DTO in this codebase exposes it.

## Related

[Secret Rotation Guide](./OCPP_SECRET_ROTATION_GUIDE.md) — the closely related operational flow for changing a secret without re-provisioning identity.
