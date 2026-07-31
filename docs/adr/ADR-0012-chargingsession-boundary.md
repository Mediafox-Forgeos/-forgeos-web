# ADR-0012 — ChargingSession Boundary

**Date:** 2026-07-29 (drafted) · 2026-07-30 (accepted)
**Status:** ACCEPTED — approved by ARGOS per WO-ARGOS-007, with the reconnect-spanning position refined below
**Deciders:** VULCAN (drafted) → ARGOS (approved, WO-ARGOS-007)

> **Numbering note:** WO-ARGOS-006 requested this be filed as ADR-0010. Renumbered to ADR-0012 to stay clear of the real, already-`Approved` ADR-0005/0006/0007 and the ADR-0008/0009/0010/0011 filed alongside this one for the same mission. See [ADR-0008](./ADR-0008-ocpp-protocol-scope.md)'s numbering note for the full explanation.
>
> **This ADR defines a concept, not a schema.** No Prisma model is created by this document or by the work order it was drafted under.

---

## Context

`ChargingSession` does not exist as a backend entity. A mock frontend type (`apps/movos-web/src/types/session.ts`) reflects real prior design thinking but is disconnected fixture data. OCPP's `StartTransaction`/`StopTransaction` messages need somewhere to land once CAP-003 processes real charging transactions. See [CAP-003 Architecture Decisions — Decision 7](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary) for the full conceptual definition this ADR summarizes.

## Decision (proposed)

Define — but do not yet model — a `ChargingSession` concept with: a MOVOS-internal `id`; ownership derived through `Connector → Evse → ChargingStation → Site → Organization` (no redundant foreign keys, consistent with CAP-002's convention); `startedAt`/nullable `endedAt`; a terminal energy value; a status enum distinct from `Evse`/`Connector` operational status; a protocol transaction identifier stored as a mutable attribute (never the primary key, mirroring `externalId`); and an abnormal-termination reason reusing OCPP's own stop-reason vocabulary. An authorization reference (who/what started the session) and whether a session may span protocol reconnects are flagged as open questions requiring an explicit ARGOS decision, not assumed.

## Alternatives Considered

- **Model it now, alongside this ADR** — explicitly out of scope for this work order (documentation-only, no schema changes permitted); deferred until CAP-003 is actually scoped.
- **Treat OCPP transaction and MOVOS ChargingSession as identical** — rejected; a transaction is protocol-scoped to one connection's lifetime, while a session is the durable business record — conflating them would break the moment reconnect-spanning sessions are considered.
- **Include billing/tariff fields (cost, currency, invoice reference) now** — rejected as out of CAP-003's scope; explicitly deferred to later Tariff/Billing capabilities.

## Consequences

**If approved:** CAP-003 has an agreed conceptual target to build a real schema against once implementation starts, without having committed to that schema prematurely.
**If deferred:** CAP-003 could still stand up transport, identity, and authentication (ADR-0008/0009/0010), but could not process a real charging transaction end-to-end.

## Open questions as originally drafted (superseded below)

- Authorization/idTag identity — MOVOS has no driver/vehicle/idTag concept today at all (confirmed absent in prior domain recovery work); this is a real dependency, not a gap to paper over.
- Whether one session may span a protocol reconnect (recommendation: no, for a first cut).

## ARGOS Decision (2026-07-30, WO-ARGOS-007)

The conceptual boundary is approved as drafted, with explicit clarification that a `ChargingSession` is **not** equivalent to a WebSocket connection, a raw OCPP transaction, an authorization attempt, a payment, or a billing record.

**The reconnect-spanning question is resolved, refining the original "no" recommendation:** a `ChargingSession` **may** survive a WebSocket reconnection specifically when the device continues the same underlying protocol transaction. Session continuity is tied to **transaction continuity**, not connection continuity — a reconnect that does not continue the same transaction does not resume the old session. This is a more precise rule than the original draft's blanket "no," not a full reversal of it.

The authorization/idTag identity dependency remains open and undesigned — it is not resolved by this ADR and is tracked in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) (capabilities 8–13, 47–48) rather than left only in this note.

## Related

[CAP-003 OCPP Architecture Decisions — Decision 7](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#decision-7--chargingsession-boundary) · [M001-A Ubiquitous Language — Session](../domain/M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#session) (existing `ChargingSession` vs. `RefreshSession` naming-collision analysis) · [ChargingSession Architecture](../architecture/MOVOS_CHARGING_SESSION_ARCHITECTURE_v0.1.md) · [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md)
