# CAP-009 — TariffSnapshot Model & Relationships

**Generated:** 2026-08-03 (WO-ARGOS-017, Objectives 2 and 3)
**Status:** IMPLEMENTED (schema + interface only). `TariffSnapshot` exists as a real Prisma model, migrated onto `movos_dev` (`prisma/migrations/20260803213813_add_billing_account_and_tariff_snapshot`). `TariffSnapshotService` exists as a TypeScript interface only — no implementing class, no NestJS wiring, no cost/invoice/balance calculation. See "Not implemented" at the end.
**Materializes:** [CAP-008_DECISION.md](./CAP-008_DECISION.md)'s tariff-timing choice (Option C — a snapshot captured at session start and again at each pricing-relevant boundary crossed, degenerating to a single snapshot for a session that crosses none).
**Grounding discipline:** every field, constraint, and relation described below is quoted directly from `apps/movos-api/prisma/schema.prisma` and `apps/movos-api/src/billing/tariff-snapshot.service.interface.ts` on this branch.

---

## Objective 2 — The entity

```prisma
model TariffSnapshot {
  id                String @id @default(cuid())
  chargingSessionId String
  organizationId    String

  energyPricePerKwh Decimal @db.Decimal(12, 6)
  pricePerMinute    Decimal @db.Decimal(12, 6)
  fixedFee          Decimal @db.Decimal(12, 2)
  currency          String
  timezone          String
  effectiveAt       DateTime

  createdAt DateTime @default(now())

  chargingSession ChargingSession @relation(fields: [chargingSessionId], references: [id])
  organization    Organization    @relation(fields: [organizationId], references: [id])

  @@index([chargingSessionId, effectiveAt])
}
```

Every field the work order required to be frozen is present: energy price per kWh, price per minute, fixed fee, currency, timezone, and an effective timestamp.

### Why `Decimal`, never `Float`, for the three price fields

Money is never stored as a binary floating-point type in this schema — `Float` cannot represent most decimal fractions exactly (the canonical example: `0.1 + 0.2 !== 0.3` in IEEE-754), which is an unacceptable property for a value this document's whole purpose is to make immutably, reproducibly correct. `energyPricePerKwh`/`pricePerMinute` use `Decimal(12, 6)` (6 fractional digits — sub-cent precision, appropriate for a per-kWh or per-minute _rate_ that gets multiplied by a quantity) and `fixedFee` uses `Decimal(12, 2)` (ordinary 2-decimal currency precision, appropriate for a flat amount). This is a new precedent in this schema — no prior model stored a monetary value — established here deliberately rather than left to be improvised inconsistently by whichever future model needs money next.

### Why `timezone` is its own field, not inferred

`effectiveAt` is a `DateTime` (stored, like every other timestamp in this schema, without an implicit timezone assumption baked into the column type). Whether a given moment falls inside a "peak," "off-peak," "day," or "night" window — the entire reason `CAP-008_DECISION.md` Option C needs boundary detection at all — depends on interpreting `effectiveAt` against a specific IANA timezone (e.g. `"America/Bogota"`), not the database server's own timezone or UTC. Storing it explicitly, per snapshot, means a snapshot remains correctly interpretable even if a station's site is later reassigned, or if a future multi-region deployment runs the database server itself in a different timezone than any site it serves.

### Why `organizationId` is denormalized here too, and may legitimately differ from the session's own

`ChargingSession.organizationId` identifies who operates the station the session happened at. `TariffSnapshot.organizationId` identifies whose tariff produced the frozen rate. `DEC-018`'s roaming case is the reason these are not forced to be the same value: a visiting network's session, physically occurring at Organization A's station, may be priced from Organization B's tariff (the visiting driver's home network). Denormalizing `organizationId` onto `TariffSnapshot` independently — rather than only deriving it through `chargingSessionId → ChargingSession.organizationId` — is what makes that case representable at all, consistent with the same session-level denormalization precedent CAP-004 already established (`ChargingSession` stores `organizationId`/`siteId`/etc. directly rather than deriving them through its own parent chain).

## Immutability, append-only, auditability

The work order requires all three. Here is exactly how each is achieved in this foundation, and exactly what is _not_ enforced yet:

- **Immutable.** There is no `updatedAt` field on `TariffSnapshot` — unlike every other model in this schema, deliberately. A model with an `updatedAt` column implicitly documents that updates are an expected, normal occurrence; a `TariffSnapshot` row is never expected to change after it is written, so that column was omitted rather than added and then simply never used. The stronger guarantee — that no code path _can_ update one — comes from `TariffSnapshotService`'s own interface (below), which has no `update` method at all.
- **Append-only.** `TariffSnapshotService` has no `delete` method either. A snapshot, once captured, exists for as long as the database row does — and per the same no-cascade finding `CAP-008_BILLING_MODEL.md` Objective 3 already established, nothing in this schema can delete it as a side effect of deleting anything else (its foreign keys to `ChargingSession` and `Organization` are both the default `RESTRICT`-on-delete behavior for required relations).
- **Auditable.** Every snapshot carries `effectiveAt` (the business-meaningful moment its terms began applying) _and_ `createdAt` (when the row was physically written) as two distinct fields — deliberately not collapsed into one, so a snapshot captured retroactively (e.g. a backfill or correction workflow, should one ever be built) remains distinguishable from one captured live. Combined with `chargingSessionId`/`organizationId`, any snapshot can be traced to exactly the session and tenant it applied to, and — because nothing can update or delete it — a query made against it today will return the same answer years from now, which is the literal property `DEC-018`'s regulatory-audit finding requires.

**What is honestly not enforced:** none of the three guarantees above is backed by a database trigger or a `REVOKE UPDATE`-style permission lock — Postgres offers both, but building either is application/infrastructure logic beyond "design the entity" and "create interfaces only," the explicit boundaries this work order set for Objectives 2 and 4. Immutability here is an _application-level contract_ (no method exists to violate it) and a _schema-level absence_ (no `updatedAt` to update), not a database-level impossibility. This is the same honest boundary `CAP-008_BILLING_THREAT_MODEL.md` already drew for `AuditEvent`'s own append-only convention — stated here explicitly rather than implied.

## Objective 3 — Relationships and cardinality

```
Organization
    ↓
BillingAccount ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ ⇢ (0..1 per session, nullable)
    ↓                                                        ↓
    └──────────────────────────────────────────────► ChargingSession
                                                               ↓ (1..N)
                                                       TariffSnapshot
```

| Relationship                         | Cardinality                                                    | Enforced by                                                                                    |
| ------------------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Organization` → `BillingAccount`    | one-to-many                                                    | `BillingAccount.organizationId` required FK, `RESTRICT` on delete                              |
| `BillingAccount` → `ChargingSession` | one-to-many, **optional on the session side**                  | `ChargingSession.billingAccountId` nullable FK, `SET NULL` on delete                           |
| `ChargingSession` → `TariffSnapshot` | one-to-many                                                    | `TariffSnapshot.chargingSessionId` required FK, `RESTRICT` on delete                           |
| `Organization` → `TariffSnapshot`    | one-to-many, **independent of the session's own organization** | `TariffSnapshot.organizationId` required FK, `RESTRICT` on delete — see the roaming note above |

### "One session has exactly one BillingAccount" — the honest gap between the target invariant and what's enforced today

The work order states this as a rule to document. As implemented, `ChargingSession.billingAccountId` is **nullable** — a session can have zero or one `BillingAccount`, not exactly one, enforced. This is a deliberate, documented deviation, not an oversight, for two independently sufficient reasons:

1. **No historical session can be retroactively assigned one.** Every `ChargingSession` row that existed in `movos_dev` before this migration has no `BillingAccount` to reference and cannot be fabricated one.
2. **`CAP-008_BILLING_MODEL.md`'s own headline finding says some sessions never will.** A shopping-mall walk-up session (`CAP-008_SCENARIOS.md` §2) may be paid for and completed without ever creating a durable `BillingAccount` at all.

The rule "exactly one" is therefore recorded here as the **target invariant for a session that has been fully billed**, not as a database-level guarantee for every session unconditionally — the distinction is stated precisely in `docs/domain/CAP-009_INVARIANTS.md`, which is the authoritative statement of exactly what is and isn't enforced today.

### "One session can have multiple TariffSnapshots" — fully enforced

`TariffSnapshot.chargingSessionId` is a plain (non-unique) required foreign key — nothing caps how many snapshots one session accumulates, and the `[chargingSessionId, effectiveAt]` index exists specifically to make "all snapshots for this session, in order" a cheap, ordinary query once a session has several.

### "Snapshots cannot move between sessions"

`chargingSessionId` is set once, at creation (`capture()` on `TariffSnapshotService` is the only method that writes it), and there is no `update` method capable of changing it afterward — the same immutability guarantee from Objective 2 applied to this specific field. A snapshot's session assignment is exactly as permanent as every other one of its fields.

## The service contract

```ts
export interface CaptureTariffSnapshotInput {
  chargingSessionId: string;
  organizationId: string;
  energyPricePerKwh: string;
  pricePerMinute: string;
  fixedFee: string;
  currency: string;
  timezone: string;
  effectiveAt: Date;
}

export interface TariffSnapshotService {
  capture(input: CaptureTariffSnapshotInput): Promise<TariffSnapshot>;
  findByChargingSession(chargingSessionId: string): Promise<TariffSnapshot[]>;
  findLatestForSession(
    chargingSessionId: string,
  ): Promise<TariffSnapshot | null>;
}
```

The three Decimal-backed price fields are typed as `string` on the input DTO, not `number` — the same float-precision reasoning as the schema itself, applied one layer earlier so a caller never has a chance to pass a lossy floating-point value across the boundary in the first place.

Three methods only: `capture` (the sole write path — there is no `update`/`delete`), and two read paths. No cost calculation, no session-total aggregation, no balance of any kind.

## Not implemented

No implementing class for `TariffSnapshotService` exists; no cost-calculation logic (summing snapshots against a session's energy/duration to produce a total); no `Invoice` linkage; no UI; no wiring into `app.module.ts`. The snapshot-triggering rule (which specific events cause a new capture), the energy-attribution rule for splitting a session's energy across snapshot boundaries when `MeterValue` telemetry is sparse, and which clock governs pricing all remain exactly as open as `CAP-008_DECISION.md` left them — this foundation provides the entity and the contract to eventually resolve them against, not the resolution itself.
