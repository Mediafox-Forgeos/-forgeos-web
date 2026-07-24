# MOVOS Screen Inventory v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

All 15 operational screens in `apps/movos-web/app/`, plus login. Recovered by reading each page's actual data-fetching code, not by title or route name.

| Route            | Source                                                | Purpose                                  | Impl. | Backend-connected?            | Uses mock data?                               | Missing                                                              |
| ---------------- | ----------------------------------------------------- | ---------------------------------------- | ----: | ----------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `/login`         | `app/login/page.tsx`                                  | Authentication                           |  100% | Yes                           | No                                            | —                                                                    |
| `/dashboard`     | `app/(app)/dashboard/page.tsx`, `_dashboard-live.tsx` | Executive summary                        |  ~30% | Partial (1 live fetch: sites) | Yes, mostly                                   | Real metrics; visual separation of real vs. mock data                |
| `/sites`         | `app/(app)/sites/page.tsx`                            | Site list                                |  100% | Yes                           | No                                            | —                                                                    |
| `/sites/[id]`    | `app/(app)/sites/[siteId]/page.tsx`                   | Site detail                              |   90% | Yes                           | No                                            | Edit form (currently read-only)                                      |
| `/stations`      | `app/(app)/stations/page.tsx`                         | Station list                             |   15% | No                            | Yes (`src/data/stations.ts`)                  | Everything backend                                                   |
| `/chargers`      | `app/(app)/chargers/page.tsx`                         | Charger inventory                        |   15% | No                            | Yes (`src/data/chargers.ts`)                  | Everything backend                                                   |
| `/chargers/[id]` | `app/(app)/chargers/[chargerId]/page.tsx`             | Charger detail                           |   15% | No                            | Yes                                           | Everything backend                                                   |
| `/connectors`    | `app/(app)/connectors/page.tsx`                       | Connector list                           |   15% | No                            | Yes (`src/data/connectors.ts`)                | Everything backend                                                   |
| `/sessions`      | `app/(app)/sessions/page.tsx`                         | Charging session list                    |   15% | No                            | Yes (`src/data/sessions.ts`)                  | Everything backend, incl. OCPP as the eventual data source           |
| `/sessions/[id]` | `app/(app)/sessions/[sessionId]/page.tsx`             | Session detail                           |   15% | No                            | Yes                                           | Everything backend                                                   |
| `/users`         | `app/(app)/users/page.tsx`                            | Team directory                           |   15% | No (model exists, unexposed)  | Yes (`src/data/users.ts`)                     | API only — cheapest gap to close in this entire inventory            |
| `/tariffs`       | `app/(app)/tariffs/page.tsx`                          | Pricing definitions                      |   15% | No                            | Yes (`src/data/tariffs.ts`)                   | Everything backend                                                   |
| `/alerts`        | `app/(app)/alerts/page.tsx`, `alerts-view.tsx`        | Operational alerts                       |   15% | No                            | Yes (+ local-only toggle)                     | Everything backend                                                   |
| `/reports`       | `app/(app)/reports/page.tsx`                          | Report catalogue                         |   10% | No                            | Catalogue only, every entry `available:false` | Generation entirely                                                  |
| `/settings`      | `app/(app)/settings/page.tsx`                         | Org / brand / OCPP / notification config |   20% | No persistence                | Static values from `tenant.ts`                | Every field is `disabled`; the "Guardar cambios" button does nothing |

## Cross-cutting observation

The `DemoBanner` (dismissible "Entorno piloto · Datos de demostración" banner) and `DemoNotice` (inline badge) components are correctly implemented and consistently used across every mock-data screen — the product is honest, in its own UI, about which screens are demo. This does not change any screen's actual completion state, but it means the risk of a stakeholder mistaking mock data for real data is already mitigated in the UI itself.
