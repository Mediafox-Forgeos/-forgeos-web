# ADR-0008 — OCPP Protocol Scope

**Date:** 2026-07-29 (drafted) · 2026-07-30 (accepted)
**Status:** ACCEPTED — approved by ARGOS per WO-ARGOS-007, with the scope expansion noted below
**Deciders:** VULCAN (drafted) → ARGOS (approved, WO-ARGOS-007)

> **Numbering note:** WO-ARGOS-006 requested this be filed as ADR-0006. That number is already taken by the real, `Approved` [ADR-0006 — MOVOS API and Tenancy](./ADR-0006-movos-api-and-tenancy.md). This draft is filed as ADR-0008 instead, the next free number after the existing ADR-0005/0006/0007 (all `Approved`). See the version-control section of [CAP-003 Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) and the WO-ARGOS-006 final report for the full explanation.

---

## Context

CAP-003 (OCPP integration) needs to target a specific protocol version before any transport or message-handling code is written. See [CAP-003 Architecture Decisions — Decision 3](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope) for the full evidence and trade-off analysis this ADR summarizes.

`ChargingStation.protocol` (CAP-002) is a free-form descriptive string only — nothing in the codebase currently parses or enforces a protocol version. No repository evidence exists about which OCPP version(s) Kylum's actual pilot hardware supports.

## Decision (proposed)

Build the OCPP transport and message-handling layers behind an internal, protocol-agnostic boundary (connection registry, message router, command dispatcher independent of any one wire format), with exactly **one** concrete protocol adapter implemented first. The recommended first adapter is **OCPP 1.6J**, on the general-industry basis that it is the most commonly deployed version in existing fleets — but this is explicitly contingent on the [Kylum hardware information request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md) confirming that's what the pilot fleet actually speaks. If that request reveals 2.0.1-only hardware, the concrete adapter choice changes; the abstraction-boundary decision does not.

## Alternatives Considered

- **OCPP 1.6J only, no abstraction boundary** — fastest, but creates real migration cost if 2.x support is ever needed.
- **OCPP 2.0.1 only** — more future-proof, larger and riskier first build, unconfirmed fit for Kylum's actual fleet.
- **Both from the start** — roughly doubles protocol-implementation surface before transport/identity/auth are even settled; rejected as premature.

## Consequences

**If approved:** protocol implementation can begin once hardware is confirmed, without re-architecting the transport boundary if a second protocol is ever needed.
**If deferred:** no protocol-message code can be safely written — building against the wrong version wastes real implementation effort.

## ARGOS Decision (2026-07-30, WO-ARGOS-007)

Approved as drafted, **with scope expanded**: ARGOS explicitly rejects treating OCPP 2.0.1 as an undefined future idea. Its adapter boundary, capability mapping, message families, and architectural position must be **designed now** — not merely implied by the abstraction-boundary shape. This does not change the implementation decision (OCPP 1.6J first, one concrete adapter, contingent on Kylum hardware) but adds a design deliverable: see [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md) for the resulting 2.0.1 boundary design.

## Related

[CAP-003 OCPP Architecture Decisions — Decision 3](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-3--ocpp-version-scope) · [CAP-003 OCPP Readiness Note](../domain/CAP-003_OCPP_READINESS_NOTE.md) · [Kylum Hardware Information Request](../product/KYLUM_OCPP_HARDWARE_INFORMATION_REQUEST.md) · [OCPP Protocol Coexistence](../domain/OCPP_PROTOCOL_COEXISTENCE_v0.1.md)
