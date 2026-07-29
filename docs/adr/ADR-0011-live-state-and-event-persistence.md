# ADR-0011 — Live State and Event Persistence

**Date:** 2026-07-29 (drafted) · 2026-07-30 (accepted)
**Status:** ACCEPTED — approved by ARGOS per WO-ARGOS-007, with a retention-policy requirement added
**Deciders:** VULCAN (drafted) → ARGOS (approved, WO-ARGOS-007)

> **Numbering note:** WO-ARGOS-006 requested this be filed as ADR-0009. Renumbered to ADR-0011 to stay clear of the real, already-`Approved` ADR-0005/0006/0007 and the ADR-0008/0009/0010 filed alongside this one for the same mission. See [ADR-0008](./ADR-0008-ocpp-protocol-scope.md)'s numbering note for the full explanation.

---

## Context

`Evse.status`/`Connector.status` are today written only by human-facing CRUD (CAP-002). Once OCPP is live, devices will also want to report status changes into the same fields, creating a dual-writer risk the readiness note flagged. No raw-protocol-event history, telemetry store, or event-bus precedent exists in this codebase. See [CAP-003 Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path) for the full evaluation this ADR summarizes.

## Decision (proposed)

Keep `Evse.status`/`Connector.status` as the durable "current believed state" columns (existing CRUD/list/detail UI keeps working unchanged), but make administrative and device-reported writes to those columns distinguishable in the audit trail (a different `AuditService` action string per writer). Add a small, dedicated append-only raw-event log table for inbound/outbound protocol messages — distinct from and smaller in scope than a full event-sourcing system, and distinct from `ChargingSession` (ADR-0012). No message broker, event bus, or external cache (Redis, etc.) is introduced at this stage. `MeterValues`/telemetry storage is explicitly deferred as its own future decision once real energy-metering requirements are scoped.

## Alternatives Considered

- **Direct DB updates only, no distinction and no raw log** — simplest, but reproduces the dual-writer ambiguity and leaves no debugging trail for a pilot integration.
- **A full internal event/command bus** — over-engineered for current message volume; rejected as premature infrastructure.
- **Cached ephemeral state (Redis-backed) synced periodically to the DB** — unjustified at pilot connection volume; revisit only if/when Decision 6 (multi-instance) is actually triggered.

## Consequences

**If approved:** device-reported and human-reported writes stay auditable-but-distinguishable without new infrastructure; a minimal debugging/audit trail exists for real device messages from day one.
**If deferred:** device-reported and administrative writes become indistinguishable in the audit trail, and there is nowhere to durably record raw protocol messages during exactly the period (first real device connections) when that visibility matters most.

## ARGOS Decision (2026-07-30, WO-ARGOS-007)

Approved as drafted, with one added constraint: unlimited retention of the raw-event log is explicitly forbidden without a stated policy. The implemented event model must document its retention expectations rather than growing unbounded by default — see [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md) for the policy adopted in the first vertical slice.

## Related

[CAP-003 OCPP Architecture Decisions — Decision 5](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-5--live-state-write-path) (includes the full field-classification table: administrative vs. device-reported vs. derived vs. historical, per entity) · [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md)
