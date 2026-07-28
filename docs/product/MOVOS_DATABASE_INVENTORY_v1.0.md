# MOVOS Database Inventory v1.0

**Atlas version:** v1.0 · **Generated:** 2026-07-24 · **Repository HEAD:** `main` @ `bfea8db`
**Updated:** 2026-07-27 — CAP-002 charging core models added, see note below.
**Part of:** [MOVOS Product Atlas](./MOVOS_PRODUCT_ATLAS_v1.0.md)

The complete Prisma schema (`apps/movos-api/prisma/schema.prisma`). Nine models, thirteen enums, three migrations (`init`, `add_location_fields`, `add_charging_core_domain`). This is the entirety of the persisted data model — no second schema file and no raw SQL migrations exist outside Prisma's own migration folder.

## Models

| Model             | Key fields                                                                            | Relations                                                                | Constraints                               |
| ----------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `User`            | email, passwordHash, displayName, status                                              | 1–N Membership, RefreshSession, AuditEvent; 1–N Site (as `createdBy`)    | Unique: `email`                           |
| `Organization`    | name, slug, status                                                                    | 1–N Membership, Site, AuditEvent                                         | Unique: `slug`                            |
| `Membership`      | role, status                                                                          | N–1 User, Organization                                                   | Unique: `[userId, organizationId]`        |
| `Site`            | name, slug, city, address, latitude/longitude, status + 10 location-enrichment fields | N–1 Organization, N–1 User (`createdBy`); 1–N ChargingStation            | Unique: `[organizationId, slug]`          |
| `ChargingStation` | name, code, manufacturer, model, serialNumber, protocol, status, commissionedAt       | N–1 Site; 1–N Evse                                                       | Unique: `[siteId, code]`                  |
| `Evse`            | externalId, name, status, maxPowerKw, currentType, phaseType                          | N–1 ChargingStation; 1–N Connector — no `organizationId`/`siteId` stored | Unique: `[chargingStationId, externalId]` |
| `Connector`       | externalId, type, status, maxPowerKw                                                  | N–1 Evse — no `organizationId`/`siteId`/`chargingStationId` stored       | Unique: `[evseId, externalId]`            |
| `RefreshSession`  | tokenHash, expiresAt, revokedAt, userAgent, ipAddress                                 | N–1 User                                                                 | Unique: `tokenHash`                       |
| `AuditEvent`      | action, subjectType, subjectId, metadata (Json)                                       | Optional N–1 Organization, optional N–1 User (as `actor`)                | None beyond primary key                   |

## Enums

| Enum                       | Values                                                                                                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `UserStatus`               | INVITED, ACTIVE, SUSPENDED, ARCHIVED                                                                                                                                                       |
| `OrgStatus`                | ACTIVE, INACTIVE, ARCHIVED                                                                                                                                                                 |
| `MemberRole`               | OWNER, ADMIN, OPERATOR, SUPPORT, ANALYST, VIEWER — only the first three are ever checked in application code (`@Roles()` decorators)                                                       |
| `MemberStatus`             | INVITED, ACTIVE, SUSPENDED                                                                                                                                                                 |
| `SiteStatus`               | DRAFT, ACTIVE, INACTIVE, ARCHIVED                                                                                                                                                          |
| `LocationSource`           | GOOGLE_PLACES, GOOGLE_GEOCODING, MANUAL, MANUAL_ADJUSTMENT                                                                                                                                 |
| `LocationValidationStatus` | UNVALIDATED, SUGGESTED, CONFIRMED, PARTIAL, INVALID                                                                                                                                        |
| `ChargingStationStatus`    | DRAFT, ACTIVE, INACTIVE, ARCHIVED — administrative lifecycle, not operational availability                                                                                                 |
| `EvseStatus`               | AVAILABLE, CHARGING, OCCUPIED, RESERVED, UNAVAILABLE, FAULTED, OFFLINE — CAP-002 CRUD only ever writes AVAILABLE/UNAVAILABLE/OFFLINE; the rest are reserved for the future OCPP capability |
| `ConnectorStatus`          | Same 7 values as `EvseStatus`, kept as a distinct enum per this schema's one-enum-per-entity convention (matches `UserStatus`/`OrgStatus`/`MemberStatus`/`SiteStatus` precedent)           |
| `ConnectorType`            | CCS2, TYPE2, CHADEMO — reused as-is from the frontend's existing `ConnectorType`, casing normalized                                                                                        |
| `CurrentType`              | AC, DC                                                                                                                                                                                     |
| `PhaseType`                | SINGLE_PHASE, THREE_PHASE                                                                                                                                                                  |

## Maturity and gaps

- IDs are `cuid()` everywhere — no sequential integers exposed. Sound baseline hygiene.
- No indexes exist beyond primary keys and the unique constraints above. `AuditEvent` has none on `organizationId` or `occurredAt`, despite being the one table with no natural growth ceiling — this will matter once audit queries by date range become real usage, not before.
- `Site.locationValidatedAt` is defined in the schema but never written to by any service code (`sites.service.ts`) — a field that exists with no code path that populates it.
- Soft-delete precedent exists only via `Site.status = ARCHIVED`; `ChargingStation`/`Evse`/`Connector` follow the same convention (status-based deactivation, no hard delete).
- `Evse` and `Connector` deliberately store no `organizationId` or `siteId` — ownership resolves through the parent relation chain (`evse.chargingStation.site.organizationId`) in a single Prisma query at every service call, never a denormalized column.
- Still zero models for `ChargingSession`, `Tariff`, or `Alert` — CAP-002 explicitly implements CRUD for `ChargingStation`/`Evse`/`Connector` only, with no OCPP communication, sessions, tariffs, reservations, or payments.

## What the frontend already assumes, that the schema doesn't have yet

`apps/movos-web/src/types/{station,charger,connector,session,tariff,alert}.ts` define a complete TypeScript shape for these entities. CAP-002 implements the backend for `station`/`charger`/`connector` only (as `ChargingStation`/`Evse`/`Connector` — not a 1:1 rename; see [CAP-002 Charging Terminology Mapping](../domain/CAP-002_CHARGING_TERMINOLOGY_MAPPING.md)), and does not yet update the frontend to consume it. `session`, `tariff`, and `alert` remain frontend-only design work with no backend counterpart. See [MVP Gap Analysis](./MOVOS_MVP_GAP_ANALYSIS_v1.0.md).
