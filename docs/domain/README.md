# Domain Documentation

This directory contains MOVOS domain modeling — the formal recovery and, eventually, evolution of the product's ubiquitous language, entity model, and terminology.

It builds directly on [`docs/product/`](../product/README.md), the MOVOS Product Atlas — the Atlas recovers _what exists_; this directory formalizes it into _domain-modeling terms_ and tracks the decisions still needed to move forward.

---

## M001-A — Domain Research

**Status:** In progress, owned by ARGOS. Current documents are v0.1 — a recovery baseline, not an approved domain model.

| Document                                                        | Contents                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| [Domain Baseline](./M001-A_DOMAIN_BASELINE_v0.1.md)             | Entry point — purpose, document set, headline findings                                                                               |
| [Ubiquitous Language](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md)     | Every recovered term, classified (Implemented / Documented / Historical / Fixture-only / Absent), with evidence and a recommendation |
| [Domain Map](./M001-A_DOMAIN_MAP_v0.1.md)                       | Mermaid diagrams — entity relationships and implementation-status view                                                               |
| [Terminology Evolution](./M001-A_TERMINOLOGY_EVOLUTION_v0.1.md) | The Mission-vs-Capability analysis                                                                                                   |
| [Open Decisions](./M001-A_OPEN_DECISIONS_v0.1.md)               | 10 numbered decisions awaiting ARGOS                                                                                                 |

## Rules this directory follows

- **Recover, don't invent.** No term is renamed or replaced because a new name sounds architecturally cleaner — every classification traces to code, schema, documentation, or commit history.
- **Controlled evolution, not reinvention.** Domain modeling here starts from what's already implemented (Organization, Membership, Site) and what's already designed but unbuilt (the frontend's own TypeScript types for Station/Charger/Connector/ChargingSession/Tariff/Alert), not from a blank model.
- **Decisions are proposed, not approved, by VULCAN.** Every open question is registered with evidence and, where the evidence supports one, a recommendation — but approval authority sits with ARGOS.

## Related

- [MOVOS Product Atlas](../product/README.md) — the baseline this domain work builds on
- [Historical product audit](../audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md) — preserved for context, superseded as source of truth by the Atlas
- [ADRs](../adr/README.md) — formal architecture decisions; ADR-0001–0004 remain fixture-only, not migrated by this work

_Owner: ARGOS | Recovery baseline: VULCAN_
