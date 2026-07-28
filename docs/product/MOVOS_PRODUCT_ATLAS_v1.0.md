# MOVOS Product Atlas v1.0

**Atlas version:** v1.0
**Generated:** 2026-07-24
**Updated:** 2026-07-27 — CAP-002 (WO-ARGOS-003) delivered CRUD-only backend for the charging core (`ChargingStation`/`Evse`/`Connector`); see inline notes below. Frontend is not yet migrated to consume it.
**Repository HEAD:** `main` @ `bfea8db`
**Author:** VULCAN
**Source method:** Direct repository inspection (WO-ARGOS-001, persisted under WO-ARGOS-002) — no speculation, no redesign, no renamed concepts
**Companion documents:** [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md) · [Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md) · [Feature Matrix](./MOVOS_FEATURE_MATRIX_v1.0.md) · [Screen Inventory](./MOVOS_SCREEN_INVENTORY_v1.0.md) · [API Inventory](./MOVOS_API_INVENTORY_v1.0.md) · [Database Inventory](./MOVOS_DATABASE_INVENTORY_v1.0.md) · [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md) · [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md)

This is the official product baseline for MOVOS. From this point forward, product decisions start here. It supersedes [`docs/audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md`](../audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md) as the _product_ source of truth — that document is preserved as a historical record, not replaced or deleted, and its conclusions remain accurate (verified against current `main`, see its own updated header).

---

## What MOVOS is

**MOVOS (Mobility Operating System)** is the commercial, white-label SaaS platform for electric-vehicle charging infrastructure management, owned and built by MediaFOX Forge. Its stated positioning is API-first, multi-tenant, multi-operator, multi-language, multi-currency, and AI-native (`docs/product/MOVOS.md`) — that is the product's own ambition, not a description of what is built; see the Feature Matrix for what of it is real today.

**Kylum Energy** is the first pilot customer and consumes MOVOS as a tenant; it does not own the product (ADR-0002, ADR-0003). That boundary is enforced in code, not just policy: all Kylum-specific branding lives in one file (`apps/movos-web/src/config/tenant.ts`), and every visible screen carries a "Datos de demostración" / "Entorno piloto" marker until real data replaces it.

Inside ForgeOS (the internal engineering/AI workspace this repository also hosts), MOVOS is tracked as the **EV Platform** program — the program name predates the product name and is still how ForgeOS itself refers to it (`projects/ev-platform` — see the [Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md) for the full naming history).

---

## Six questions this Atlas must answer

### What already exists?

Authentication (full lifecycle, tested), multi-tenancy (org-scoped, DB-revalidated per request), and Sites — including Google-assisted Location — as a complete CRUD vertical with audit logging. These three are the only capabilities that are genuinely production-grade today. Detail: [Feature Matrix](./MOVOS_FEATURE_MATRIX_v1.0.md).

### What is partially built?

Organizations (read-only API, no management), Roles/Permissions (the enforcement mechanism is real and tested, but only exercised on one resource — Sites — and only 3 of 6 defined roles are ever checked), the white-label pattern (architecturally sound, proven with exactly one tenant, Kylum), and — as of CAP-002 — the charging core: `ChargingStation`/`Evse`/`Connector` exist as real, tenant-isolated, audited database models with CRUD APIs, but with no OCPP communication, no charging sessions, and no connected frontend yet.

### What is missing?

`ChargingSession`, `Tariff`, and `Alert` still don't exist as database models. `ChargingStation`/`Evse`/`Connector` do exist as of CAP-002, but only as CRUD — no OCPP protocol handling, no live device communication, no session/tariff/billing logic. Also missing entirely: Billing, real Notifications, Vehicles, Fleet, and any AI/ARGOS integration into MOVOS itself. Detail: [Database Inventory](./MOVOS_DATABASE_INVENTORY_v1.0.md).

### What was abandoned?

Nothing was started and left broken mid-build — the live product codebase has zero `TODO`/`FIXME` markers (verified by grep across `apps/movos-api/src` and `apps/movos-web`). What did happen: two missions (003 — core domain model, 004 — real ARGOS integration) were explicitly scheduled early, scaffolded or anticipated, then skipped over indefinitely while later missions (005, 006, 007A) shipped instead. Separately, two early implementation drafts (an early Mission 006 auth/tenancy commit, and an early Location Capability draft, both recovered from orphaned git worktrees in a prior session) were superseded by complete reimplementations that did ship — redone, not lost. Full account: [Domain Inventory §Terminology Evolution](./MOVOS_DOMAIN_INVENTORY_v1.0.md).

### Which concepts survived from the original vision?

The white-label principle and the "Kylum is a pilot, not the owner" boundary (ADR-0002, ADR-0003) survive exactly as first written, now enforced in code. The four-phase roadmap recorded as UI fixture data on day one — **Foundation → Core Platform → OCPP → Pilot** (`apps/forgeos-web/data/roadmap.ts`) — still accurately describes where the product sits today. "EV Platform" survives as ForgeOS's internal program name; the commercial product itself was renamed MOVOS via ADR-0005.

### What is the fastest path to a production MVP?

The Sites pattern (guards, DTOs, audit, presenters) has now been reused twice — first for Sites, then for CAP-002's `ChargingStation` → `Evse` → `Connector`. Next: expose the User/Membership models that already exist in the database, then ChargingSession + Tariff. OCPP is deliberately sequenced as its own step, not folded into charging-core CRUD, because it is the one piece with no existing architectural precedent to reuse. Full detail: [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md), [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md).

---

## Implementation status — four groups

Every capability discovered in this repository, sorted into exactly the four groups this baseline requires. "Abandoned" is used precisely — see Group C's note.

### Group A — Fully Implemented (3)

Production-grade: real database models, tested services, guarded APIs, and a connected UI.

- **Authentication** — `apps/movos-api/src/auth/`
- **Sites** — `apps/movos-api/src/sites/`, `apps/movos-web/app/(app)/sites/`
- **Location** — `apps/movos-api/src/location/`, `apps/movos-web/src/components/location/`

### Group B — Partially Implemented (5)

Real backend mechanism exists and is tested, but coverage or scope is incomplete.

- **Organizations** — `apps/movos-api/src/organizations/` (list-only, no create/update/membership API)
- **Roles** — `MemberRole` enum in `schema.prisma` (3 of 6 values ever enforced in `@Roles()` decorators)
- **Permissions** — `OrgContextGuard` + `RolesGuard` (proven pattern, exercised on Sites only)
- **White Label** — `apps/movos-web/src/config/tenant.ts` (sound architecture, one tenant ever tested)
- **Charging Core (CAP-002)** — `apps/movos-api/src/{charging-stations,evses,connectors}/` (real, tenant-isolated, audited CRUD; no OCPP, no sessions, no connected frontend yet)

### Group C — Started, Then Skipped (2 missions)

Explicitly scheduled and scaffolded, then bypassed indefinitely while later missions shipped instead. This is evidence of _deferral past the planned point in the sequence_, not of broken or orphaned code — no partial implementation exists to point to for either.

- **Mission 003 — real domain model** — `packages/core-domain/` still contains only a one-line placeholder (`export const coreDomainStatus = 'Reserved for Mission 003 domain implementation'`), unimported anywhere in the workspace, unchanged since Mission 002.
- **Mission 004 — real ARGOS AI integration** — the ARGOS command-center UI has existed since day one (`apps/forgeos-web/app/(workspace)/argos/`) and is explicitly documented as "UI simulation; real integration is Mission 004" (`docs/agents/README.md`). It has never been wired to any model, tool, or service.

### Group D — Only Documented / Not Started (10 capabilities)

Named in roadmap docs and/or represented as TypeScript types with hardcoded demo data in the frontend, but zero backend: no database model, no API, no real logic. A minority (Billing, Vehicles, Fleet) don't even have that — no code artifact of any kind exists for them anywhere in this repository.

OCPP · Sessions · Tariffs · Alerts · Reporting · Users (team management — the underlying `User`/`Membership` models exist, but no API exposes them for this purpose) · Notifications · `packages/ui` (scaffolded, zero consumers) · Billing (no artifact at all) · Vehicles / Fleet (no artifact at all — these terms never entered this codebase's vocabulary; see Domain Inventory)

Chargers (as `Station`/`Charger`/`Connector` frontend types) graduated to Group B as of CAP-002 — see above. The frontend types themselves remain unconnected demo fixtures; only the backend moved.

---

## Weighted MVP completion: ~32% (pre-CAP-002 figure — not yet recomputed)

Capability-weighted, not line-of-code-weighted. Full calculation and methodology: [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md), which this update does not recompute — that document is out of CAP-002's scope. The figure above predates CAP-002; Charging Core has moved from Group D to Group B (CRUD backend only, no frontend, no OCPP, no sessions), so the true weighted figure is now somewhat higher, but not by the full weight originally assigned to "Chargers" — OCPP and Sessions, the other two largest-weight items, remain entirely in Group D.
