# MOVOS MVP Gap Analysis v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Shortest path to a first production-ready version for Kylum Energy, using only what already exists. No redesign, no rewrite — every recommendation below reuses an already-shipped pattern.

## What to reuse, exactly as it exists

The Sites vertical is the template: `JwtAuthGuard → OrgContextGuard → RolesGuard`, one DTO per mutation, a presenter that keeps Prisma types off the wire (`auth/presenters.ts`), and an `AuditService.record()` call on every write. Station, Charger, and Connector should copy this shape file-for-file, not reinvent it.

## What's already designed, just not in the schema

The six missing entities already have a complete TypeScript shape in `apps/movos-web/src/types/{station,charger,connector,session,tariff,alert}.ts`. That's real design work already done once — the Prisma models should start from these types, not be designed from scratch.

## Minimum remaining capabilities, in priority order

| #   | Capability                               | Why it's next                                                                                                                                                                      | Reuses                                 |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Station, Charger, Connector models + API | Nothing else in the EV domain can exist without these three; zero database dependents today                                                                                        | Sites' full guard/DTO/audit pattern    |
| 2   | Users API                                | Cheapest gap in the entire inventory — `User`/`Membership` models already exist; only a controller is missing                                                                      | Existing Prisma models as-is           |
| 3   | ChargingSession (read/history) + Tariff  | First capability that produces a real business metric (energy delivered, revenue potential) without requiring live OCPP yet                                                        | Sites pattern; existing frontend types |
| 4   | OCPP transport + core message handling   | The one piece with no existing precedent — deliberately sequenced after the data model is stable, not before, so the integration isn't built against a model that's still changing | Nothing to reuse — new infrastructure  |
| 5   | Alert (real) + Notifications             | Only meaningful once Charger/Session produce real events to alert on                                                                                                               | `AuditEvent`'s event-recording shape   |

## Explicitly out of the MVP path

- **Billing** — depends on Tariff and Session maturing first; premature before either is real.
- **Reporting** — depends on having real data to report on; the catalogue UI already exists and can stay a catalogue until then.
- **Vehicles / Fleet** — never part of this product's recovered vocabulary at all (see [Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md)). This is a scope question for ARGOS before it becomes a roadmap item — treating it as an assumption to build against would not be reuse, it would be invention.

## What "MVP" means here, precisely

A Kylum-ready MVP requires an operator to manage _real_ chargers, not view a demo. That means item 1 (Station/Charger/Connector) is the actual gate — everything downstream (Sessions, Tariffs, Billing, Reporting) is inert without it, and item 1 is also the safest place to start because it directly extends a pattern already proven in production (Sites).
