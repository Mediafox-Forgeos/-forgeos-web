# MOVOS Feature Matrix v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Updated:** 2026-07-28 — WO-ARGOS-004 connected Charging Core CRUD to real `apps/movos-web` UI (Site-scoped, not the pre-existing flat mock pages).
**Updated:** 2026-07-28 — WO-ARGOS-005 retired those flat mock pages (`/stations`, `/chargers`, `/connectors`) per ARGOS's ruling against org-wide list-all endpoints; see note below.
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Every discovered capability, verified against the live schema (`apps/movos-api/prisma/schema.prisma`), controllers (`apps/movos-api/src/`), and frontend pages (`apps/movos-web/app/`). Completion % reflects the capability in isolation: Production Ready = 100%, Functional = 75%, Partial = 40%, Mock = 5%, Planned = 0%.

| Capability                             | Status           | Compl. | Backend              | Frontend                                | Database              | API                   | Production ready?         |
| -------------------------------------- | ---------------- | -----: | -------------------- | --------------------------------------- | --------------------- | --------------------- | ------------------------- |
| **Authentication**                     | Production Ready |   100% | Yes                  | Yes                                     | Yes                   | Yes                   | **YES**                   |
| **Sites**                              | Production Ready |   100% | Yes                  | Yes                                     | Yes                   | Yes                   | **YES**                   |
| **Location**                           | Production Ready |   100% | Yes                  | Yes                                     | Yes (fields on Site)  | Yes                   | **YES**                   |
| Organizations                          | Partial          |    40% | Yes (read-only)      | No mgmt UI                              | Yes                   | List only             | NO                        |
| Roles                                  | Functional       |    75% | Enum + guard         | No role-mgmt UI                         | Yes                   | No dedicated endpoint | NO                        |
| Permissions                            | Functional       |    75% | Yes, tested          | N/A                                     | N/A                   | Guard-level           | YES (Sites only)          |
| White Label                            | Functional       |    75% | No persistence       | Yes (`tenant.ts`)                       | No                    | N/A                   | NO (n=1 tenant tested)    |
| Users (team mgmt)                      | Mock             |     5% | Model exists, no API | Hardcoded demo                          | Yes (User/Membership) | No                    | NO                        |
| Charging Core (Station/EVSE/Connector) | Functional       |    75% | Yes (CRUD only)      | Yes, Site-scoped CRUD UI (WO-ARGOS-004) | Yes (CAP-002)         | Yes (CRUD only)       | NO (no OCPP, no sessions) |
| Sessions                               | Mock             |     5% | No                   | Hardcoded demo                          | No model              | No                    | NO                        |
| Tariffs                                | Mock             |     5% | No                   | Hardcoded demo                          | No model              | No                    | NO                        |
| Alerts                                 | Mock             |     5% | No                   | Hardcoded, local toggle only            | No model              | No                    | NO                        |
| Reporting                              | Mock             |     5% | No                   | Catalogue, `available:false`            | No model              | No                    | NO                        |
| OCPP                                   | Planned          |     0% | No                   | No                                      | No                    | No                    | NO                        |
| Billing                                | Planned          |     0% | No                   | No                                      | No                    | No                    | NO                        |
| Notifications                          | Planned          |     0% | No                   | Disabled stub only                      | No                    | No                    | NO                        |
| Vehicles                               | Planned          |     0% | No                   | No                                      | No                    | No                    | NO                        |
| Fleet                                  | Planned          |     0% | No                   | No                                      | No                    | No                    | NO                        |
| AI (ARGOS in MOVOS)                    | Planned          |     0% | No                   | No (ARGOS is ForgeOS-only)              | No                    | No                    | NO                        |

## Dependencies

Sessions, Tariffs, Alerts, Reporting, Billing, and Notifications all ultimately depend on the Charging Core (Station/EVSE/Connector) existing, which now has both a CRUD backend (CAP-002) and a connected, Site-scoped management UI (WO-ARGOS-004). None of those dependents are unblocked yet — they need OCPP communication and/or session/tariff models that neither mission implemented. See the [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md) for the full graph.

**Note on "Frontend: Yes":** this means the real `ChargingStation`/`Evse`/`Connector` records are viewable and editable through `apps/movos-web`, scoped per-Site (`/sites/[id]/charging-stations/...`). As of WO-ARGOS-005, the formerly-mock `/stations`, `/chargers`, `/connectors` pages were also retired: `/stations` redirects to `/sites`, and `/chargers`/`/connectors` are real Site-selection gateways into the same Site-scoped flow — none of the three renders mock infrastructure data anymore. No org-wide list-all endpoint was built to give them a flat list of their own; that remains a deliberate, ARGOS-confirmed scope decision, not a gap. See [Screen Inventory](./MOVOS_SCREEN_INVENTORY_v1.0.md).

## Technical risk concentration

OCPP is the one item with no architectural precedent anywhere else in the codebase to reuse — it requires a stateful/persistent-connection transport (WebSocket), while everything shipped so far is HTTP request/response. This is the single highest-risk item in the matrix, independent of its priority in the roadmap.
