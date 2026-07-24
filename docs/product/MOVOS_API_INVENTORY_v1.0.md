# MOVOS API Inventory v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

All 13 real endpoints in `apps/movos-api`, prefix `/api/v1` (set in `src/main.ts`). This is the complete set — confirmed by reading every module import in `src/app.module.ts`; no partial or stub routes exist beyond these.

| Method | Route                       | Purpose                     | Auth                                              | DTO                    | Controller                | Service                | Status           |
| ------ | --------------------------- | --------------------------- | ------------------------------------------------- | ---------------------- | ------------------------- | ---------------------- | ---------------- |
| POST   | `/auth/login`               | Authenticate                | Local strategy + 5/min throttle                   | `LoginDto`             | `AuthController`          | `AuthService`          | Live             |
| POST   | `/auth/refresh`             | Rotate refresh token        | httpOnly cookie                                   | —                      | `AuthController`          | `AuthService`          | Live             |
| POST   | `/auth/logout`              | Revoke session              | JWT                                               | —                      | `AuthController`          | `AuthService`          | Live             |
| GET    | `/auth/me`                  | Current user + orgs         | JWT                                               | —                      | `AuthController`          | `AuthService`          | Live             |
| POST   | `/auth/select-organization` | Scope token to org          | JWT                                               | `SelectOrgDto`         | `AuthController`          | `AuthService`          | Live             |
| GET    | `/organizations`            | List user's organizations   | JWT                                               | —                      | `OrganizationsController` | `OrganizationsService` | Live (read-only) |
| GET    | `/sites`                    | List non-archived sites     | JWT + org context                                 | —                      | `SitesController`         | `SitesService`         | Live             |
| POST   | `/sites`                    | Create site                 | JWT + OWNER/ADMIN                                 | `CreateSiteDto`        | `SitesController`         | `SitesService`         | Live             |
| GET    | `/sites/:id`                | Site detail                 | JWT + org context                                 | —                      | `SitesController`         | `SitesService`         | Live             |
| PATCH  | `/sites/:id`                | Update site                 | JWT + OWNER/ADMIN/OPERATOR                        | `UpdateSiteDto`        | `SitesController`         | `SitesService`         | Live             |
| POST   | `/sites/:id/archive`        | Archive site                | JWT + OWNER/ADMIN                                 | —                      | `SitesController`         | `SitesService`         | Live             |
| GET    | `/locations/autocomplete`   | Google Places autocomplete  | JWT, 30/min throttle                              | `AutocompleteQueryDto` | `LocationController`      | `LocationService`      | Live             |
| GET    | `/locations/place/:placeId` | Resolve place → coordinates | JWT, 30/min throttle                              | `PlaceQueryDto`        | `LocationController`      | `LocationService`      | Live             |
| GET    | `/health`                   | Liveness probe              | None (exempt from throttle via `@SkipThrottle()`) | —                      | `HealthController`        | —                      | Live             |

## Confirmed absent

No endpoints exist anywhere for: chargers, stations, connectors, sessions, tariffs, alerts, reports, or team/user management. `AuditService` exists (`src/audit/`) but has no controller — it's a cross-cutting service invoked internally from `SitesService` and `AuthService`, not an API surface of its own.

## Cross-cutting middleware (applies to all routes above)

`ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true`) · `HttpExceptionFilter` · `CorrelationIdInterceptor` · `RequestLoggerMiddleware` · `ThrottlerModule` global default (120 req/min, actually enforced as of PR #5 — see [CAP-001's updated note](../audits/CAP001_PRODUCT_READINESS_ASSESSMENT.md) on this fix).
