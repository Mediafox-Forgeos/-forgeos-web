# ForgeOS Positioning

**Work order:** WO-ARGOS-028 (ForgeOS Core Extraction)
**Status:** ARCHITECTURE DISCOVERY. No code, API, migration, or `schema.prisma` change.
**Mission:** answer explicitly what ForgeOS is — a framework, a platform, an operating system, or something else — using [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md), [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md), [VERTICAL_BOUNDARIES.md](./VERTICAL_BOUNDARIES.md), and [FORGEOS_STACK.md](./FORGEOS_STACK.md) as evidence.

## The answer

**A. A framework — today, and for the next real step. Not yet B, a platform; not C, an operating system.**

The name "ForgeOS" already implies C. The evidence doesn't support that yet, and reaching for it now would be building for a scale this business hasn't earned. What the evidence supports is the smallest, least risky move: package the Core-shaped primitives [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md) already found — `Event`, `Observation`, `Recommendation`'s contract, `Action`, `State transition` — as internal libraries a vertical's own application imports and calls, the same relationship MOVOS already has with NestJS itself. Nothing about "platform" or "operating system" is ruled out forever — the Long-Term Vision section below names exactly what evidence would justify graduating — but neither is justified by what exists today.

## What each option would actually mean here

- **A. Framework:** a set of importable libraries (e.g. `@mediafox/forgeos-execution`, `@mediafox/forgeos-intelligence`) that a vertical's own NestJS application depends on and calls into. Each vertical keeps its own database, its own deployment, its own tenant boundary — Core supplies code, not infrastructure.
- **B. Platform:** a separately deployed, genuinely multi-tenant runtime that multiple verticals' applications call over the network — meaning tenancy itself (`Organization`/`Membership`) would need to live in a shared service, and MOVOS's own auth would need to depend on something outside its own deployment.
- **C. Operating system:** the foundational layer every vertical's application runs _on top of_, controlling resource allocation and providing the primitive abstractions applications are built from — the same relationship Linux has to the programs running on it. This is a claim about controlling infrastructure, not just supplying reusable logic.
- **D. Something else:** e.g., a shared design/reference implementation with no packaging at all — closer to "a style guide with working code," not a dependency any vertical actually takes.

## Evaluated against the evidence

### Reuse potential

[UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md) found real, working code for `Event`-shaped tables, `Observation`-shaped state, a `Recommendation` contract, and an `Action` state machine — all built once, for mobility, without needing mobility to make sense. That's strong evidence _some_ extraction is worth doing. It is not evidence a second vertical is imminent: there is exactly one vertical (mobility/EV charging) and one pilot customer (Kylum Energy) anywhere in this engagement's history. Reuse potential justifies packaging the primitives (Framework); it does not yet justify standing up shared runtime infrastructure for tenants that don't exist (Platform), let alone infrastructure-level control (Operating System).

### Technical boundaries

[VERTICAL_BOUNDARIES.md](./VERTICAL_BOUNDARIES.md)'s clearest finding — `User`/`Organization`/`Membership` already have zero mobility-specific fields — is also the strongest argument _against_ the Platform answer being safe to reach for casually: tenancy is exactly the piece that would have to move into a shared service for "Platform" to mean anything, and it is the piece with the highest blast radius if that migration goes wrong (every existing MOVOS auth/access-control path depends on it). A Framework extraction touches none of that — Core packages get imported into the existing app, `Organization`/`Membership` stay exactly where they are. The technical boundary that already exists cleanly (tenancy has no vertical residue) is a reason to extract it _last_, carefully, once a second consumer is real — not a reason to rush toward Platform now.

### Business value

Every one of the eight capabilities in [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md) was built to solve a concrete MOVOS problem, in the order MOVOS needed it, not in service of a platform roadmap — and that discipline has paid off every time it's been checked (WO-ARGOS-025 and -026 both shipped real, working, narrowly-scoped capabilities on schedule). The business value of Framework-level extraction is real and near-term: the next vertical MediaFOX builds gets `Action`, `Recommendation`'s contract, and the `Event`/state-transition primitives for the cost of an import, not a rebuild — a genuine multi-week-to-month head start, visible the moment a second vertical is greenlit. The business value of Platform or OS-level investment is entirely speculative until that second vertical exists to prove the primitives hold outside mobility — spending real engineering time standing up shared multi-tenant infrastructure for a customer base of zero non-mobility tenants is exactly the kind of premature abstraction this engagement has consistently avoided (see, for instance, `Action.status`'s `OPEN` value: kept in the enum for a future capability, never built ahead of need).

### Long-term vision

Framework is not the ceiling — it's the correct first rung. The path from here, in order, tracks the maturity findings in [CAPABILITY_INVENTORY.md](./CAPABILITY_INVENTORY.md) and [FORGEOS_STACK.md](./FORGEOS_STACK.md) directly:

1. **Now — Framework.** Package the Core-shaped primitives (Action's mechanism, the Recommendation contract, the Event shape, a shared state-transition/FSM utility) as internal libraries. MOVOS becomes Core's first real consumer, importing what it already effectively wrote for itself.
2. **Once a second vertical exists — prove it, don't assume it.** A second vertical adopting the same Framework packages, unmodified or nearly so, is the actual evidence [UNIVERSAL_PRIMITIVES.md](./UNIVERSAL_PRIMITIVES.md)'s classifications are currently missing (recall: Sessions and Billing were classified Hybrid specifically because their universality is unverified, not because it's doubted).
3. **Only after that — consider Platform.** If two or more verticals end up needing genuinely shared infrastructure (a common Recommendation-evaluation runtime, a common cross-tenant Learning aggregation service) rather than just common code, extracting _that_ into a real deployed service is the point where "Platform" starts meaning something concrete instead of aspirational.
4. **Operating System is not on this path at all**, for the foreseeable future. Nothing in this business's trajectory needs ForgeOS to control compute, scheduling, or resource allocation across verticals — that's a different, much larger kind of company, solving a problem this business does not have today.

## Comparison

| Criterion            | A. Framework                                                  | B. Platform                                                       | C. Operating System                                           |
| -------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| Reuse potential      | High — real code already proves the primitives, once packaged | Unproven — no second tenant exists to justify shared runtime      | Not applicable at this stage                                  |
| Technical boundaries | Low risk — imports into existing app, tenancy untouched       | High risk — would require migrating tenancy into a shared service | Would require infrastructure-level control nothing here needs |
| Business value       | Concrete, near-term (head start on the next vertical)         | Speculative until a second vertical is real                       | Speculative and premature                                     |
| Long-term vision     | The correct first rung                                        | The correct second rung, evidence-gated                           | Off the path entirely for now                                 |

## What this recommends concretely

Treat "ForgeOS" as a **framework-in-waiting**: the primitives are real and already proven inside MOVOS, but nothing should be physically extracted into a separate package or service until a second vertical is authorized and gives the extraction something real to serve. Until then, the right next step is not extraction — it's continuing to build MOVOS's remaining layers ([FORGEOS_STACK.md](./FORGEOS_STACK.md)'s Memory and Learning, per [LEARNING_STRATEGY.md](../product/LEARNING_STRATEGY.md)'s own recommendation) with an eye toward keeping the Core-shaped mechanism and the MOVOS-specific residue as cleanly separated as `Action` already is — so that whenever a second vertical does arrive, the extraction is a packaging exercise, not a redesign.
