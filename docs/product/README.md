# Product Documentation

This directory contains product strategy, roadmaps, requirements, and specifications for all MediaFOX Forge products.

---

## MOVOS Product Atlas v1.0

The official, version-controlled MOVOS product baseline — recovered directly from the repository (WO-ARGOS-001/002), not proposed or redesigned. **Every MOVOS product decision starts here.**

| Document                                                         | Covers                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)                   | What MOVOS is, the four implementation-status groups (A/B/C/D), the six baseline questions    |
| [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md)                 | Real entity dependencies, recovered from the schema and frontend types                        |
| [Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md)             | Terminology evolution — EV Platform → MOVOS, the KYNEX naming-engine finding, Mission history |
| [Feature Matrix](./MOVOS_FEATURE_MATRIX_v1.0.md)                 | Every capability, completion %, production-readiness                                          |
| [Screen Inventory](./MOVOS_SCREEN_INVENTORY_v1.0.md)             | All 15 `movos-web` screens, mock-vs-real data per screen                                      |
| [API Inventory](./MOVOS_API_INVENTORY_v1.0.md)                   | All 13 real `movos-api` endpoints                                                             |
| [Database Inventory](./MOVOS_DATABASE_INVENTORY_v1.0.md)         | The complete Prisma schema — 6 models, 7 enums                                                |
| [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md)             | Shortest path to a Kylum-ready MVP, reusing existing patterns                                 |
| [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md) | Recommended build order with dependencies and relative sizing                                 |

Domain modeling for M001-A, which builds on this baseline, lives in [`docs/domain/`](../domain/README.md). The prior product audit, [`docs/audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md`](../audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md), is preserved as a historical record; its conclusions were re-verified against current `main` and remain accurate.

---

## Products

### ForgeOS

Internal AI Operating Workspace. Built for the founding team. Houses ARGOS, sprint management, project tracking, client context, and the knowledge base.

### EV Platform

Commercial white-label SaaS for Electric Vehicle Charging Infrastructure Management. API-first, multi-tenant, multi-operator, multi-language, multi-currency.

### Kylum Energy

Pilot customer for the EV Platform. Informs the product; is not the product. See the [Founder Team Constitution](../company/FOUNDER_TEAM_CONSTITUTION.md) for the classification rationale.

---

## Planned Documents

| Document               | Product     | Description                                                          |
| ---------------------- | ----------- | -------------------------------------------------------------------- |
| Product Vision         | EV Platform | Long-form articulation of the problem, solution, and market position |
| Roadmap v1             | EV Platform | Four-phase roadmap: Foundation → Core Platform → OCPP → Pilot        |
| PRD: Tenant Onboarding | EV Platform | Operator sign-up, provisioning, and first station registration       |
| PRD: Charging Session  | EV Platform | Session lifecycle from OCPP handshake to billing record              |
| ForgeOS Product Spec   | ForgeOS     | Feature inventory and acceptance criteria per module                 |

---

## Related

- Organizational authority over product decisions: [`docs/company/FOUNDER_TEAM_CONSTITUTION.md`](../company/FOUNDER_TEAM_CONSTITUTION.md)
- UX specifications: [`docs/product/`](.) (UX specs will live here alongside PRDs)
- Technical implementation: [`docs/architecture/`](../architecture/)

_Owner: ATLAS | Coordination: ARGOS | MOVOS Product Atlas maintained by: VULCAN (recovery/baseline only — product decisions remain ATLAS/ARGOS authority)_
