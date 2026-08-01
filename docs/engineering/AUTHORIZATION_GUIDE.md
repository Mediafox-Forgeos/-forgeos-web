# Authorization Implementation Guide

**Generated:** 2026-07-31 (WO-ARGOS-009)
**Code:** `apps/movos-api/src/authorization/`
**Architecture:** [CAP-004 Charging Sessions & Authorization Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md), [MOVOS Authorization Architecture v0.1](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md)

## Module layout

```
authorization/
├── authorization-credentials.service.ts   — issue/list/revoke AuthorizationCredential
├── authorization-credentials.controller.ts — GET/POST /credentials, PATCH /credentials/:id/revoke
├── authorization-attempts.service.ts      — resolves a presented identifier, records the attempt
├── authorization-attempts.controller.ts   — GET /authorization-attempts (read-only)
├── authorization.module.ts
└── dto/
```

## What ships in this vertical slice

All 8 `AuthCredentialType` values (`RFID`, `QR`, `APP`, `REMOTE`, `API`, `FLEET`, `PLUG_AND_CHARGE`, `GUEST`) as an enum — but only generic credential CRUD is implemented, not type-specific behavior (e.g. no RFID UID normalization, no QR payload parsing, no Plug & Charge certificate handling). `AuthorizationAttempt` resolution against a real `AuthorizationCredential` table: unknown/revoked/expired/blocked credentials are all correctly classified.

## What does not ship

Type-specific credential logic beyond generic CRUD. Local Authorization List sync (push-to-station on credential change) — see [MOVOS Authorization Architecture — "Local Authorization List synchronization"](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md#local-authorization-list-synchronization). `Driver`/`Fleet` as real owning entities — `AuthorizationCredential.ownerRef` remains conceptual, no `ownerRef` column exists.

## AuthorizationAttempt vs. the CAP-003-era AuthorizationDecision concept

The [Authorization Architecture](../domain/MOVOS_AUTHORIZATION_ARCHITECTURE_v0.1.md) envisioned a separate `AuthorizationDecision` entity downstream of `AuthorizationAttempt`. This work order consolidates them: `AuthorizationAttempt.result` carries the outcome directly (`ACCEPTED` / `REJECTED` / `EXPIRED` / `REVOKED` / `UNKNOWN` / `OFFLINE_ACCEPTED`). See [CAP-004 §3](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md#3-authorization-hierarchy).

## Resolution logic (`AuthorizationAttemptsService.recordAttempt`)

1. Look up `AuthorizationCredential` by `(organizationId, externalIdentifier)`.
2. No match → `UNKNOWN`.
3. `status = REVOKED` → `REVOKED`.
4. `status = BLOCKED` → `REJECTED` (no distinct `BLOCKED` bucket in `AuthAttemptResult`).
5. `expiresAt` in the past, or `status = EXPIRED` → `EXPIRED`.
6. Otherwise → `ACCEPTED` (or `OFFLINE_ACCEPTED` if the caller passes `offline: true` — used when processing a buffered offline transaction retroactively).
7. **Every call inserts exactly one `AuthorizationAttempt` row**, regardless of outcome — this is unconditional, not best-effort.

## `presentedIdentifier` on AuthorizationAttempt

Not in the WO's literal field list — added because an `UNKNOWN`-result attempt needs to record _what_ was presented, not just that something was. See the schema comment on `AuthorizationAttempt.presentedIdentifier`.

## Testing

Unit tests only (mocked Prisma) — `authorization-attempts.service.spec.ts` (valid/revoked/expired/unknown/blocked/offline), `authorization-credentials.service.spec.ts` (create/list/revoke/conflict).

## Related guides

[Charging Session Guide](./CHARGING_SESSION_GUIDE.md) · [Session Lifecycle Guide](./SESSION_LIFECYCLE_GUIDE.md) · [OCPP Mapping Guide](./OCPP_MAPPING_GUIDE.md)
