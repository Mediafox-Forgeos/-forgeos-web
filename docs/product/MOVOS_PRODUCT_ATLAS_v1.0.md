# MOVOS Product Atlas v1.0

**Atlas version:** v1.0
**Generated:** 2026-07-24
**Updated:** 2026-07-27 — CAP-002 (WO-ARGOS-003) delivered CRUD-only backend for the charging core (`ChargingStation`/`Evse`/`Connector`).
**Updated:** 2026-07-28 — WO-ARGOS-004 connected that backend to a real, Site-scoped `apps/movos-web` UI. Still no OCPP, sessions, tariffs, reservations, or payments.
**Updated:** 2026-07-28 — WO-ARGOS-005: ARGOS ruled against org-wide list-all endpoints for ChargingStation/EVSE/Connector; `/stations`, `/chargers`, `/connectors` were retired (redirect or Site-selection gateway) so mock infrastructure no longer appears as live data anywhere; see inline notes below.
**Updated:** 2026-07-29 — WO-ARGOS-006: PR #22 merged; a known debt item (stale Sessions/Dashboard links into the retired mock charger routes) is now tracked in the [Product Debt Register](./MOVOS_PRODUCT_DEBT_REGISTER_v1.0.md) rather than left unrecorded. CAP-003 (OCPP)'s seven readiness blockers now have documented, unapproved recommendations in [CAP-003 OCPP Architecture Decisions](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md) — OCPP implementation itself remains not started.
**Updated:** 2026-07-30 — WO-ARGOS-007: ARGOS approved all seven CAP-003 decisions; the full charging-ecosystem architecture (50 registered future capabilities, protocol coexistence, authorization, ChargingSession, device capability) is now documented — see the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md). A first, narrow OCPP vertical shipped: device identity/authentication, and OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` only. No physical hardware tested, no charging sessions, no remote commands — see inline notes below.
**Updated:** 2026-07-31 — WO-ARGOS-008: the `SIMULATOR_VALIDATED` label used throughout this Atlas for that first OCPP vertical was earned by this work order, not WO-ARGOS-007 — a real compiled `apps/movos-api` instance was booted against a real local PostgreSQL database and exercised over a real WebSocket connection by the repository simulator across 12 scenarios (valid/invalid auth, Boot/Heartbeat/Status, duplicate connections, reconnects, malformed frames, 2.0.1 detection). Full evidence: [CAP-003 Architecture Decisions — WO-ARGOS-008 Runtime Validation Record](../domain/CAP-003_OCPP_ARCHITECTURE_DECISIONS_v0.1.md#wo-argos-008-runtime-validation-record-2026-07-31). Also added: real automated test coverage for the WebSocket transport class and the connection-registry stale-sweep, both previously untested.
**Updated:** 2026-07-31 — WO-ARGOS-009 (CAP-004): the business layer above OCPP shipped — `ChargingSession`, `AuthorizationCredential`, `AuthorizationAttempt`, `MeterValue` Prisma models; `Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction` now handled for OCPP 1.6J; a validated session-lifecycle state machine; read APIs (`/sessions`, `/credentials`, `/authorization-attempts`) and write APIs for credentials. MOVOS can now answer who/when/where/how-much/why for a charging session. Still no billing, tariffs, payments, reservations, RFID-specific logic, `Driver`/`Vehicle`/`Fleet` models, or OCPP 2.0.1 functional support — see the [CAP-004 Charging Sessions Foundation](../domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md) doc and inline notes below.
**Updated:** 2026-08-01 — WO-ARGOS-009A validated 5 architectural concerns ARGOS raised against the merged-pending PR (protocolTransactionId's composite uniqueness scope, MeterValue's index — verified with real `EXPLAIN` evidence at 100K/1M/10M synthetic rows, ~126×–554× speedup, — AuthorizationAttempt's survive-credential-deletion guarantee, telemetry independence — proven live with zero MeterValues messages and a database-level rejection of negative energy — and produced two forward-looking recommendations, [DEC-017 offline policy](../domain/DEC-017_OFFLINE_POLICY.md) and [DEC-018 billing boundary](../domain/DEC-018_BILLING_BOUNDARY_ANALYSIS.md), neither implemented). PR #25 merged to `main` at `46206f259ce6dd6ec0bb31a42f1f4a4d11451447`, tagged `CAP-004_COMPLETE`. Real live-database/real-WebSocket validation now exists for CAP-004 beyond unit tests (Authorize/StartTransaction/MeterValues/StopTransaction including a rejected-credential case, an idempotent retransmit, and the zero-telemetry scenario above) — narrower in scenario coverage than CAP-003's dedicated 12-scenario validation pass (WO-ARGOS-008), but no longer "unit-tested only" as earlier stated.
**Updated:** 2026-08-02 — WO-ARGOS-010: PR #26 (CAP-004 post-merge docs) merged to `main` at `94b867dda6c55229d70e435cbe2de91d9d31e353`. DEC-017 approved (RECOMMENDATION → ACCEPTED). CAP-005 (Connectivity Engine) built on branch `feat/cap-005-connectivity-engine`: `ChargingStation` gains `connectivityStatus`/`lastConnectedAt`/`lastDisconnectedAt`/`lastSeenAt`/`lastProtocolVersion`; `ConnectivityCoordinator` wires `ConnectionRegistryService` (CAP-003) to `SessionLifecycleService` (CAP-004) for the first time — a stale-detected connection now moves an `ACTIVE`/`SUSPENDED` session to `OFFLINE`, and a verified reconnect within a 15-minute window recovers it. Real-boot/real-Postgres/real-WebSocket validated (connect → ONLINE, idle past the real 5-minute stale threshold → station and session both OFFLINE, reconnect with the same transaction → session recovered, exactly one session throughout). See [CAP-005 Connectivity Engine](../domain/CAP-005_CONNECTIVITY_ENGINE.md). Still no RFID-specific logic, billing, remote start/stop, or OCPP 2.0.1 functional support — see inline notes below and the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md).
**Updated:** 2026-08-03 — WO-ARGOS-016/016A (CAP-008, documentation only): PR #32 merged to `main` at `2cbd5ddabed54feafa63b229343d7090aa706aab`, tagged `CAP-008_ARCHITECTURE_COMPLETE`. Billing's domain model is now fully specified — billable entities, tariff-timing semantics, ownership chain, billing events ([CAP-008_BILLING_MODEL.md](../domain/CAP-008_BILLING_MODEL.md)); a 7-threat financial-integrity threat model ([CAP-008_BILLING_THREAT_MODEL.md](../reviews/CAP-008_BILLING_THREAT_MODEL.md)); 5 deployment-shape + 2 timing-edge-case validations ([CAP-008_SCENARIOS.md](../reviews/CAP-008_SCENARIOS.md)); a tariff-model decision (Option C, snapshot-on-boundary — [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md)); and a canonical debt-owner decision (`BillingAccount`, a new concept not yet built — [CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md)). **No code was written.** No `Tariff`/`TariffSnapshot`/`Invoice`/`Payment`/`BillingAccount` model exists yet — see CAP-009 (registered, not started) in the [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md).

**Repository HEAD:** `main` @ `2cbd5ddabed54feafa63b229343d7090aa706aab` (PR #32, CAP-008 billing-foundation architecture docs) — corrected 2026-08-03 (WO-ARGOS-016A post-merge); previously `94b867d` (WO-ARGOS-010 Phase 1). CAP-005 is merged and reflected in this HEAD (it landed via PR #27 between the two updates above).
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

Organizations (read-only API, no management), Roles/Permissions (the enforcement mechanism is real and tested, but only exercised on one resource — Sites — and only 3 of 6 defined roles are ever checked), the white-label pattern (architecturally sound, proven with exactly one tenant, Kylum), the charging core: `ChargingStation`/`Evse`/`Connector` exist as real, tenant-isolated, audited database models with CRUD APIs, now connected to a real Site-scoped management UI (WO-ARGOS-004), OCPP (CAP-003 / WO-ARGOS-007): a first, narrow protocol vertical is real and `SIMULATOR_VALIDATED` — device identity/authentication, connection registry, and OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification` — and Charging Sessions & Authorization (CAP-004 / WO-ARGOS-009): `ChargingSession`/`AuthorizationCredential`/`AuthorizationAttempt`/`MeterValue` now exist as real database models, and `Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction` are handled for OCPP 1.6J — but no billing, tariffs, payments, reservations, RFID-specific logic, remote commands, `Driver`/`Vehicle`/`Fleet` models, and no functional OCPP 2.0.1 (boundary-only, every message explicitly rejected).

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

### Group B — Partially Implemented (7)

Real backend mechanism exists and is tested, but coverage or scope is incomplete.

- **Organizations** — `apps/movos-api/src/organizations/` (list-only, no create/update/membership API)
- **Roles** — `MemberRole` enum in `schema.prisma` (3 of 6 values ever enforced in `@Roles()` decorators)
- **Permissions** — `OrgContextGuard` + `RolesGuard` (proven pattern, exercised on Sites only)
- **White Label** — `apps/movos-web/src/config/tenant.ts` (sound architecture, one tenant ever tested)
- **Charging Core (CAP-002 + WO-ARGOS-004)** — `apps/movos-api/src/{charging-stations,evses,connectors}/` (real, tenant-isolated, audited CRUD) and `apps/movos-web/app/(app)/sites/[siteId]/charging-stations/` (real, Site-scoped management UI)
- **OCPP (CAP-003 + WO-ARGOS-007)** — `apps/movos-api/src/ocpp/` (device identity/authentication, in-memory connection registry, OCPP 1.6J `BootNotification`/`Heartbeat`/`StatusNotification`, `SIMULATOR_VALIDATED`); no remote commands, no functional 2.0.1, no physical hardware tested — see [OCPP Engine Guide](../engineering/OCPP_ENGINE_GUIDE.md)
- **Charging Sessions & Authorization (CAP-004 + WO-ARGOS-009/009A)** — `apps/movos-api/src/{sessions,authorization}/` (real `ChargingSession`/`AuthorizationCredential`/`AuthorizationAttempt`/`MeterValue` models, validated session-lifecycle state machine, `Authorize`/`StartTransaction`/`MeterValues`/`StopTransaction` handled for 1.6J, read + credential-write APIs, live-database/real-WebSocket validated for the core flow including zero-telemetry and rejected-credential cases); no billing/tariffs/payments/reservations, no RFID-specific logic, no `Driver`/`Vehicle`/`Fleet` models — see [Charging Session Guide](../engineering/CHARGING_SESSION_GUIDE.md)
- **Connectivity (CAP-005 + WO-ARGOS-010)** — `apps/movos-api/src/ocpp/connectivity/` (real `ConnectivityCoordinator`, persisted `ChargingStation` connectivity fields, real-boot/real-Postgres/real-WebSocket validated stale-detection and reconnect-recovery flow); the OFFLINE-transition auto-trigger noted as missing in earlier updates is now wired, per DEC-017 (ACCEPTED) — see [CAP-005 Connectivity Engine](../domain/CAP-005_CONNECTIVITY_ENGINE.md). A clean (non-stale) disconnect still does not move a session to OFFLINE — a documented, deliberate limitation, not an oversight.

### Group C — Started, Then Skipped (2 missions)

Explicitly scheduled and scaffolded, then bypassed indefinitely while later missions shipped instead. This is evidence of _deferral past the planned point in the sequence_, not of broken or orphaned code — no partial implementation exists to point to for either.

- **Mission 003 — real domain model** — `packages/core-domain/` still contains only a one-line placeholder (`export const coreDomainStatus = 'Reserved for Mission 003 domain implementation'`), unimported anywhere in the workspace, unchanged since Mission 002.
- **Mission 004 — real ARGOS AI integration** — the ARGOS command-center UI has existed since day one (`apps/forgeos-web/app/(workspace)/argos/`) and is explicitly documented as "UI simulation; real integration is Mission 004" (`docs/agents/README.md`). It has never been wired to any model, tool, or service.

### Group D — Only Documented / Not Started (8 capabilities)

Named in roadmap docs and/or represented as TypeScript types with hardcoded demo data in the frontend, but zero backend: no database model, no API, no real logic. A minority (Vehicles, Fleet) don't even have that — no code or documentation artifact of any kind exists for them anywhere in this repository.

Tariffs · Alerts · Reporting · Users (team management — the underlying `User`/`Membership` models exist, but no API exposes them for this purpose) · Notifications · `packages/ui` (scaffolded, zero consumers) · **Billing — architecture fully documented, zero implementation** (CAP-008, WO-ARGOS-016/016A: domain model, threat model, deployment-scenario validation, tariff-timing decision, and canonical debt-owner decision (`BillingAccount`) all exist as reviewed, ARGOS-approved documentation — see [CAP-008_DECISION.md](../domain/CAP-008_DECISION.md)/[CAP-008_DEBT_OWNERSHIP.md](../domain/CAP-008_DEBT_OWNERSHIP.md); no `Tariff`/`TariffSnapshot`/`Invoice`/`Payment`/`BillingAccount` model, API, or UI exists — that is CAP-009, registered but not started) · Vehicles / Fleet (no artifact at all — these terms never entered this codebase's vocabulary beyond CAP-008's evaluation of `Vehicle`/`Fleet` as debt-owner candidates, which rejected both; see Domain Inventory)

OCPP graduated to Group B as of CAP-003 (WO-ARGOS-007) — see above. Sessions graduated to Group B as of CAP-004 (WO-ARGOS-009), as `ChargingSession` — see above; the frontend's mock `session`/`sessions` type/routes remain unmigrated to the real API (a frontend-integration gap, not a backend one). The 50-capability [Architecture Backlog](../architecture/MOVOS_ARCHITECTURE_BACKLOG_v1.0.md) now tracks everything still deferred within OCPP/charging/authorization/sessions in more granular detail than this four-group summary; treat that document as authoritative for OCPP-adjacent scope, this Atlas as the coarse product-level view.

Chargers (as `Station`/`Charger`/`Connector` frontend types) graduated to Group B as of CAP-002 — see above. As of WO-ARGOS-004, the _real_ entities (`ApiChargingStation`/`ApiEvse`/`ApiConnector`) have their own connected UI under `/sites/[id]/charging-stations/...`. The original demo type files (`src/types/{station,charger,connector}.ts`) and their mock data fixtures (`src/data/{stations,chargers,connectors}.ts`) remain unchanged — but as of WO-ARGOS-005, the routes that used to render them (`/stations`, `/chargers`, `/chargers/[id]`, `/connectors`) no longer do: `/stations` redirects to `/sites`, `/chargers` and `/connectors` are real Site-selection gateways, and `/chargers/[id]` redirects to `/chargers`. No org-wide list endpoint was built — ARGOS confirmed this is a deliberate, permanent scope decision, not a temporary gap.

---

## Weighted MVP completion: ~32% (pre-CAP-002 figure — not yet recomputed)

Capability-weighted, not line-of-code-weighted. Full calculation and methodology: [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md), which this update does not recompute — that document is out of CAP-002's and CAP-003's scope. The figure above predates CAP-002; Charging Core has moved from Group D to Group B (CRUD backend only, no frontend, no sessions), and OCPP has also moved from Group D to Group B as of CAP-003 (device identity/auth and a first Boot/Heartbeat/Status vertical only, `SIMULATOR_VALIDATED`), so the true weighted figure is now somewhat higher — but not by the full weight originally assigned to either item, since neither Chargers nor OCPP is complete, and Sessions (the other large-weight item) remains entirely in Group D.
