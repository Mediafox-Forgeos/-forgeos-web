# MOVOS Product Dependency Map v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Real dependencies, recovered from `apps/movos-api/prisma/schema.prisma`'s foreign keys and the frontend's own type relationships (`apps/movos-web/src/types/`) — not a hypothetical target architecture. A dependency edge below exists only where the schema, a service, or a type import actually expresses it.

```text
Organization                                                        (implemented)
├── Membership → User                (implemented — 6-role enum defined, only OWNER/ADMIN/OPERATOR enforced)
│     └── RefreshSession             (implemented — auth infra, keyed off User)
├── Site                             (implemented — full CRUD, org-scoped)
│     ├── Location fields            (implemented — Google Places autocomplete + geocode, 10 fields on Site)
│     ├── Station                    (no model — planned)
│     │     └── Charger              (no model — planned; frontend type + mock data exist)
│     │           ├── Connector      (no model — planned; frontend type + mock data exist)
│     │           └── ChargingSession (no model — planned; frontend type + mock data exist)
│     │                 ├── Tariff   (no model — planned; frontend type + mock data exist)
│     │                 │     └── Billing (no artifact anywhere — depends on Tariff + Session)
│     │                 └── Alert    (no model — planned; depends on Charger/Session telemetry
│     │                                that doesn't exist yet)
│     └── OCPP transport layer       (no model, no service, no infra — would be Charger/Session's
│                                      real data source once built)
├── AuditEvent                       (implemented — cross-cutting, optional FK to Organization + User)
└── Notifications                    (no artifact — would depend on Alert to have anything to notify about)

Reporting                            (mock catalogue only — depends on real Session/Charger data)
AI / ARGOS integration               (Mission 004 — lives only in ForgeOS today; no dependency
                                       edge into MOVOS exists)
Vehicles / Fleet                     (no artifact, no dependency edges — never entered the
                                       product's vocabulary; see Domain Inventory)
```

**Legend:** unindented/first-level items with "(implemented)" are real, tested, and in production. Everything marked "(no model — planned)" or "(no artifact)" exists at most as a TypeScript type and hardcoded demo data in `movos-web` — regardless of how complete that UI-facing scaffolding looks, there is no backend behind it.

## Reading the map

- **Everything in the EV domain is downstream of `Site`.** No planned entity (Station through Alert) has any dependency that bypasses Site — this is why the [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md) treats Site as the one piece of leverage the rest of the roadmap builds on.
- **OCPP has no upstream dependency inside the current schema** — it doesn't need anything else to exist first architecturally — but it has no downstream consumer either until Charger/Connector/ChargingSession exist to receive its data. It is sequenced late in the roadmap for a different reason: it is the one component with zero existing pattern in this codebase to reuse (everything shipped so far is HTTP request/response; OCPP is inherently a persistent-connection protocol).
- **Billing, Notifications, and real Reporting are all leaves** — nothing else in the product depends on them existing. They are safe to defer without blocking anything else in this map.
- **AI/ARGOS and Vehicles/Fleet are disconnected from this graph entirely** — not "blocked," just structurally unrelated to anything currently implemented. Treating them as roadmap items requires a scope decision first (see [Implementation Roadmap](./MOVOS_IMPLEMENTATION_ROADMAP_v1.0.md)), not an estimate.
