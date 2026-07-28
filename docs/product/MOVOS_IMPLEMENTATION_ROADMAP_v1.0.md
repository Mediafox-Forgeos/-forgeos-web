# MOVOS Implementation Roadmap v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Updated:** 2026-07-27 — CAP-002 delivered the Station/Charger/Connector CRUD item below (backend + database + API only; frontend not yet migrated).
**Updated:** 2026-07-28 — WO-ARGOS-004 delivered the frontend migration for that same item (Site-scoped management UI in `apps/movos-web`). OCPP and ChargingSession/Tariff remain the next real work.
**Updated:** 2026-07-28 — WO-ARGOS-005 retired the mock `/stations`/`/chargers`/`/connectors` routes (no product code left rendering fake infrastructure as real) and added an OCPP readiness note ([`docs/domain/CAP-003_OCPP_READINESS_NOTE.md`](../domain/CAP-003_OCPP_READINESS_NOTE.md)) ahead of the "OCPP transport" item below. OCPP itself is still not implemented.
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Recommended implementation order. Complexity is relative sizing (S / M / L / XL), not day-counts — precise duration estimates aren't honest before M001-A produces an approved domain model; sizing will sharpen once entity boundaries are formally decided (see [Open Decisions](../domain/M001-A_OPEN_DECISIONS_v0.1.md)).

## Now — unblocks everything else

| Capability                    | Complexity | Dependencies           | Business value                                                                                                                                                               |
| ----------------------------- | ---------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Station / Charger / Connector | L          | Site (done)            | **CRUD + frontend done (CAP-002, WO-ARGOS-004)** as `ChargingStation`/`Evse`/`Connector` — unblocked the EV domain schema end-to-end; OCPP and sessions remain separate work |
| Users API                     | S          | User/Membership (done) | Closes a visible product gap cheaply                                                                                                                                         |

## Next — first real business metric

| Capability                         | Complexity | Dependencies                               | Business value                                 |
| ---------------------------------- | ---------- | ------------------------------------------ | ---------------------------------------------- |
| ChargingSession (history) + Tariff | M          | ChargingStation/Evse/Connector (CRUD done) | Revenue/usage visibility, no OCPP required yet |

## Then — highest technical risk, sequenced deliberately

| Capability                     | Complexity | Dependencies                                        | Business value                                       |
| ------------------------------ | ---------- | --------------------------------------------------- | ---------------------------------------------------- |
| OCPP transport + core messages | XL         | Stable ChargingStation/Evse/Connector schema (done) | Turns Sessions from manual records into live reality |

Readiness for this item (model gaps, transport/device-auth/command-routing questions still open) is tracked in [`docs/domain/CAP-003_OCPP_READINESS_NOTE.md`](../domain/CAP-003_OCPP_READINESS_NOTE.md) — not an implementation, a pre-implementation decision checklist.

## Later — depends on the above being real first

| Capability                   | Complexity | Dependencies              | Business value       |
| ---------------------------- | ---------- | ------------------------- | -------------------- |
| Alert (real) + Notifications | M          | Charger/Session telemetry | Operational trust    |
| Billing                      | L          | Mature Tariff + Session   | Revenue capture      |
| Reporting (real)             | M          | Real Session/Charger data | Executive visibility |

## Needs a scope decision before it's a roadmap item at all

| Capability                           | Status                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vehicles / Fleet                     | Never appeared in this product's recovered vocabulary ([Domain Inventory](./MOVOS_DOMAIN_INVENTORY_v1.0.md)) — confirm in-scope before estimating |
| AI / ARGOS integration (Mission 004) | Skipped since 2026-07-13; the "AI-native" positioning is unbuilt — needs an explicit scope call, not silent continued deferral                    |

## Recommended order, restated as a single sequence

1. Station / Charger / Connector — **CRUD + frontend done (CAP-002, WO-ARGOS-004)**, as `ChargingStation`/`Evse`/`Connector`
2. Users API _(parallelizable with #1 — no shared dependency)_
3. ChargingSession (read) + Tariff
4. OCPP transport + core messages
5. Alert (real) + Notifications
6. Billing
7. Reporting (real)

Steps 1–2 can run in parallel; everything from step 3 onward is strictly sequential per the [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md).
