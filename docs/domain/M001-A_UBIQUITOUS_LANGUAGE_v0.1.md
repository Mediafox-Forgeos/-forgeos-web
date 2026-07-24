# M001-A — Ubiquitous Language v0.1

**Mission:** M001-A — Domain Research (in progress, owned by ARGOS)
**Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db` · **Baseline:** [MOVOS Product Atlas v1.0](../product/MOVOS_PRODUCT_ATLAS_v1.0.md)
**Status:** v0.1 — recovery draft. No term below is renamed, merged, or deprecated by this document; classification is evidence-only.

## Classification legend

| Label            | Meaning                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- |
| **IMPLEMENTED**  | Present in executable code, database schema, API, or active UI                                                       |
| **DOCUMENTED**   | Present in formal documentation but not implemented                                                                  |
| **HISTORICAL**   | Used in an earlier product vision or a direction not carried forward                                                 |
| **FIXTURE-ONLY** | Present only in mock data, demos, seed data, or UI fixtures                                                          |
| **CANDIDATE**    | Proposed during M001-A, not yet approved — none in this v0.1 draft; this baseline only recovers, it does not propose |
| **ABSENT**       | Not found anywhere in the repository — included because the WO's recovery list named it                              |

Recommendation values: **preserve** (keep using the term as-is), **formalize** (promote from informal/fixture to a real spec), **deprecate later** (has a naming tension worth revisiting once the domain model exists), **unresolved** (genuinely needs an ARGOS decision — see [Open Decisions](./M001-A_OPEN_DECISIONS_v0.1.md)).

---

## Planning &amp; process terms

### Mission / Missions

- **Definition (evidence-based):** an internal, sequentially numbered unit of engineering/product work, tracked informally through commit messages and doc prose (`Mission 002` through `Mission 007A` observed). Not a database entity, not user-facing, not an agent/work-order concept in the WO-ARGOS sense — those are separate (`WO-*` identifiers in this session's own instructions never appear inside the repository itself).
- **Where it appears:** `git log` (`8c75f22`, "complete Mission 006"), `docs/architecture/MONOREPO.md`, `packages/core-domain/README.md`, `docs/product/MOVOS.md` ("Operational foundation (Mission 006)"), `docs/adr/README.md`, `README.md`.
- **Classification:** DOCUMENTED (informally, but consistently — no single registry file, yet every instance is mutually consistent in numbering and never contradicts another).
- **Relationships:** a Mission produces Capabilities and Documents; no Mission is itself a domain entity.
- **Conflicts / ambiguity:** none observed in usage — every reference to a Mission number is consistent with every other. The ambiguity is structural, not semantic: there is no single file listing all Missions, so the numbering had to be reconstructed from scattered references for this document.
- **Recommendation:** **formalize** — a single `docs/missions/` (or equivalent) registry would remove the reconstruction burden this document just performed. This is a documentation-infrastructure gap, not a terminology conflict.

### Capability / Capabilities

- **Definition (evidence-based):** an ordinary English word describing a feature area. Found exactly once as a proper-noun feature name — "Location Capability" (Mission 007A) — never applied systematically to other feature areas (Sites, Auth, etc. are never called "Site Capability" or "Auth Capability" anywhere in the repository).
- **Where it appears:** `docs/product/MOVOS.md` ("Google Maps Location Capability (Mission 007A)"), `docs/adr/ADR-0007-google-maps-location-capability.md`, `docs/architecture/MOVOS_LOCATION_CAPABILITY.md`.
- **Classification:** DOCUMENTED, single occurrence, informal.
- **Relationships:** none formal. Used descriptively, not structurally.
- **Conflicts / ambiguity:** **yes — this is the flagged Mission-vs-Capability question.** See [Terminology Evolution — Mission vs Capability](./M001-A_TERMINOLOGY_EVOLUTION_v0.1.md) for the full evidence-based analysis. Short answer: the two terms are not used interchangeably anywhere in the repository and do not currently conflict, because "Capability" has essentially one occurrence and "Mission" has many, consistent ones.
- **Recommendation:** **unresolved** — whether "Capability" should become the formal name for what a Mission produces (which is exactly how _this document's own governing work order_ uses it) is a real open question, not decidable from repository evidence alone. See [M001-A-DEC-001](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-001).

---

## Tenancy &amp; identity terms

### Organization

- **Definition (evidence-based):** the tenant boundary. A Prisma model (`schema.prisma`) with `name`, `slug`, `status`; owns Sites, Memberships, and AuditEvents. This is the actual multi-tenancy unit — every guarded API call resolves an `organizationId` and re-validates membership against it server-side.
- **Where it appears:** `apps/movos-api/prisma/schema.prisma`, `apps/movos-api/src/organizations/`, `apps/movos-api/src/guards/org-context.guard.ts`.
- **Classification:** IMPLEMENTED.
- **Relationships:** 1–N Membership, Site, AuditEvent.
- **Conflicts / ambiguity:** overlaps conceptually with Workspace and Tenant — see below.
- **Recommendation:** **preserve** — this is the real, working, tested tenancy boundary. Nothing about its implementation is in question.

### Workspace

- **Definition (evidence-based):** ForgeOS's own internal UI/organizational concept (the `(workspace)` route group in `apps/forgeos-web`). Not a MOVOS concept — no relationship to Organization, Site, or any MOVOS entity exists in code.
- **Where it appears:** `apps/forgeos-web/app/(workspace)/`, `docs/agents/`.
- **Classification:** IMPLEMENTED — but for a different product (ForgeOS), not MOVOS.
- **Relationships:** none with MOVOS's domain.
- **Conflicts / ambiguity:** the word "workspace" is a plausible synonym for "tenant" or "organization" in many SaaS products, which is exactly why it's worth naming here: **this codebase does not use it that way.** Anyone approaching M001-A with prior SaaS-modeling experience should not assume "Workspace" is available as a MOVOS tenancy term without checking — it's already claimed by a sibling product in this same repository.
- **Recommendation:** **preserve** the existing ForgeOS usage; **avoid** introducing "Workspace" as a MOVOS synonym for Organization to prevent cross-product confusion within one monorepo.

### Tenant

- **Definition (evidence-based):** in this codebase, "tenant" denotes the **white-label branding configuration**, not the tenancy database entity. `apps/movos-web/src/config/tenant.ts` exports a `tenant` object (`productName`, `orgName`, `accentColor`, `currency`, `locale`) and a `Tenant` TypeScript type. It is consumed for display/branding purposes (sidebar, settings), not for access control.
- **Where it appears:** `apps/movos-web/src/config/tenant.ts` and its consumers (`movos-sidebar.tsx`, `settings/page.tsx`, `dashboard/`), `docs/adr/ADR-0005-movos-commercial-platform.md`, `docs/adr/ADR-0006-movos-api-and-tenancy.md` (title uses "tenancy" for the access-control concept, which is actually implemented via Organization/Membership).
- **Classification:** IMPLEMENTED, narrow scope (branding only).
- **Relationships:** conceptually adjacent to Organization but not the same code path — Organization is the enforced access-control boundary; `tenant.ts` is a static config object with no database backing at all.
- **Conflicts / ambiguity:** **yes.** "Tenancy" (ADR-0006's own title) is implemented via `Organization`/`Membership`, while "Tenant" the noun is implemented as a branding config object. Two different code paths answer to related words. Not a bug — both are real and correct for what they each do — but worth naming explicitly so M001-A doesn't assume they're the same mechanism.
- **Recommendation:** **preserve** both as-is; **formalize** the distinction in writing (this entry does that) so a future engineer doesn't try to merge `tenant.ts` into the `Organization` model on the assumption they're duplicates.

### User

- **Definition (evidence-based):** an authenticated individual. Prisma model with `email`, `passwordHash`, `displayName`, `status`.
- **Where it appears:** `apps/movos-api/prisma/schema.prisma`, `apps/movos-api/src/auth/`.
- **Classification:** IMPLEMENTED.
- **Relationships:** 1–N Membership, RefreshSession, AuditEvent (as actor), Site (as `createdBy`).
- **Conflicts / ambiguity:** none. Distinct from the frontend's `/users` screen, which is entirely mock data describing team members with fields (`role: 'Administrador' | 'Operador' | ...`) that loosely mirror `MemberRole` but are a separate, unconnected TypeScript type (`apps/movos-web/src/types/user.ts`) — worth noting as a FIXTURE-ONLY shadow of the real IMPLEMENTED model, not a conflict in meaning.
- **Recommendation:** **preserve.**

### Membership

- **Definition (evidence-based):** the join entity between User and Organization, carrying `role` and `status`.
- **Where it appears:** `apps/movos-api/prisma/schema.prisma`, `apps/movos-api/src/guards/org-context.guard.ts`.
- **Classification:** IMPLEMENTED.
- **Relationships:** N–1 User, N–1 Organization. Unique on `[userId, organizationId]`.
- **Conflicts / ambiguity:** none.
- **Recommendation:** **preserve.**

### Role

- **Definition (evidence-based):** `MemberRole` enum — `OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER`. Only the first three are ever referenced in a `@Roles()` decorator anywhere in `apps/movos-api/src`.
- **Where it appears:** `schema.prisma`, `common/decorators/roles.decorator.ts`, `guards/roles.guard.ts`, `sites/sites.controller.ts`.
- **Classification:** IMPLEMENTED (mechanism), but three of six defined values have zero enforcement points.
- **Relationships:** attribute of Membership.
- **Conflicts / ambiguity:** the frontend's mock `/users` screen uses Spanish labels (`'Administrador' | 'Operador' | 'Soporte' | 'Analista' | 'Visualizador'`) that map 1:1 to five of the six `MemberRole` values (no Spanish label was found for `OWNER` specifically in that fixture) — consistent naming intent, disconnected implementation.
- **Recommendation:** **preserve** the enum; **unresolved** whether SUPPORT/ANALYST/VIEWER should gain real enforcement or be trimmed — this is a product-scope question, not something repository evidence alone can answer.

### Permission

- **Definition (evidence-based):** not a named entity or enum — "permission" describes the effect of `RolesGuard` + `OrgContextGuard` acting together. There is no `Permission` model, type, or table.
- **Where it appears:** enforced via `apps/movos-api/src/guards/{org-context,roles}.guard.ts`; discussed as a concept in `docs/architecture/MOVOS_PLATFORM_FOUNDATION.md`.
- **Classification:** IMPLEMENTED as a mechanism; DOCUMENTED as a named concept ("permission matrix" referenced in `README.md`); no such matrix file was found to exist.
- **Relationships:** derived from Role + resource + action, evaluated per-guard, not centrally modeled.
- **Conflicts / ambiguity:** `README.md` promises "the permission matrix" as if it's a concrete artifact; it isn't one — it's the guard logic itself, distributed across decorators.
- **Recommendation:** **formalize** — writing the actual permission matrix as a real table (which roles can do what, on which resources) would close a documentation gap `README.md` already implies exists.

### Operator

- **Definition (evidence-based):** used in prose to mean "the charging operator / tenant" — i.e., what Organization/Membership already implement. Not a separate entity.
- **Where it appears:** `docs/product/MOVOS.md`, `docs/architecture/MOVOS_PLATFORM_FOUNDATION.md`, product positioning copy ("multi-operator").
- **Classification:** DOCUMENTED concept, no separate implementation — it _is_ Organization under a different name in prose.
- **Relationships:** synonym-in-prose for Organization.
- **Conflicts / ambiguity:** using two words (Operator, Organization) for one implemented concept is a mild but real source of confusion for anyone reading docs and code side by side.
- **Recommendation:** **deprecate later** — once the domain model is formal, standardize on one term for external/product communication (likely "Operator," since it's the product-facing word used in positioning copy) versus internal implementation naming (`Organization`, which shouldn't change without a migration).

---

## Site &amp; physical-location terms

### Site

- **Definition (evidence-based):** a physical charging location. Prisma model with full CRUD, org-scoped, plus 10 Google-Places-enrichment fields.
- **Where it appears:** `schema.prisma`, `apps/movos-api/src/sites/`, `apps/movos-web/app/(app)/sites/`.
- **Classification:** IMPLEMENTED.
- **Relationships:** N–1 Organization, N–1 User (`createdBy`); would be the parent of Station once that exists.
- **Conflicts / ambiguity:** none.
- **Recommendation:** **preserve** — and treat as the template for how new EV-domain entities should be built (guards, DTOs, audit, presenter).

### Zone

- **Classification:** ABSENT. No type, mock data, or doc reference found anywhere (verified by direct grep across `apps/movos-api/src`, `apps/movos-web`, `docs/{product,architecture,adr}`).
- **Recommendation:** **unresolved** — if a Site can have sub-areas (a real operational need for large sites), "Zone" is an available, uncontested name; nothing in the repository claims it or conflicts with it.

### Asset

- **Classification:** ABSENT. Same verification as Zone.
- **Recommendation:** **unresolved** — a generic "Asset" abstraction (parent of Charger, and potentially other equipment) is architecturally tempting but is exactly the kind of "sounds architecturally cleaner" move this mission is instructed not to make without evidence. See [M001-A-DEC-004](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-004).

---

## Charging-infrastructure terms

### Charger

- **Definition (evidence-based):** a physical charging unit. Full TypeScript shape exists (`apps/movos-web/src/types/charger.ts`: vendor, model, serialNumber, firmwareVersion, ocppVersion, status) with hardcoded demo data (6 units, one `FAULTED`, vendors Kempower/ABB/Alpitronic).
- **Where it appears:** `apps/movos-web/src/types/charger.ts`, `src/data/chargers.ts`, `app/(app)/chargers/`.
- **Classification:** FIXTURE-ONLY.
- **Relationships (as designed in the frontend type, not yet in a schema):** N–1 Station, N–1 Site; 1–N Connector.
- **Conflicts / ambiguity:** none in current usage — "Charger" is the only term this codebase actually uses for the physical unit; "Charging Station" and "EVSE" (below) are absent, so there's no competing term to reconcile yet.
- **Recommendation:** **formalize** — this is priority #1 in the [MVP Gap Analysis](../product/MOVOS_MVP_GAP_ANALYSIS_v1.0.md); the frontend type is a ready-made starting point for the Prisma model.

### Charging Station

- **Classification:** ABSENT as an exact phrase. However, **"Station"** (without "Charging") is a distinct, already-used term: `apps/movos-web/src/types/station.ts`, `src/data/stations.ts`, `/stations` route — a grouping of Chargers at a Site, with its own status (`ONLINE/PARTIAL/MAINTENANCE/OFFLINE`) and computed `chargerCount`/`connectorCount`.
- **Classification (for "Station"):** FIXTURE-ONLY.
- **Relationships:** N–1 Site; 1–N Charger (as designed in the frontend type).
- **Conflicts / ambiguity:** the industry term "Charging Station" and this codebase's "Station" likely refer to the same concept, but the codebase has already made its choice (the shorter form) consistently across type, mock data, route, and UI copy. No internal conflict — only a note that external/OCPP-standard vocabulary uses the longer phrase.
- **Recommendation:** **preserve** the existing "Station" naming — it's already consistent everywhere it's used; renaming to "Charging Station" now would be change for its own sake, which this mission is explicitly told to avoid.

### EVSE

- **Classification:** ABSENT. Not found anywhere, including in OCPP-adjacent copy (Settings page says "OCPP 1.6J" but never "EVSE").
- **Recommendation:** **preserve absence** — the OCPP standard uses "EVSE" as a sub-unit of a Charging Station distinct from "Connector"; this codebase's existing three-tier shape (Station → Charger → Connector) does not currently have an EVSE tier. Introducing it is a real modeling question, not a naming formality — see [M001-A-DEC-005](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-005).

### Connector

- **Definition (evidence-based):** an individual physical connection point on a Charger. TypeScript type exists (`apps/movos-web/src/types/connector.ts`): label, type (`CCS2/Type2/CHAdeMO` observed in mock data), maxPowerKw, status, activeSessionId.
- **Where it appears:** `apps/movos-web/src/types/connector.ts`, `src/data/connectors.ts`, `app/(app)/connectors/`.
- **Classification:** FIXTURE-ONLY.
- **Relationships (as designed):** N–1 Charger; 0–1 active ChargingSession.
- **Conflicts / ambiguity:** none.
- **Recommendation:** **formalize** alongside Charger — see MVP Gap Analysis priority #1.

---

## Charging-activity terms

### Session

- **Classification: CONFLICT — two distinct implemented/fixture meanings share this word.**
  1. **`RefreshSession`** (IMPLEMENTED) — an authentication artifact: `tokenHash`, `expiresAt`, `revokedAt`, keyed to User. Nothing to do with charging.
  2. **`ChargingSession`** (FIXTURE-ONLY) — a charging event: `apps/movos-web/src/types/session.ts`, fields `siteId, stationId, chargerId, connectorId, userId, tariffId, status, startedAt, endedAt`. This is what the WO's "Session" recovery request refers to.
- **Where each appears:** `RefreshSession` in `schema.prisma` and `apps/movos-api/src/auth/`; `ChargingSession` (as the type `ChargingSession`, correctly disambiguated in its own type name already) in `apps/movos-web/src/types/session.ts`, `src/data/sessions.ts`, `app/(app)/sessions/`.
- **Recommendation:** **preserve** — the frontend type is already named `ChargingSession`, not bare `Session`, which pre-empts the collision. When this becomes a Prisma model, keep that same disambiguated name (`ChargingSession`, not `Session`) so it never collides with `RefreshSession` in generated Prisma Client types, imports, or documentation search.

### Transaction

- **Classification:** ABSENT from this repository. Noted for context, not as repository evidence: the OCPP 1.6/2.x protocol standard itself (external to this codebase) names its session-boundary messages `StartTransaction`/`StopTransaction` — relevant only once real OCPP integration begins, and not evidence of any current internal usage.
- **Recommendation:** **unresolved** — whether the eventual OCPP integration should surface "Transaction" as a protocol-level detail versus keeping "ChargingSession" as the sole product-facing term is a real design question for that later mission, not this one.

### Reservation

- **Classification:** ABSENT. Not found anywhere.
- **Recommendation:** **unresolved** — no evidence this is in scope at all; not even referenced in roadmap prose. A scope question, not a naming one.

### Tariff

- **Definition (evidence-based):** a pricing definition. TypeScript type + mock data: `name, currency, energyPricePerKwh, timePricePerMinute, sessionFee, applicableSiteIds, status`.
- **Where it appears:** `apps/movos-web/src/types/tariff.ts`, `src/data/tariffs.ts`, `app/(app)/tariffs/`.
- **Classification:** FIXTURE-ONLY.
- **Relationships (as designed):** applies to N Sites; would attach to ChargingSession for pricing.
- **Recommendation:** **formalize** — MVP Gap Analysis priority #3, alongside ChargingSession.

### Energy

- **Classification:** ABSENT as a domain entity. The only repository occurrences of the substring are inside "Kylum **Energy**" (the pilot customer's company name) — confirmed by direct inspection of every grep hit.
- **Recommendation:** **preserve absence** — no evidence of an "Energy" entity (e.g., metering/consumption records) being planned; if OCPP `MeterValues` handling is built later, that's where energy data would first appear, not before.

### Billing

- **Classification:** ABSENT — no type, no mock data, no doc reference beyond a single disabled field in the Settings screen ("Facturación: No conectado").
- **Recommendation:** **preserve as a later step** — depends on Tariff and ChargingSession maturing first; correctly placed last in the roadmap.

### Payment

- **Classification:** ABSENT. Not found anywhere, including inside the Billing stub.
- **Recommendation:** **unresolved** — Billing and Payment may be the same eventual capability or two distinct ones (pricing/invoicing vs. actual payment processing/PSP integration); repository evidence doesn't distinguish them because neither exists yet.

---

## Fleet-adjacent terms

### Vehicle

- **Classification:** ABSENT as a domain entity. The bare substring appears only inside "Electric **Vehicle**" in prose (product positioning copy), never as a type, model, or mock record.
- **Recommendation:** **unresolved, scope question** — see [M001-A-DEC-006-equivalent scope note]; MOVOS's own positioning is explicitly about charging _infrastructure_ operators, not fleet/vehicle owners. Treating Vehicle as in-scope would be an assumption, not a recovery.

### Driver

- **Classification:** ABSENT. Not found anywhere.
- **Recommendation:** **unresolved, scope question** — same reasoning as Vehicle.

### Fleet

- **Classification:** ABSENT. Not found anywhere — not even in roadmap prose or positioning copy (unlike Vehicle, which at least appears inside "Electric Vehicle").
- **Recommendation:** **unresolved, scope question** — of all 12 terms in the WO's recovery list that returned zero hits, Fleet has the least contextual presence of any of them. Recommend this be the first candidate ARGOS explicitly rules in or out, rather than left ambiguous alongside terms like Zone or Asset that at least have circumstantial architectural relevance.

---

## Operations terms

### Monitoring

- **Classification:** ABSENT as a named entity or feature. The _concept_ is partially covered by existing status fields (`SiteStatus`, `StationStatus`, `ConnectorStatus` all carry operational-state values), but no dedicated "Monitoring" module, screen, or type exists.
- **Recommendation:** **preserve absence as a named entity** — what exists today (status fields per entity) may be sufficient; a dedicated Monitoring capability would need its own justification once Charger/Connector are real and producing live status.

### Maintenance

- **Definition (evidence-based):** exists only as **a status value**, not a workflow or entity — `'MAINTENANCE'` inside the `SiteStatus` and `StationStatus` string unions, with a corresponding status-badge label ("Mantenimiento").
- **Where it appears:** `apps/movos-web/src/types/site.ts`, `types/station.ts`, `components/movos/status-badge.tsx`.
- **Classification:** FIXTURE-ONLY (as a state value; there is no maintenance _workflow_, ticket, or schedule anywhere).
- **Recommendation:** **preserve** the status value; **unresolved** whether a real Maintenance workflow (scheduling, tickets, history) is in scope — nothing currently implies it beyond the state label existing.

### Incident

- **Definition (evidence-based):** appears exactly once, as Spanish UI copy describing what the Alerts screen is for ("Incidentes operativos detectados en la red de carga") — not a distinct entity, type, or status value.
- **Where it appears:** `apps/movos-web/app/(app)/alerts/page.tsx`.
- **Classification:** FIXTURE-ONLY (descriptive copy only — thinner evidence than Maintenance, which at least has a real status value).
- **Recommendation:** **preserve** as descriptive language for what Alert already covers; no evidence "Incident" needs to be a separate entity from Alert.

### Notification

- **Definition (evidence-based):** exists only as two disabled fields in the Settings screen ("Correo: No configurado", "Webhook: No configurado") — no channel, no delivery mechanism, no data model.
- **Where it appears:** `apps/movos-web/app/(app)/settings/page.tsx`.
- **Classification:** FIXTURE-ONLY (thinnest possible evidence — a disabled form field, not even mock data).
- **Recommendation:** **preserve as a later step** — correctly sequenced after Alert in the roadmap, since Alert has to produce something to notify about first.

### Digital Twin

- **Classification:** ABSENT. Not found anywhere — no reference in code, docs, ADRs, or product positioning copy, despite "AI-native" being part of MOVOS's stated positioning.
- **Recommendation:** **unresolved, scope question** — of everything in the WO's recovery list, this has the least grounding of all (weaker than even Fleet, which at least sits adjacent to the product's stated domain). Recommend treating this as aspirational-only unless ARGOS has external context this repository doesn't contain.

---

## Additional terms found during recovery (not in the original list)

### Alert

- **Definition (evidence-based):** operational incident/warning record. Type + mock data exist: `title, description, severity, status, siteId, chargerId, createdAt, source`.
- **Where it appears:** `apps/movos-web/src/types/alert.ts`, `src/data/alerts.ts`, `app/(app)/alerts/`.
- **Classification:** FIXTURE-ONLY.
- **Recommendation:** **preserve** the name; already correctly sequenced in the roadmap after Charger/ChargingSession.

### EV Platform

- **Definition (evidence-based):** the internal ForgeOS program name for what became the commercial product MOVOS. See [Domain Inventory — terminology evolution](../product/MOVOS_DOMAIN_INVENTORY_v1.0.md).
- **Classification:** HISTORICAL as a product name (superseded by MOVOS, ADR-0005); still IMPLEMENTED as ForgeOS's internal program-tracking label (`projects/ev-platform`).
- **Recommendation:** **preserve** both uses — they don't conflict; one is a retired product name, the other is a live internal tracking label that happens to share it.

### ARGOS

- **Definition (evidence-based):** a UI-only orchestrator concept inside ForgeOS (`apps/forgeos-web/app/(workspace)/argos/`). Has no relationship to MOVOS's domain at all — zero imports, zero shared types, zero API calls between the two.
- **Classification:** IMPLEMENTED (as a UI simulation only); the real integration is Mission 004, itself Group C (started, then skipped) — see [Product Atlas](../product/MOVOS_PRODUCT_ATLAS_v1.0.md).
- **Recommendation:** **preserve** as ForgeOS-scoped; do not assume any dependency edge into MOVOS's domain model exists.
