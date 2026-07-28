# ADR-0009 — OCPP Transport Boundary

**Date:** 2026-07-29
**Status:** PROPOSED — not accepted, drafted per WO-ARGOS-006 as an outline for ARGOS review
**Deciders:** VULCAN (drafted) → ARGOS (approval required)

> **Numbering note:** WO-ARGOS-006 requested this be filed as ADR-0007. That number is already taken by the real, `Approved` [ADR-0007 — Google Maps Location Capability](./ADR-0007-google-maps-location-capability.md). Filed as ADR-0009 instead — see [ADR-0008](./ADR-0008-ocpp-protocol-scope.md)'s numbering note for the full explanation.

---

## Context

`apps/movos-api` is a single NestJS modular monolith; everything shipped so far (Auth, Sites, CAP-002) is stateless HTTP request/response. OCPP requires a persistent WebSocket connection per device — the first stateful, long-lived-connection component this codebase would have. See [CAP-003 Architecture Decisions — Decision 4](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-4--websocket-transport-boundary) (and [Decision 6](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-6--multi-instance-connection-routing) for the related multi-instance question) for the full evaluation this ADR summarizes.

## Decision (proposed)

Build the OCPP WebSocket gateway as a **separate module inside `apps/movos-api`**, not a new deployable — reusing the existing Prisma/Audit/Guard infrastructure directly. Architect it with a clear internal module boundary (connection registry and message handling kept out of unrelated HTTP controllers) so it can be extracted into its own deployable later without a full rewrite, once an actual scaling or fault-isolation need justifies that cost.

Paired with this: enforce a **single-instance deployment constraint** for this module specifically (see ADR-0009's companion Decision 6) until concurrent-connection volume or availability requirements exceed what one instance can serve.

## Alternatives Considered

- **A new sibling app in the monorepo** — clean separation, but duplicates Prisma/Auth wiring or requires a new internal API boundary; unjustified operational cost before a single device has connected.
- **A separate deployable service sharing domain packages** — same trade-off as above, heavier.
- **An external gateway product** — outsources transport entirely; not evaluated in depth as no current need was identified for it, and it would introduce a new operational dependency with no existing precedent in this stack.

## Consequences

**If approved:** OCPP transport work can begin inside a scoped module without committing to a second deployable prematurely; the module boundary preserves an extraction path if/when scale demands it.
**If deferred:** no module structure exists for transport code to live in, risking entanglement with existing HTTP controllers that would make later extraction harder.

## Related

[CAP-003 OCPP Architecture Decisions — Decision 4](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-4--websocket-transport-boundary), [Decision 6](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-6--multi-instance-connection-routing) · [CAP-003 OCPP Readiness Note](../domain/CAP-003_OCPP_READINESS_NOTE.md)
