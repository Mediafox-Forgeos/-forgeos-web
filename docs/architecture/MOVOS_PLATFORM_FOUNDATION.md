# MOVOS Platform Foundation

Status: Implemented (Mission 006)
Owner: VULCAN | Coordination: ARGOS | Product: ATLAS

This document describes the first operational vertical slice of MOVOS:
authentication, multi-tenant organization isolation, and persistent Sites.

---

## 1. Architecture overview

```text
┌──────────────────────────┐        HTTPS / JSON            ┌───────────────────────────┐
│      MOVOS Web            │  ───────────────────────────▶ │        MOVOS API           │
│  Next.js 15 (App Router)  │   Bearer access token         │  NestJS 10 + Prisma        │
│  apps/movos-web  :3002    │   httpOnly refresh cookie     │  apps/movos-api  :4000     │
│                           │ ◀───────────────────────────  │  prefix /api/v1            │
│  - AuthProvider (memory)  │                               │                            │
│  - api-client (refresh)   │                               │  Auth · Orgs · Sites       │
│  - middleware (cookie)    │                               │  Guards · Audit            │
└──────────────────────────┘                               └────────────┬──────────────┘
                                                                         │ Prisma Client
                                                                         ▼
                                                            ┌───────────────────────────┐
                                                            │      PostgreSQL 16         │
                                                            │  users · organizations     │
                                                            │  memberships · sites        │
                                                            │  refresh_sessions · audit   │
                                                            └───────────────────────────┘
```

Shared API contracts live in `@mediafox/shared-types` (hand-written, never
Prisma-generated types).

---

## 2. Web / API boundary

- The web app is a pure client of the API. It holds **no** database access and
  **no** Prisma types.
- The only cross-boundary types are the interfaces in
  `packages/shared-types/src/movos-api.ts` (`ApiUser`, `ApiOrganization`,
  `ApiMembership`, `ApiSite`, `LoginResponse`, `MeResponse`, ...).
- The API projects Prisma models to these contracts explicitly in
  `apps/movos-api/src/auth/presenters.ts`. `passwordHash` never leaves the API.

---

## 3. Auth model and token strategy

| Token          | Type                     | Lifetime | Storage (client)              | Storage (server)                  |
| -------------- | ------------------------ | -------- | ----------------------------- | --------------------------------- |
| Access token   | JWT (HS256)              | 15 min   | In-memory only                | Stateless (verified by secret)    |
| Refresh token  | Opaque random UUID       | 7 days   | httpOnly `movos_refresh` cookie | SHA-256 hash in `refresh_sessions` |
| Session marker | Non-secret flag          | 7 days   | `movos_session` cookie (JS-readable) | —                          |

- Access token payload: `{ sub: userId, email, orgId? }`.
- Refresh tokens **rotate**: every `/auth/refresh` revokes the presented
  session and issues a new one.
- Refresh tokens are stored **hashed** (SHA-256). A DB leak cannot be replayed.
  (SHA-256 rather than bcrypt is used because the lookup column is unique and
  bcrypt's per-row salt makes hash-equality lookup impossible; the token itself
  is 122 bits of entropy, so a fast one-way hash is appropriate.)
- Cookies: `httpOnly`, `sameSite=strict`, `secure` in production.
- The web `movos_session` cookie is a non-secret presence flag used only by the
  Next.js middleware for route gating. Middleware never decodes a JWT.

### Auth endpoints

| Method | Path                             | Auth        | Notes                                             |
| ------ | -------------------------------- | ----------- | ------------------------------------------------- |
| POST   | `/api/v1/auth/login`             | public      | Generic 401 "Credenciales incorrectas" on failure |
| POST   | `/api/v1/auth/refresh`           | cookie      | Rotates refresh token                             |
| POST   | `/api/v1/auth/logout`            | access JWT  | Revokes session, clears cookies                   |
| GET    | `/api/v1/auth/me`                | access JWT  | Current user + orgs + memberships                 |
| POST   | `/api/v1/auth/select-organization` | access JWT | Returns access token with `orgId` claim          |

---

## 4. Multi-tenant isolation design

Isolation is enforced **server-side on every tenant-scoped request** and is
never derived from client-supplied data alone.

1. `JwtAuthGuard` authenticates the user and loads `request.user`.
2. `OrgContextGuard` resolves the active organization from the
   `X-Organization-Id` header (falling back to the JWT `orgId` claim), then
   **re-validates ACTIVE membership against the database**. A forged or
   non-member org id yields `403`.
3. The resolved `Membership` is attached to `request.membership`.
4. `RolesGuard` enforces `@Roles(...)` requirements using that membership.
5. Service queries are **additionally** scoped by `organizationId`, so a site
   from another org is indistinguishable from a non-existent one (`404`).

This is defense in depth: guard-level membership check + query-level org scope.

---

## 5. Database schema summary

| Model            | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `User`           | Person who can log in. Holds `passwordHash`.       |
| `Organization`   | Tenant. Unique `slug`.                             |
| `Membership`     | User ↔ Organization with `role` and `status`. Unique `(userId, organizationId)`. |
| `Site`           | Persisted charging location. Unique `(organizationId, slug)`. |
| `RefreshSession` | Rotating refresh tokens (hashed), revocation, expiry. |
| `AuditEvent`     | Append-only audit trail (login, logout, site changes). |

Enums: `UserStatus`, `OrgStatus`, `MemberRole`, `MemberStatus`, `SiteStatus`.

---

## 6. Permission matrix (Sites)

| Action                         | OWNER | ADMIN | OPERATOR | SUPPORT | ANALYST | VIEWER |
| ------------------------------ | :---: | :---: | :------: | :-----: | :-----: | :----: |
| GET /sites (list)              |   ✔   |   ✔   |    ✔     |    ✔    |    ✔    |   ✔    |
| GET /sites/:id                 |   ✔   |   ✔   |    ✔     |    ✔    |    ✔    |   ✔    |
| POST /sites (create)           |   ✔   |   ✔   |    ✘     |    ✘    |    ✘    |   ✘    |
| PATCH /sites/:id (update)      |   ✔   |   ✔   |    ✔     |    ✘    |    ✘    |   ✘    |
| POST /sites/:id/archive        |   ✔   |   ✔   |    ✘     |    ✘    |    ✘    |   ✘    |

All rows additionally require ACTIVE membership in the target organization.

---

## 7. Local development setup

Prerequisites: Node.js 20 LTS, pnpm 11.5.3, Docker.

```bash
pnpm install
docker compose up -d                                   # PostgreSQL 16 on :5432
cp apps/movos-api/.env.example apps/movos-api/.env      # then edit secrets
cp apps/movos-web/.env.example apps/movos-web/.env.local

pnpm --filter @mediafox/movos-api prisma:generate
pnpm --filter @mediafox/movos-api prisma:migrate:dev    # creates schema
pnpm --filter @mediafox/movos-api seed                  # Kylum org + owner

pnpm --filter @mediafox/movos-api dev                   # http://localhost:4000
pnpm --filter @mediafox/movos-web dev                   # http://localhost:3002
```

Swagger (non-production) is served at `http://localhost:4000/api/docs`.

### Test strategy

- **Unit tests** (`*.spec.ts`, `pnpm --filter @mediafox/movos-api test`) mock
  `PrismaService` — no database required.
- **E2E tests** (`test/*.e2e-spec.ts`, `pnpm --filter @mediafox/movos-api
  test:e2e`) require a reachable PostgreSQL. Point `TEST_DATABASE_URL` at an
  isolated test database. When no database is reachable, each e2e case skips
  cleanly (logs `[skip]`) rather than failing the pipeline.
- The mandatory tenant-isolation suite is `test/tenant-isolation.e2e-spec.ts`.

> Runtime note: the jest toolchain (jest, yargs, graceful-fs) targets Node 20
> LTS, which matches the repo prerequisite and the API Dockerfile
> (`node:20-alpine`). Running the jest CLI under pre-release Node (24/25) is not
> supported by those upstream dependencies.

---

## 8. Deployment boundary

- **MOVOS Web**: Vercel (Next.js), root directory `apps/movos-web`. Requires
  `NEXT_PUBLIC_MOVOS_API_URL`.
- **MOVOS API**: container (`apps/movos-api/Dockerfile`, `node:20-alpine`),
  deployed to any container host with a managed PostgreSQL. Runs
  `prisma migrate deploy` on release, then `node dist/main`.
- **Database**: managed PostgreSQL 16.
- CORS on the API must list the web origin and allow credentials.
