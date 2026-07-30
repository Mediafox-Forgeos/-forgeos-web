# MOVOS Product Atlas v1.0

**Atlas version:** v1.0
**Generated:** 2026-07-24
**Updated:** 2026-07-27 — CAP-002 (WO-ARGOS-003) delivered CRUD-only backend for the charging core (`ChargingStation`/`Evse`/`Connector`).
**Updated:** 2026-07-28 — WO-ARGOS-004 connected that backend to a real, Site-scoped `apps/movos-web` UI. Still no OCPP, sessions, tariffs, reservations, or payments.
**Updated:** 2026-07-28 — WO-ARGOS-005: ARGOS ruled against org-wide list-all endpoints for ChargingStation/EVSE/Connector; `/stations`, `/chargers`, `/connectors` were retired (redirect or Site-selection gateway) so mock infrastructure no longer appears as live data anywhere; see inline notes below.
**Updated:** 2026-07-29 — WO-ARGOS-006: PR #22 merged; a known debt item (stale Sessions/Dashboard links into the retired mock charger routes) is now tracked in the [Product Debt Register](./MOVOS_PRODUCT_DEBT_REGISTER_v1.0.md) rather than left unrecorded. CAP-003 (OCPP)'s seven readiness blockers now have documented, unapproved recommendations in [CAP-003 OCPP Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) — OCPP implementation itself remains not started.
**Updated:** 2026-07-30 — WO-ARGOS-007: ARGOS approved all seven CAP-003 decisions; the full charging-ecosystem architecture (50 registered future capabilities, protocol coexistence, authorization, ChargingSession, device capability) is now documented — see the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md). A first, narrow OCPP vertical shipped: device identity/authentication, and OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` only, `SIMULATOR_VALIDATED`. No physical hardware tested, no charging sessions, no remote commands — see inline notes below.
**Repository HEAD:** `main` @ `bfea8db`
**Author:** VULCAN
**Source method:** Direct repository inspection (WO-ARGOS-001, persisted under WO-ARGOS-002) — no speculation, no redesign, no renamed concepts
**Companion documents:** [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md) · [Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md) · [Feature Matrix](./MOVOS_FEATURE_MATRIX_v1.0.md) · [Screen Inventory](./MOVOS_SCREEN_INVENTORY_v1.0.md) · [API Inventory](./MOVOS_API_INVENTORY_v1.0.md) · [Database Inventory](./MOVOS_DATABASE_INVENTORY_v1.0.md) · [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md) · [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md) · [Product Debt Register](./MOVOS_PRODUCT_DEBT_REGISTER_v1.0.md)

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

Organizations (read-only API, no management), Roles/Permissions (the enforcement mechanism is real and tested, but only exercised on one resource — Sites — and only 3 of 6 defined roles are ever checked), the white-label pattern (architecturally sound, proven with exactly one tenant, Kylum), the charging core: `ChargingStation`/`Evse`/`Connector` exist as real, tenant-isolated, audited database models with CRUD APIs, now connected to a real Site-scoped management UI (WO-ARGOS-004) — but with no charging sessions, and OCPP (CAP-003 / WO-ARGOS-007): a first, narrow protocol vertical is real and `SIMULATOR_VALIDATED` — device identity/authentication, connection registry, and OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` — but no `Authorize`/`StartTransaction`/`StopTransaction`, no remote commands, no charging sessions, and no functional OCPP 2.0.1 (boundary-only, every message explicitly rejected).

### What is missing?

`ChargingSession`, `Tariff`, and `Alert` still don't exist as database models. `ChargingStation`/`Evse`/`Connector` do exist as of CAP-002, and as of CAP-003 (WO-ARGOS-007) can identify, authenticate, and exchange a narrow set of OCPP 1.6J status messages with a real device — but there is still no session/tariff/billing logic, no RFID/authorization implementation, no remote-command capability, and no functional OCPP 2.0.1. Also missing entirely: Billing, real Notifications, Vehicles, Fleet, and any AI/ARGOS integration into MOVOS itself. Detail: [Database Inventory](./MOVOS_DATABASE_INVENTORY_v1.0.md).

### What was abandoned?

Nothing was started and left broken mid-build — the live product codebase has zero `TODO`/`FIXME` markers (verified by grep across `apps/movos-api/src` and `apps/movos-web`). What did happen: two missions (003 — core domain model, 004 — real ARGOS integration) were explicitly scheduled early, scaffolded or anticipated, then skipped over indefinitely while later missions (005, 006, 007A) shipped instead. Separately, two early implementation drafts (an early Mission 006 auth/tenancy commit, and an early Location Capability draft, both recovered from orphaned git worktrees in a prior session) were superseded by complete reimplementations that did ship — redone, not lost. Full account: [Domain Inventory §Terminology Evolution](./MOVOS_DOMAIN_INVENTORY_v1.0.md).

### Which concepts survived from the original vision?

The white-label principle and the "Kylum is a pilot, not the owner" boundary (ADR-0002, ADR-0003) survive exactly as first written, now enforced in code. The four-phase roadmap recorded as UI fixture data on day one — **Foundation → Core Platform → OCPP → Pilot** (`apps/forgeos-web/data/roadmap.ts`) — still accurately describes where the product sits today. "EV Platform" survives as ForgeOS's internal program name; the commercial product itself was renamed MOVOS via ADR-0005.

### What is the fastest path to a production MVP?

The Sites pattern (guards, DTOs, audit, presenters) has now been reused twice — first for Sites, then for CAP-002's `ChargingStation` → `Evse` → `Connector`; WO-ARGOS-004 reused the Sites frontend pattern (client-fetched pages, `apiClient`, status badges, create modals) the same way to connect it to the UI. OCPP was deliberately sequenced as its own step, not folded into charging-core CRUD, because it had no existing architectural precedent to reuse — CAP-003 (WO-ARGOS-007) has now built that precedent (protocol adapter pattern, normalized event vocabulary, connection registry) and proven it against the first vertical (Boot/Heartbeat/Status). Next: `Authorize`/`StartTransaction`/`StopTransaction` and a real `ChargingSession` model, then expose the User/Membership models that already exist in the database, then Tariff. Full detail: [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md), [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md).

---

## Implementation status — four groups

Every capability discovered in this repository, sorted into exactly the four groups this baseline requires. "Abandoned" is used precisely — see Group C's note.

### Group A — Fully Implemented (3)

Production-grade: real database models, tested services, guarded APIs, and a connected UI.

- **Authentication** — `apps/movos-api/src/auth/`
- **Sites** — `apps/movos-api/src/sites/`, `apps/movos-web/app/(app)/sites/`
- **Location** — `apps/movos-api/src/location/`, `apps/movos-web/src/components/location/`

### Group B — Partially Implemented (6)

Real backend mechanism exists and is tested, but coverage or scope is incomplete.

- **Organizations** — `apps/movos-api/src/organizations/` (list-only, no create/update/membership API)
- **Roles** — `MemberRole` enum in `schema.prisma` (3 of 6 values ever enforced in `@Roles()` decorators)
- **Permissions** — `OrgContextGuard` + `RolesGuard` (proven pattern, exercised on Sites only)
- **White Label** — `apps/movos-web/src/config/tenant.ts` (sound architecture, one tenant ever tested)
- **Charging Core (CAP-002 + WO-ARGOS-004)** — `apps/movos-api/src/{charging-stations,evses,connectors}/` (real, tenant-isolated, audited CRUD) and `apps/movos-web/app/(app)/sites/[siteId]/charging-stations/` (real, Site-scoped management UI); no sessions
- **OCPP (CAP-003 + WO-ARGOS-007)** — `apps/movos-api/src/ocpp/` (device identity/authentication, in-memory connection registry, OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification`, `SIMULATOR_VALIDATED`); no `Authorize`/`StartTransaction`/`StopTransaction`, no remote commands, no RFID, no functional 2.0.1, no physical hardware tested — see [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md)

### Group C — Started, Then Skipped (2 missions)

Explicitly scheduled and scaffolded, then bypassed indefinitely while later missions shipped instead. This is evidence of _deferral past the planned point in the sequence_, not of broken or orphaned code — no partial implementation exists to point to for either.

- **Mission 003 — real domain model** — `packages/core-domain/` still contains only a one-line placeholder (`export const coreDomainStatus = 'Reserved for Mission 003 domain implementation'`), unimported anywhere in the workspace, unchanged since Mission 002.
- **Mission 004 — real ARGOS AI integration** — the ARGOS command-center UI has existed since day one (`apps/forgeos-web/app/(workspace)/argos/`) and is explicitly documented as "UI simulation; real integration is Mission 004" (`docs/agents/README.md`). It has never been wired to any model, tool, or service.

### Group D — Only Documented / Not Started (9 capabilities)

Named in roadmap docs and/or represented as TypeScript types with hardcoded demo data in the frontend, but zero backend: no database model, no API, no real logic. A minority (Billing, Vehicles, Fleet) don't even have that — no code artifact of any kind exists for them anywhere in this repository.

Sessions · Tariffs · Alerts · Reporting · Users (team management — the underlying `User`/`Membership` models exist, but no API exposes them for this purpose) · Notifications · `packages/ui` (scaffolded, zero consumers) · Billing (no artifact at all) · Vehicles / Fleet (no artifact at all — these terms never entered this codebase's vocabulary; see Domain Inventory)

OCPP graduated to Group B as of CAP-003 (WO-ARGOS-007) — see above. The 50-capability [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) now tracks everything still deferred within OCPP/charging/authorization/sessions in more granular detail than this four-group summary; treat that document as authoritative for OCPP-adjacent scope, this Atlas as the coarse product-level view.

Chargers (as `Station`/`Charger`/`Connector` frontend types) graduated to Group B as of CAP-002 — see above. As of WO-ARGOS-004, the _real_ entities (`ApiChargingStation`/`ApiEvse`/`ApiConnector`) have their own connected UI under `/sites/[id]/charging-stations/...`. The original demo type files (`src/types/{station,charger,connector}.ts`) and their mock data fixtures (`src/data/{stations,chargers,connectors}.ts`) remain unchanged — but as of WO-ARGOS-005, the routes that used to render them (`/stations`, `/chargers`, `/chargers/[id]`, `/connectors`) no longer do: `/stations` redirects to `/sites`, `/chargers` and `/connectors` are real Site-selection gateways, and `/chargers/[id]` redirects to `/chargers`. No org-wide list endpoint was built — ARGOS confirmed this is a deliberate, permanent scope decision, not a temporary gap.

---

## Weighted MVP completion: ~32% (pre-CAP-002 figure — not yet recomputed)

Capability-weighted, not line-of-code-weighted. Full calculation and methodology: [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md), which this update does not recompute — that document is out of CAP-002's and CAP-003's scope. The figure above predates CAP-002; Charging Core has moved from Group D to Group B (CRUD backend only, no frontend, no sessions), and OCPP has also moved from Group D to Group B as of CAP-003 (device identity/auth and a first Boot/Heartbeat/Status vertical only, `SIMULATOR_VALIDATED`), so the true weighted figure is now somewhat higher — but not by the full weight originally assigned to either item, since neither Chargers nor OCPP is complete, and Sessions (the other large-weight item) remains entirely in Group D.
