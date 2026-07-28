# ADR-0010 — Device Identity and Authentication

**Date:** 2026-07-29
**Status:** PROPOSED — not accepted, drafted per WO-ARGOS-006 as an outline for ARGOS review
**Deciders:** VULCAN (drafted) → ARGOS (approval required)

> **Numbering note:** WO-ARGOS-006 requested this be filed as ADR-0008. Renumbered to ADR-0010 to stay clear of the real, already-`Approved` ADR-0005/0006/0007 and the ADR-0008/0009 filed alongside this one for the same mission. See [ADR-0008](./ADR-0008-ocpp-protocol-scope.md)'s numbering note for the full explanation.

---

## Context

MOVOS currently authenticates only humans (JWT + httpOnly refresh cookie). Nothing in the existing system authenticates a physical device. OCPP needs both a stable per-station identity (distinct from the internal database key, human-readable code, and hardware serial number) and a credential the device presents on connection. See [CAP-003 Architecture Decisions — Decision 1](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-1--charging-station-network-identity) and [Decision 2](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-2--device-authentication) for the full comparison this ADR summarizes.

## Decision (proposed)

**Identity:** add a new `ChargingStation` field (working name `ocppIdentity`) — globally unique, mutable, populated at commissioning, distinct from `code` (site-scoped human label), `serialNumber` (hardware attribute), and `id` (internal primary key, never exposed to a device).

**Authentication (MVP):** WSS + HTTP Basic Authentication, with the password a strong, randomly generated, per-station secret (not shared/global), hashed at rest following the same convention as `User.passwordHash`, never returned by any read endpoint, optionally layered with IP allowlisting if Kylum's fleet supports it.

**Authentication (future):** mutual TLS (OCPP 2.0.1 Security Profile 3), adopted once firmware support is confirmed and/or fleet size justifies the PKI operational cost.

## Alternatives Considered

- **Identity-only WebSocket path, no credential** — universal compatibility, but no real security; rejected as insufficient for a real pilot customer's production infrastructure.
- **Reusing `code` or `serialNumber` as the OCPP identity** — both overload a field already serving a different purpose; rejected in favor of a dedicated field.
- **Mutual TLS for MVP** — strongest option, but unconfirmed firmware support and high PKI operational cost make it unsuitable as a first cut; retained as the future upgrade path instead.

## Consequences

**If approved:** a schema change (new identity field) and a credential-provisioning workflow (generation, hashed storage, rotation, revocation) become buildable.
**If deferred:** no connection-handling code can safely accept a real device — either unauthenticated connections would have to be accepted into a production pilot, or work stalls on an undocumented ad hoc choice.

## Security notes

Secrets are never placed in the connection URL — only the identity value is. Credentials travel in the Basic Auth header, over TLS. Rotation and revocation use the same mechanism: generate/invalidate server-side, requiring the physical device's configuration to be updated to match.

## Related

[CAP-003 OCPP Architecture Decisions — Decision 1](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-1--charging-station-network-identity), [Decision 2](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-2--device-authentication) · [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md) (mTLS/auth-method support fields)
