# MOVOS Database Inventory v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

The complete Prisma schema (`apps/movos-api/prisma/schema.prisma`). Six models, seven enums, two migrations (`init`, `add_location_fields`). This is the entirety of the persisted data model — no second schema file and no raw SQL migrations exist outside Prisma's own migration folder.

## Models

| Model            | Key fields                                                                            | Relations                                                             | Constraints                        |
| ---------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------- |
| `User`           | email, passwordHash, displayName, status                                              | 1–N Membership, RefreshSession, AuditEvent; 1–N Site (as `createdBy`) | Unique: `email`                    |
| `Organization`   | name, slug, status                                                                    | 1–N Membership, Site, AuditEvent                                      | Unique: `slug`                     |
| `Membership`     | role, status                                                                          | N–1 User, Organization                                                | Unique: `[userId, organizationId]` |
| `Site`           | name, slug, city, address, latitude/longitude, status + 10 location-enrichment fields | N–1 Organization, N–1 User (`createdBy`)                              | Unique: `[organizationId, slug]`   |
| `RefreshSession` | tokenHash, expiresAt, revokedAt, userAgent, ipAddress                                 | N–1 User                                                              | Unique: `tokenHash`                |
| `AuditEvent`     | action, subjectType, subjectId, metadata (Json)                                       | Optional N–1 Organization, optional N–1 User (as `actor`)             | None beyond primary key            |

## Enums

| Enum                       | Values                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `UserStatus`               | INVITED, ACTIVE, SUSPENDED, ARCHIVED                                                                                                 |
| `OrgStatus`                | ACTIVE, INACTIVE, ARCHIVED                                                                                                           |
| `MemberRole`               | OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER — only the first three are ever checked in application code (`@Roles()` decorators) |
| `MemberStatus`             | INVITED, ACTIVE, SUSPENDED                                                                                                           |
| `SiteStatus`               | DRAFT, ACTIVE, INACTIVE, ARCHIVED                                                                                                    |
| `LocationSource`           | GOOGLE_PLACES, GOOGLE_GEOCODING, MANUAL, MANUAL_ADJUSTMENT                                                                           |
| `LocationValidationStatus` | UNVALIDATED, SUGGESTED, CONFIRMED, PARTIAL, INVALID                                                                                  |

## Maturity and gaps

- IDs are `cuid()` everywhere — no sequential integers exposed. Sound baseline hygiene.
- No indexes exist beyond primary keys and the unique constraints above. `AuditEvent` has none on `organizationId` or `occurredAt`, despite being the one table with no natural growth ceiling — this will matter once audit queries by date range become real usage, not before.
- `Site.locationValidatedAt` is defined in the schema but never written to by any service code (`sites.service.ts`) — a field that exists with no code path that populates it.
- Soft-delete precedent exists only via `Site.status = ARCHIVED`; no repository-wide convention is documented for entities that don't exist yet.
- Zero models for the entire EV domain: no `Station`, `Charger`, `Connector`, `ChargingSession`, `Tariff`, or `Alert` table exists anywhere in `schema.prisma`.

## What the frontend already assumes, that the schema doesn't have yet

`apps/movos-web/src/types/{station,charger,connector,session,tariff,alert}.ts` define a complete TypeScript shape for exactly the six missing entities. This is real design work already done once — any Prisma modeling for these entities should start from these types rather than be designed from scratch. See [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md).
