# Architecture Decision Records

This directory contains the formal Architecture Decision Records (ADRs) for MediaFOX Forge.

An ADR is a short document that captures a significant architectural decision: the context that motivated it, the decision itself, the alternatives considered, and the consequences. ADRs are immutable records — once approved, they are not edited. If a decision changes, a new ADR supersedes the old one.

---

## Format

Every ADR in this directory follows this structure:

```
# ADR-XXXX: Title

| Property  | Value                          |
| --------- | ------------------------------ |
| Status    | Proposed / Approved / Superseded |
| Date      | YYYY-MM-DD                     |
| Author    | VULCAN / ARGOS / ATLAS         |
| Approved  | CEO                            |
| Supersedes | ADR-XXXX (if applicable)      |

## Context

What situation or requirement forced this decision?

## Decision

What was decided?

## Alternatives Considered

What other options were evaluated and why were they rejected?

## Consequences

What becomes easier, harder, or different as a result of this decision?

## Related

Links to other ADRs, product documents, or engineering documents.
```

---

## Record Index

| ADR      | Title                                                                                          | Status   | Date       |
| -------- | ---------------------------------------------------------------------------------------------- | -------- | ---------- |
| ADR-0001 | ForgeOS evolves together with products                                                         | Approved | 2026-07-13 |
| ADR-0002 | EV Platform is White Label                                                                     | Approved | 2026-07-13 |
| ADR-0003 | Kylum Energy is Pilot Customer                                                                 | Approved | 2026-07-13 |
| ADR-0004 | Technology Stack                                                                               | Pending  | 2026-07-13 |
| ADR-0005 | [MOVOS is the commercial mobility platform](ADR-0005-movos-commercial-platform.md)             | Approved | 2026-07-14 |
| ADR-0006 | [MOVOS API, authentication and multi-tenancy](ADR-0006-movos-api-and-tenancy.md)               | Approved | 2026-07-15 |
| ADR-0007 | [Google Maps Location Capability for MOVOS Sites](ADR-0007-google-maps-location-capability.md) | Approved | 2026-07-16 |
| ADR-0008 | [OCPP Protocol Scope](ADR-0008-ocpp-protocol-scope.md)                                         | Approved | 2026-07-30 |
| ADR-0009 | [OCPP Transport Boundary](ADR-0009-ocpp-transport-boundary.md)                                 | Approved | 2026-07-30 |
| ADR-0010 | [Device Identity and Authentication](ADR-0010-device-identity-and-authentication.md)           | Approved | 2026-07-30 |
| ADR-0011 | [Live State and Event Persistence](ADR-0011-live-state-and-event-persistence.md)               | Approved | 2026-07-30 |
| ADR-0012 | [ChargingSession Boundary](ADR-0012-chargingsession-boundary.md)                               | Approved | 2026-07-30 |

> ADR-0001 through ADR-0004 are currently recorded as fixture data in the ForgeOS workspace (`apps/forgeos-web/data/decisions.ts`). Formal ADR documents will be migrated to this directory as part of Mission 003.
>
> ADR-0008 through ADR-0012 were drafted per WO-ARGOS-006 as outlines for the CAP-003 (OCPP) architecture decisions — see [CAP-003 OCPP Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md). WO-ARGOS-006 requested numbers 0006–0010, which collide with the already-`Approved` ADR-0006/0007 above; these five were filed as 0008–0012, the next free numbers, instead. All five were approved by ARGOS under WO-ARGOS-007 (2026-07-30) and are now `Approved`, not `Proposed` — see each file's "ARGOS Decision" section for what, if anything, was refined from the original draft.

---

## Relationship to Engineering ADRs

`docs/architecture/` contains long-form architecture documents such as the monorepo package boundary specification. ADRs here are the formal, indexed decision records. The two are complementary: architecture documents explain the design in depth; ADRs record the decision point, context, and rationale concisely.

_Owner: VULCAN | Coordination: ARGOS | Authority: CEO_
