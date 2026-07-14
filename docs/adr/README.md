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

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| ADR-0001 | ForgeOS evolves together with products | Approved | 2026-07-13 |
| ADR-0002 | EV Platform is White Label | Approved | 2026-07-13 |
| ADR-0003 | Kylum Energy is Pilot Customer | Approved | 2026-07-13 |
| ADR-0004 | Technology Stack | Pending | 2026-07-13 |
| ADR-0005 | [MOVOS is the commercial mobility platform](ADR-0005-movos-commercial-platform.md) | Approved | 2026-07-14 |

> ADR-0001 through ADR-0004 are currently recorded as fixture data in the ForgeOS workspace (`apps/forgeos-web/data/decisions.ts`). Formal ADR documents will be migrated to this directory as part of Mission 003.

---

## Relationship to Engineering ADRs

`docs/architecture/` contains long-form architecture documents such as the monorepo package boundary specification. ADRs here are the formal, indexed decision records. The two are complementary: architecture documents explain the design in depth; ADRs record the decision point, context, and rationale concisely.

*Owner: VULCAN | Coordination: ARGOS | Authority: CEO*
