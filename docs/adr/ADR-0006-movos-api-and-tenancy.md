# ADR-0006: MOVOS API, authentication and multi-tenancy

| Property   | Value                     |
| ---------- | ------------------------- |
| Status     | Approved                  |
| Date       | 2026-07-15                |
| Author     | VULCAN                    |
| Supersedes | —                         |

## Context

The MOVOS foundation (ADR-0005) shipped a navigable operator console backed by
typed demo data with no backend, no authentication, and no persistence. To
support real paying customers we need the first operational vertical slice:
real login/logout/refresh, multi-tenant organization isolation, and persistent
Sites in a real database. This must be built without leaking the pilot customer
(Kylum) into the product and without exposing server-only concerns (Prisma
models, password hashes) to the web client.

## Decision

Introduce a standalone backend application, **`apps/movos-api`**, built with:

1. **NestJS 10 + TypeScript strict mode**, REST under the `/api/v1` prefix.
2. **Prisma ORM + PostgreSQL 16** for persistence (`User`, `Organization`,
   `Membership`, `Site`, `RefreshSession`, `AuditEvent`).
3. **JWT authentication with rotating refresh tokens**:
   - Short-lived (15 min) access JWT returned in the response body and stored
     **in memory** on the web client.
   - Long-lived (7 day) opaque refresh token in an **httpOnly, SameSite=strict**
     cookie (`movos_refresh`), stored **hashed** server-side and rotated on use.
4. **Server-enforced multi-tenancy**: an `OrgContextGuard` re-validates ACTIVE
   membership on every tenant-scoped request; a `RolesGuard` enforces
   role-based permissions; service queries are additionally org-scoped.
5. **Explicit API contracts** in `@mediafox/shared-types` shared with the web
   client. Prisma-generated types never cross the boundary.
6. The web app integrates via an `api-client` (automatic 401 → refresh → retry),
   an `AuthProvider` context, a login route, and Next.js middleware that gates
   routes on the non-secret `movos_session` cookie (no JWT decoding in
   middleware).

## Alternatives considered

- **Backend-for-frontend inside Next.js (Route Handlers).** Rejected: MOVOS is
  API-first and multi-consumer; a dedicated, independently deployable API is the
  correct long-term boundary.
- **Session cookies only (no access JWT).** Rejected: the API must serve
  non-browser and multi-tenant clients; a stateless access token with an
  explicit `orgId` claim fits better and keeps the API horizontally scalable.
- **Storing the access token in localStorage.** Rejected: XSS-exfiltration risk.
  In-memory access token + httpOnly refresh cookie is the standard hardened
  pattern.
- **bcrypt-hashing refresh tokens.** Rejected for the lookup column: bcrypt's
  per-row salt prevents unique-hash lookup. Refresh tokens are 122-bit random
  UUIDs stored as SHA-256 hashes, which is one-way and lookup-friendly.
- **Row-level security in PostgreSQL.** Deferred: application-layer guards plus
  org-scoped queries are sufficient for this slice; RLS can be layered later.

## Consequences

- MOVOS gains real auth, real tenancy, and persistent Sites — the minimum to
  onboard a paying operator.
- The monorepo now has a backend app with its own toolchain (NestJS, Prisma,
  jest, Docker) alongside the Next.js apps.
- `@mediafox/shared-types` becomes a real, populated package.
- Deferred (documented honestly): rate limiting, email verification, MFA, CSRF
  tokens (mitigated by httpOnly + SameSite=strict), password reset, org
  invitations, and persistence for the remaining domains (stations, chargers,
  connectors, sessions, tariffs, alerts).
- Runtime target is Node 20 LTS (repo prerequisite; API Docker image
  `node:20-alpine`).

## Related

- ADR-0005: MOVOS is the commercial mobility platform
- `docs/architecture/MOVOS_PLATFORM_FOUNDATION.md`
- `docs/product/MOVOS.md`
