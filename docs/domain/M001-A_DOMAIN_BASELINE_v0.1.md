# M001-A — Domain Baseline v0.1

**Mission:** M001-A — Domain Research
**Status:** In progress, owned by ARGOS. This document formalizes what already exists; it does not conclude the mission.
**Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db` · **Baseline:** [MOVOS Product Atlas v1.0](../product/MOVOS_PRODUCT_ATLAS_v1.0.md)

## Purpose

M001-A recovers and formalizes the domain that already exists in the repository — it does not start from a blank model, and it does not replace existing concepts merely because a new name might sound architecturally cleaner. Every classification and recommendation in this document set traces to code, schema, documentation, or commit history; nothing is proposed as new terminology in this v0.1.

## Document set

| Document                                                        | Contents                                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Ubiquitous Language](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md)     | 33 requested terms + 3 recovered during research, each classified as IMPLEMENTED / DOCUMENTED / HISTORICAL / FIXTURE-ONLY / ABSENT, with evidence, relationships, conflicts, and a recommendation |
| [Domain Map](./M001-A_DOMAIN_MAP_v0.1.md)                       | Mermaid diagrams — entity relationships and an implementation-status view (implemented / fixture / documented / unclear)                                                                          |
| [Terminology Evolution](./M001-A_TERMINOLOGY_EVOLUTION_v0.1.md) | The dedicated Mission-vs-Capability analysis                                                                                                                                                      |
| [Open Decisions](./M001-A_OPEN_DECISIONS_v0.1.md)               | 10 numbered decisions, evidence-backed recommendations only where the repository actually supports one                                                                                            |

## Headline findings

- **35 terms classified in total** — the 32 distinct concepts requested (treating "Mission/Missions" and "Capability/Capabilities" each as one concept, per the request's own singular/plural pairing) plus 3 recovered during research that the requested list didn't name but the repository's evidence made unavoidable: Alert, EV Platform, ARGOS.
- **12 of the 32 requested terms were not found anywhere in the repository**: Zone, Asset, Charging Station (as an exact phrase — "Station" alone is used instead, see below), EVSE, Transaction, Reservation, Payment, Vehicle, Driver, Fleet, Monitoring (as a named entity), Digital Twin.
- **A handful of the remaining terms are real but thin or contested**, worth flagging above the rest: Capability (single occurrence, structurally ambiguous — see Terminology Evolution), Tenant (real but narrow-scoped, overlapping in name with the separately-implemented tenancy mechanism), Session (a real naming collision between the implemented `RefreshSession` and the planned `ChargingSession` — already correctly avoided in the frontend's own naming, not a live bug), and Maintenance/Incident (real but thin — a status value and a line of UI copy, not workflows).
- **One finding was not on the requested list at all and turned out to matter most:** the naming engine's own top-ranked brand candidate was KYNEX, not MOVOS — recovered from `apps/naming-engine/reports/EV-PLATFORM-BRANDING-REPORT.md`, dated and authored identically to ADR-0005. See [Domain Inventory](../product/MOVOS_DOMAIN_INVENTORY_v1.0.md).
- **The single decision that blocks CAP-002 from starting cleanly** is [M001-A-DEC-005](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-005) — confirming the existing Charger/Station/Connector three-tier shape as sufficient, rather than introducing an EVSE tier, before the first Prisma models for that domain are written.

## What this baseline does not do

It does not rename any concept, does not introduce new domain entities as fact, does not resolve any of the 10 open decisions, and does not begin CAP-002 implementation. Those are explicitly out of scope for this document set, per the mission that produced it.
