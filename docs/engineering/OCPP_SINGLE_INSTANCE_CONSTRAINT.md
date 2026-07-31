# OCPP Single-Instance Deployment Constraint

**Generated:** 2026-07-30 (WO-ARGOS-007)
**Approves:** [CAP-003 Architecture Decisions — Decision 6](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-6--multi-instance-connection-routing), ADR-0009
**Part of:** [OCPP Engine Guide](./OCPP_ENGINE_GUIDE.md)

## The constraint

**`apps/movos-api` must run as a single instance while the OCPP transport module is active.** The connection registry (`ConnectionRegistryService`) is an in-memory `Map`, not Redis-backed — if a second instance of `apps/movos-api` is ever started while devices are connected, each instance will maintain its own, inconsistent view of which stations are connected, and a command routed to the wrong instance would silently fail to reach its target device.

## Why this is acceptable for the MVP

At pilot fleet scale (a small, known number of Kylum stations), one instance holding all connections is sufficient. Introducing Redis or a message broker to solve a scaling problem that doesn't exist yet would be the exact kind of premature infrastructure this work order's exclusions explicitly forbid ("Do not introduce Redis or a broker without a justified current need" — [CAP-003 Architecture Decisions — Decision 6](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-6--multi-instance-connection-routing)).

## How this is enforced

**Operationally, not in code.** Nothing in `apps/movos-api` prevents a second instance from starting — this is a deployment-configuration constraint (e.g. a Railway service's replica/instance-count setting), not a runtime check. Whoever manages the production deployment must ensure this is respected; it cannot be verified from the application alone.

## Why the code doesn't need to know about this constraint

Per ADR-0009's explicit requirement, "future scaling must not require redesigning the protocol adapter or domain layer." The connection registry is injected as a single, replaceable component (`ConnectionRegistryService`) — no other part of the OCPP engine (adapters, router, handlers) is aware it's in-memory. A future distributed-routing implementation (Redis-backed or otherwise) would replace this one class; nothing else changes.

## When this constraint should be revisited

Either of two triggers, per Decision 6:

1. Concurrent device-connection count or command-latency/availability requirements exceed what a single instance can reliably serve.
2. The OCPP transport is extracted into its own deployable (see [CAP-003 Architecture Decisions — Decision 4](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-4--websocket-transport-boundary)) and _that_ deployable itself needs to scale horizontally for availability, not just throughput.

Fleet growth alone is not automatically a trigger — check against the actual constraint (connection count / latency / availability), not a round number.
