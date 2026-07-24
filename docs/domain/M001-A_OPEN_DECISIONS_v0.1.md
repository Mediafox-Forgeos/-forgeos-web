# M001-A — Open Decisions Register v0.1

**Mission:** M001-A — Domain Research (in progress, owned by ARGOS)
**Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db` · **Baseline:** [MOVOS Product Atlas v1.0](../product/MOVOS_PRODUCT_ATLAS_v1.0.md)

None of these decisions are approved by this document. Per this mission's own rule, a recommendation is only stated where repository evidence already establishes one; everything else is marked "no evidence-backed recommendation" rather than filled in with an architectural preference.

---

### M001-A-DEC-001 — Mission vs Capability

- **Question:** Does "Capability" describe the same concept as "Mission," a different concept, or a not-yet-formalized successor term?
- **Existing evidence:** Mission is a consistently-used internal execution unit (6+ instances, `git log` + docs). "Capability" occurs exactly once in the repository, describing one shipped feature ("Location Capability"). This session's own governing work orders use "Capability" extensively and structurally — but that usage lives in the conversation, not in any committed file, and cannot count as repository evidence. Full analysis: [Terminology Evolution](./M001-A_TERMINOLOGY_EVOLUTION_v0.1.md).
- **Available options:** (a) treat Mission = unit of work, Capability = resulting feature — two complementary terms; (b) deprecate "Mission" in favor of "Capability" going forward; (c) deprecate the informal "Capability" usage and keep "Mission" as the only planning term; (d) leave both informal indefinitely.
- **Impact:** Affects how all future planning documents, roadmaps, and this Atlas's own successors are titled and organized.
- **Recommended option:** (a) — this is the only reading consistent with all observed evidence without contradiction, but it is an _inference_, not a fact the repository states outright. Flagged for approval, not asserted as settled.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking** — does not prevent Phase 2 domain modeling from proceeding under either term.

### M001-A-DEC-002 — Organization vs Workspace vs Tenant

- **Question:** Are Organization, Workspace, and Tenant three names for one concept, or three genuinely distinct concepts that happen to sound similar?
- **Existing evidence:** `Organization` is the real, implemented, enforced tenancy boundary (Prisma model, guards). `Workspace` is ForgeOS's own unrelated concept — zero code relationship to MOVOS. `Tenant` (`tenant.ts`) is a white-label branding config object with no database backing, conceptually adjacent to but not the same code path as Organization. Full detail: [Ubiquitous Language](./M001-A_UBIQUITOUS_LANGUAGE_v0.1.md#tenancy--identity-terms).
- **Available options:** (a) confirm all three as distinct, already-correct as implemented (Organization = access control, Tenant = branding, Workspace = different product entirely) and simply document the distinction; (b) merge Tenant's branding config into the Organization model as new fields; (c) rename one or more terms to reduce apparent overlap.
- **Impact:** (b) would be a real schema change with migration cost; (c) touches naming across `movos-api` and `movos-web`.
- **Recommended option:** (a) — the three are already functioning correctly as distinct concepts; the _only_ gap is that this was previously undocumented. This recommendation is evidence-backed: no code defect or duplication was found, only a documentation gap this recovery mission closes.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking.**

### M001-A-DEC-003 — Site ownership model

- **Question:** Should Site ownership remain purely Organization-scoped, or does the eventual domain model need a finer-grained ownership/assignment layer (e.g., a Site manager distinct from the Organization owner)?
- **Existing evidence:** `Site.createdByUserId` records who created a Site, but no other per-Site ownership or assignment concept exists. All authorization is Organization-wide via `MemberRole`, not Site-specific.
- **Available options:** (a) keep Organization-wide authorization as-is; (b) introduce Site-level role assignment (a user could be OPERATOR on one Site and VIEWER on another within the same Organization).
- **Impact:** (b) is a real modeling and migration change affecting `Membership` and every guard that currently checks only `organizationId`.
- **Recommended option:** none — no repository evidence indicates this has been considered or ruled out either way. Genuinely open.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking** for CAP-002's likely first scope (Station/Charger/Connector), but **would become blocking** if Site-level authorization is needed before those ship.

### M001-A-DEC-004 — Asset as a generic abstraction

- **Question:** Should Charger (and potentially Station, Connector) be modeled as concrete types, or as instances of a generic `Asset` abstraction?
- **Existing evidence:** "Asset" does not appear anywhere in the repository (confirmed by direct grep). The existing frontend types (`Charger`, `Station`, `Connector`) are already concrete, independent types with their own fields — none of them share a common base type or interface today.
- **Available options:** (a) keep Charger/Station/Connector as independent concrete models, matching the existing frontend design exactly; (b) introduce a generic `Asset` parent that Charger (and future equipment types) extend.
- **Impact:** (b) is a bigger architectural commitment made _before_ there is a second asset type to justify the abstraction — this mission's own governing rule warns specifically against this ("do not replace existing concepts merely because a new name sounds architecturally cleaner").
- **Recommended option:** (a) — evidence-backed by the instruction above and by the fact that the existing, already-designed frontend types are already concrete, not generic. Introducing `Asset` now would be a new abstraction with a sample size of one.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking**, but relevant before CAP-002's Prisma modeling begins — recommend resolving before, not during, that work.

### M001-A-DEC-005 — Charger / Station / EVSE / Connector hierarchy

- **Question:** Does the domain need a fourth tier (EVSE) between Station/Charger and Connector, matching the OCPP standard's own vocabulary, or does the existing three-tier shape (Station → Charger → Connector) already cover it?
- **Existing evidence:** The frontend already implements and consistently uses a three-tier hierarchy: Station (grouping) → Charger (physical unit, has `ocppVersion` field) → Connector (individual plug). "EVSE" does not appear anywhere in the repository. In OCPP terminology, EVSE typically sits between a Charge Point (≈ this codebase's "Charger") and a Connector — meaning the existing "Charger" may already be doing the job an EVSE tier would do.
- **Available options:** (a) keep the existing three-tier shape, treating "Charger" as encompassing what OCPP calls the Charge Point/EVSE boundary; (b) introduce a fourth tier explicitly named EVSE between Charger and Connector, closer to strict OCPP terminology.
- **Impact:** (b) changes the schema shape for every entity in this hierarchy and the API surface built on top of it — higher cost the later it's decided.
- **Recommended option:** (a) — evidence-backed: the existing three-tier design is already fully consistent (type definitions, mock data, and three separate live UI screens all agree with each other), and renaming/re-tiering it now would be exactly the kind of change-for-cleanliness this mission is told to avoid without evidence that (a) is actually insufficient.
- **Decision owner:** ARGOS
- **Status:** **Blocking** for CAP-002 — this is the actual shape of the first Prisma models to be written; recommend resolving before that work starts, not during it.

### M001-A-DEC-006 — Digital Twin scope

- **Question:** Is a Digital Twin capability (a live virtual representation of physical charging infrastructure) part of MOVOS's scope at all?
- **Existing evidence:** Zero references anywhere in the repository — no mention in code, docs, ADRs, or product positioning copy, despite "AI-native" being part of MOVOS's stated positioning (`docs/product/MOVOS.md`).
- **Available options:** (a) out of scope, not part of the product vision; (b) a future/aspirational capability tied to the still-unbuilt AI integration (Mission 004); (c) already implicitly intended but never documented.
- **Impact:** Low immediate impact (nothing currently depends on this), but affects how "AI-native" positioning is interpreted going forward.
- **Recommended option:** none — this is the weakest-evidenced term in the entire recovery; no repository artifact leans toward any of the three options.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking.**

### M001-A-DEC-007 — Vehicle / Driver / Fleet scope

- **Question:** Are Vehicle, Driver, and Fleet management in scope for MOVOS, or is the product exclusively about charging-infrastructure operation (Kylum-side), never fleet/vehicle-owner-side?
- **Existing evidence:** All three terms are entirely absent from the repository — no type, no mock data, no doc reference (Vehicle appears only as a substring of "Electric Vehicle" in prose). MOVOS's own stated positioning (`docs/product/MOVOS.md`) describes it as a platform _for charging operators_, consumed by tenants like Kylum Energy — nothing in that positioning describes fleet or vehicle owners as a user type.
- **Available options:** (a) confirm out of scope — MOVOS serves charging-infrastructure operators only; (b) in scope as a future phase serving a different user type (fleet managers); (c) unresolved, needs product-strategy input beyond this repository.
- **Impact:** If (b), this is a materially different product surface than anything currently planned — a new user type, not an extension of the existing Organization/Site/Charger chain.
- **Recommended option:** none stated as a decision, but the evidence lean is worth naming: current positioning copy consistently describes an operator-side product, with zero trace of vehicle/fleet/driver-side functionality anywhere, including in the earliest fixture-era roadmap. Recommend this be the first of the six-plus open decisions ARGOS rules on, given how little ambiguity the evidence actually contains compared to, say, Digital Twin or Asset.
- **Decision owner:** ARGOS
- **Status:** **Blocking** for any roadmap item that would touch Vehicle/Driver/Fleet — already correctly excluded from the [MVP Gap Analysis](../product/MOVOS_MVP_GAP_ANALYSIS_v1.0.md) pending this decision.

### M001-A-DEC-008 — Session naming: ChargingSession vs RefreshSession

- **Question:** Is there any risk of confusion between the implemented `RefreshSession` (auth) and the planned `ChargingSession` (EV domain) sharing the word "Session"?
- **Existing evidence:** The frontend already disambiguates correctly — its type is named `ChargingSession`, not bare `Session` (`apps/movos-web/src/types/session.ts`). No collision exists today.
- **Available options:** (a) preserve `ChargingSession` as the formal Prisma model name when it's built, maintaining the existing disambiguation; (b) use a different name entirely.
- **Impact:** Low — this is a naming-convention confirmation, not a structural decision.
- **Recommended option:** (a) — evidence-backed; the disambiguation already exists and works, no reason to discard it.
- **Decision owner:** ARGOS (confirmation only)
- **Status:** **Non-blocking.**

### M001-A-DEC-009 — Billing vs Payment as one capability or two

- **Question:** Are Billing (pricing/invoicing) and Payment (processing/PSP integration) the same eventual capability or two separate ones?
- **Existing evidence:** Both are entirely absent from the repository. The single existing reference (a disabled Settings field, "Facturación: No conectado") doesn't distinguish between them.
- **Available options:** (a) one combined capability; (b) two separate capabilities, likely sequenced with Billing (pricing/invoicing) before Payment (processing).
- **Impact:** Affects how the Implementation Roadmap's Billing line item is scoped once it's picked up.
- **Recommended option:** none — insufficient evidence either way.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking** — both are already sequenced last in the roadmap regardless of how this resolves.

### M001-A-DEC-010 — SUPPORT / ANALYST / VIEWER role scope

- **Question:** Should the three `MemberRole` values that are defined but never enforced (SUPPORT, ANALYST, VIEWER) gain real enforcement, or be trimmed from the enum?
- **Existing evidence:** All six roles exist in the Prisma enum; only OWNER/ADMIN/OPERATOR are ever checked in a `@Roles()` decorator anywhere in `apps/movos-api/src`. The frontend's mock `/users` screen has matching Spanish labels for five of six roles (no OWNER label found), suggesting some design intent existed for the full set at some point.
- **Available options:** (a) build real enforcement for the remaining three roles as new capabilities are added; (b) trim the enum to the three roles actually used; (c) leave as-is indefinitely.
- **Impact:** (b) is a schema change with migration cost, low urgency. (a) has no cost beyond the guard logic each new capability would need to write anyway.
- **Recommended option:** none — this is a product-scope question (what should SUPPORT/ANALYST/VIEWER actually be able to do) that repository evidence cannot answer on its own.
- **Decision owner:** ARGOS
- **Status:** **Non-blocking.**

---

## Summary

| ID      | Decision                                 | Status                                 | Evidence-backed recommendation?                |
| ------- | ---------------------------------------- | -------------------------------------- | ---------------------------------------------- |
| DEC-001 | Mission vs Capability                    | Non-blocking                           | Yes (inference, flagged as such)               |
| DEC-002 | Organization vs Workspace vs Tenant      | Non-blocking                           | Yes                                            |
| DEC-003 | Site ownership model                     | Non-blocking (conditional)             | No                                             |
| DEC-004 | Asset as generic abstraction             | Non-blocking (relevant before CAP-002) | Yes                                            |
| DEC-005 | Charger/Station/EVSE/Connector hierarchy | **Blocking for CAP-002**               | Yes                                            |
| DEC-006 | Digital Twin scope                       | Non-blocking                           | No                                             |
| DEC-007 | Vehicle/Driver/Fleet scope               | **Blocking** (for that scope only)     | Evidence lean stated, no formal recommendation |
| DEC-008 | ChargingSession vs RefreshSession naming | Non-blocking                           | Yes                                            |
| DEC-009 | Billing vs Payment                       | Non-blocking                           | No                                             |
| DEC-010 | SUPPORT/ANALYST/VIEWER scope             | Non-blocking                           | No                                             |

**The one decision that actually blocks CAP-002 from starting cleanly is DEC-005.** Everything else can proceed in parallel with, or after, CAP-002's first implementation work.
