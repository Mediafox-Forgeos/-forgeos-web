# OCPP Secret Rotation Guide

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Code:** `apps/movos-api/src/ocpp/authentication/ocpp-provisioning.service.ts` (`rotateSecret`)
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md), [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md)

## When to rotate

- Routine credential hygiene (no fixed schedule is enforced by CAP-003 — this is an operator decision).
- Suspected credential exposure (e.g. a technician's provisioning notes were mishandled) that doesn't warrant full revocation, because the station should keep operating once its physical configuration is updated.

## Flow

1. `POST /api/v1/charging-stations/:id/ocpp-provisioning/rotate` (OWNER/ADMIN only).
2. A new 256-bit secret is generated and hashed; `ocppSecretHash` is overwritten, `ocppSecretRotatedAt` is set.
3. **`ocppIdentity` is unchanged.** Rotation replaces the credential, not the station's network identity.
4. The response contains the new plaintext secret exactly once — same discipline as initial provisioning (see the [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md)).
5. An `OCPP_SECRET_ROTATED` audit event is recorded.
6. Whoever has physical/remote access to the station must update its configured OCPP password to match.

## What rotation does _not_ do

**It does not forcibly disconnect a currently-live connection.** If a station is connected right now using the old secret, that connection stays up — only the _next_ connection attempt needs the new secret. This is a deliberate, minimal choice for CAP-003, not an oversight: forcibly disconnecting on every rotation would interrupt an operating station for a credential-hygiene action that isn't a security emergency. **Contrast with revocation** (see the [Device Provisioning Guide](./OCPP_DEVICE_PROVISIONING_GUIDE.md#related)), which _does_ forcibly disconnect immediately, because revocation exists specifically for the case where continued connectivity is the problem.

If forcing an immediate reconnect-with-new-credentials is ever needed, the operational workaround today is: rotate, then revoke-and-reprovision if the live connection must be cut immediately — there is no single-step "rotate and force-reconnect" operation in this vertical slice.

## Storage and exposure

Identical discipline to initial provisioning: bcrypt-hashed at rest (12 rounds), plaintext never logged, never returned by any endpoint other than the rotation call's own response, never included in any `ChargingStation` API projection.
