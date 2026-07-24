# MOVOS Feature Matrix v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

Every discovered capability, verified against the live schema (`apps/movos-api/prisma/schema.prisma`), controllers (`apps/movos-api/src/`), and frontend pages (`apps/movos-web/app/`). Completion % reflects the capability in isolation: Production Ready = 100%, Functional = 75%, Partial = 40%, Mock = 5%, Planned = 0%.

| Capability          | Status           | Compl. | Backend              | Frontend                     | Database              | API                   | Production ready?      |
| ------------------- | ---------------- | -----: | -------------------- | ---------------------------- | --------------------- | --------------------- | ---------------------- |
| **Authentication**  | Production Ready |   100% | Yes                  | Yes                          | Yes                   | Yes                   | **YES**                |
| **Sites**           | Production Ready |   100% | Yes                  | Yes                          | Yes                   | Yes                   | **YES**                |
| **Location**        | Production Ready |   100% | Yes                  | Yes                          | Yes (fields on Site)  | Yes                   | **YES**                |
| Organizations       | Partial          |    40% | Yes (read-only)      | No mgmt UI                   | Yes                   | List only             | NO                     |
| Roles               | Functional       |    75% | Enum + guard         | No role-mgmt UI              | Yes                   | No dedicated endpoint | NO                     |
| Permissions         | Functional       |    75% | Yes, tested          | N/A                          | N/A                   | Guard-level           | YES (Sites only)       |
| White Label         | Functional       |    75% | No persistence       | Yes (`tenant.ts`)            | No                    | N/A                   | NO (n=1 tenant tested) |
| Users (team mgmt)   | Mock             |     5% | Model exists, no API | Hardcoded demo               | Yes (User/Membership) | No                    | NO                     |
| Chargers            | Mock             |     5% | No                   | Hardcoded demo               | No model              | No                    | NO                     |
| Sessions            | Mock             |     5% | No                   | Hardcoded demo               | No model              | No                    | NO                     |
| Tariffs             | Mock             |     5% | No                   | Hardcoded demo               | No model              | No                    | NO                     |
| Alerts              | Mock             |     5% | No                   | Hardcoded, local toggle only | No model              | No                    | NO                     |
| Reporting           | Mock             |     5% | No                   | Catalogue, `available:false` | No model              | No                    | NO                     |
| OCPP                | Planned          |     0% | No                   | No                           | No                    | No                    | NO                     |
| Billing             | Planned          |     0% | No                   | No                           | No                    | No                    | NO                     |
| Notifications       | Planned          |     0% | No                   | Disabled stub only           | No                    | No                    | NO                     |
| Vehicles            | Planned          |     0% | No                   | No                           | No                    | No                    | NO                     |
| Fleet               | Planned          |     0% | No                   | No                           | No                    | No                    | NO                     |
| AI (ARGOS in MOVOS) | Planned          |     0% | No                   | No (ARGOS is ForgeOS-only)   | No                    | No                    | NO                     |

## Dependencies

Sessions, Tariffs, Alerts, Reporting, Billing, and Notifications all ultimately depend on Chargers existing, which depends on Stations, which depends on the already-implemented Site. See the [Dependency Map](./MOVOS_DEPENDENCY_MAP_v1.0.md) for the full graph.

## Technical risk concentration

OCPP is the one item with no architectural precedent anywhere else in the codebase to reuse — it requires a stateful/persistent-connection transport (WebSocket), while everything shipped so far is HTTP request/response. This is the single highest-risk item in the matrix, independent of its priority in the roadmap.
