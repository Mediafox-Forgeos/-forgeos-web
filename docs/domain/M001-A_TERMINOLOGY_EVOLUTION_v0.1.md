# M001-A — Terminology Evolution v0.1

**Mission:** M001-A — Domain Research (in progress, owned by ARGOS)
**Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db` · **Baseline:** [MOVOS Product Atlas v1.0](../product/MOVOS_PRODUCT_ATLAS_v1.0.md)

This document gives the "Mission vs Capability" question the dedicated treatment the recovery mission calls for. Full timeline of naming evolution (EV Platform → MOVOS, KYNEX vs MOVOS) lives in [`docs/product/MOVOS_DOMAIN_INVENTORY_v1.0.md`](../product/MOVOS_DOMAIN_INVENTORY_v1.0.md) — this document does not repeat it, only the Mission/Capability analysis specifically.

## What "Mission" originally meant

Reconstructed from `git log --reverse` and every doc reference (`docs/architecture/MONOREPO.md`, `packages/core-domain/README.md`, `docs/product/MOVOS.md`, `docs/adr/README.md`):

A **Mission** is a sequentially numbered unit of internal engineering/product execution. Evidence for this definition:

- Missions are numbered and referenced in strict sequence: 002 (monorepo), 003 (domain model — skipped), 004 (ARGOS integration — skipped), 005 (MOVOS scaffold), 006 (auth/tenancy/Sites), 007A (Location Capability).
- Every Mission reference is either a commit message describing what shipped ("complete Mission 006"), or a doc noting what a Mission explicitly does _not_ yet do ("Mission 002 intentionally does not create an EV Platform application...").
- Missions are never user-facing. No screen, API response, or product copy anywhere references a Mission number. They are purely an internal planning/execution construct.
- Missions are not an agent/work-order concept in the sense this conversation's own instructions use "WO-ARGOS-00N" — no `WO-` identifier appears anywhere inside the repository itself. Missions and Work Orders are evidently two different tracking mechanisms, one internal-to-the-repo (Mission) and one external-to-the-repo (this conversation's own numbering, which has left no trace in committed files).
- Missions are not a domain entity — no `Mission` type, model, or table exists anywhere.

**Conclusion: Mission is an internal planning construct, not a user-facing product concept, not a formal agent/work-order identifier recorded in the repo, and not a domain entity.**

## What "Capability" means, by contrast

- Found in exactly one context: "Google Maps **Location Capability**" (Mission 007A), across three files (`docs/product/MOVOS.md`, `docs/adr/ADR-0007-...md`, `docs/architecture/MOVOS_LOCATION_CAPABILITY.md`).
- Used as an ordinary descriptive English word for "a feature area," applied to exactly one feature, one time. It was never applied to Sites, Auth, or any other shipped feature — those are never called "Site Capability" or "Auth Capability" anywhere.
- Note on this document's own governing instructions: the work orders driving this entire session (WO-ARGOS-001, WO-ARGOS-002, and the earlier VULCAN missions) use "Capability" extensively and structurally — as the noun for what a Feature Matrix inventories, what M001-A is meant to formalize, what a roadmap is ordered by. **That usage is external to the repository** — it appears in this conversation's instructions, not in any committed file. It cannot be counted as repository evidence for how MOVOS itself uses the word.

**Conclusion: within the repository, "Capability" is not a structured planning unit — it is a single, informal, descriptive label. It is not evidence that MOVOS has adopted "Capability" as a formal successor term to "Mission."**

## Do Mission and Capability describe the same concept?

**No — based on repository evidence, they do not currently overlap enough to be in tension.** Mission is a real, consistently-used internal execution unit with six-plus instances. Capability is a single descriptive occurrence. They are not competing for the same semantic space today; nothing in the repository asks the reader to choose between them.

**They could come into conflict later** — specifically, if M001-A or a subsequent mission adopts "Capability" as the formal name for what this Atlas's own Feature Matrix inventories (which is exactly what the WO-ARGOS-00N conversations calling for this document already do, informally, outside the repo). At that point, a decision would be needed: does "Capability" become the noun for a _deliverable_ (a shipped feature, evaluated in a Feature Matrix) while "Mission" remains the noun for the _unit of work_ that produces it? That reading is consistent with all evidence collected — a Mission is executed, a Capability results — but it is an inference this document flags rather than a conclusion the repository states outright anywhere.

## Can both terms coexist without confusion?

Yes, under the reading above: **Mission = the unit of planning and execution; Capability = the resulting feature, evaluated for completeness.** This matches every observed instance without contradiction: Mission 007A (the unit of work) produced the Location Capability (the resulting feature). Formalizing this distinction — rather than picking one term and discarding the other — would preserve both existing vocabularies rather than deprecating either.

This is a **recommended reading of the evidence, not a decision.** It is recorded as [M001-A-DEC-001](./M001-A_OPEN_DECISIONS_v0.1.md#m001-a-dec-001) in the Open Decisions register for ARGOS to formally approve, amend, or reject.
