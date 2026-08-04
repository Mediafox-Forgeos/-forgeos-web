# CAP-009 — TariffSnapshot Model & Relationships

**Generated:** 2026-08-03 (WO-ARGOS-017, Objectives 2 and 3); hardened 2026-08-04 (WO-ARGOS-017A) — see "Currency consistency" and the relationship table below.
**Status:** IMPLEMENTED (schema + interface only). `TariffSnapshot` exists as a real Prisma model, migrated onto `movos_dev`. `TariffSnapshotService` exists as a TypeScript interface only — no implementing class, no NestJS wiring, no cost/invoice/balance calculation. See "Not implemented" at the end.
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

**What is honestly not enforced:** none of the three guarantees above is backed by a database trigger or a `REVOKE UPDATE`-style permission lock. Immutability here is an _application-level contract_ (no method exists to violate it) and a _schema-level absence_ (no `updatedAt` to update), not a database-level impossibility. This is the same honest boundary `CAP-008_BILLING_THREAT_MODEL.md` already drew for `AuditEvent`'s own append-only convention. This finding is unchanged by WO-ARGOS-017A — that work order added database-level enforcement for the cross-row _currency-consistency_ rule specifically (below), not for update/delete prevention generally, which remains exactly as described here.

## Currency consistency (WO-ARGOS-017A)

**Domain rule:** once the first `TariffSnapshot` is created for a `ChargingSession`, that session's currency is immutable — every later snapshot for the same session must use the same currency.

**Enforcement: a database trigger, evaluated against three alternatives and chosen as the smallest mechanism that actually closes the gap.**

| Option                                                                                                | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application service validation                                                                        | Rejected as the _sole_ mechanism — it only holds for callers going through `TariffSnapshotService`'s (still nonexistent) concrete implementation; a raw Prisma call anywhere else in the codebase would bypass it entirely, same as every other application-contract-only guarantee in this document.                                                                                                                                          |
| Plain `CHECK` constraint                                                                              | Not viable at all — a `CHECK` constraint evaluates one row in isolation; it cannot compare a new row against sibling rows for the same `chargingSessionId`.                                                                                                                                                                                                                                                                                    |
| Denormalized `ChargingSession.currency` + composite FK (mirroring Objective 1's tenant-isolation fix) | Evaluated and rejected: this would require `ChargingSession.currency` to already hold the correct value _before_ the first snapshot is inserted, which nothing in this interfaces-only foundation has a way to orchestrate — unlike Objective 1's composite FK, where both sides of the pair are already known at `ChargingSession` creation time, here there is a genuine bootstrapping problem a purely declarative constraint cannot solve. |
| **Trigger** (chosen)                                                                                  | A single `BEFORE INSERT` trigger on `TariffSnapshot` that looks up any existing sibling row for the same `chargingSessionId` and rejects the insert (`RAISE EXCEPTION`, `check_violation`/`23514`) if the currency differs. Self-contained — touches only `TariffSnapshot`, no `ChargingSession` schema change needed. The first trigger in this schema; deliberately scoped to exactly this one rule.                                         |

```sql
CREATE OR REPLACE FUNCTION enforce_tariff_snapshot_currency_consistency()
RETURNS TRIGGER AS $$
DECLARE
  existing_currency TEXT;
BEGIN
  SELECT "currency" INTO existing_currency
  FROM "TariffSnapshot"
  WHERE "chargingSessionId" = NEW."chargingSessionId"
  LIMIT 1;

  IF existing_currency IS NOT NULL AND existing_currency <> NEW."currency" THEN
    RAISE EXCEPTION
      'TariffSnapshot currency mismatch: ChargingSession % already has snapshots in %, cannot add one in %',
      NEW."chargingSessionId", existing_currency, NEW."currency"
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tariff_snapshot_currency_consistency
BEFORE INSERT ON "TariffSnapshot"
FOR EACH ROW
EXECUTE FUNCTION enforce_tariff_snapshot_currency_consistency();
```

Migration `20260804024403_add_tariff_snapshot_currency_consistency_trigger`. Verified live against real Postgres: two same-currency snapshots for one session succeed; a third, mismatched-currency snapshot for that same session is rejected with the exact error above; two _different_ sessions may independently use two different currencies from each other without conflict (see `test/billing-foundation.e2e-spec.ts`).

**A known, accepted limitation of a raw-SQL-only trigger in a Prisma project, stated honestly:** `schema.prisma` has no representation of triggers at all — this trigger exists only in the migration's SQL, invisible to `schema.prisma` and to `prisma validate`. It survives ordinary `prisma migrate deploy`/`migrate status` correctly (both replay tracked migration history verbatim, so the trigger is created exactly as any other tracked schema change would be), but it would **not** be reconstructed if the database were ever built by any process other than replaying this migration history — for example, `prisma db push` (which diffs directly against `schema.prisma`, not migration history) — and it would **not** appear if someone ran `prisma db pull` to reverse-engineer a schema from the live database, since Prisma's introspection doesn't model triggers either. Documented here so this doesn't become an undiscoverable surprise for a future maintainer.

## Objective 3 — Relationships and cardinality

```
Organization
    ↓
BillingAccount ──────────────────────────────────────── (exactly 1 per session, same tenant)
    ↓                                                        ↓
    └──────────────────────────────────────────────► ChargingSession
                                                               ↓ (1..N)
                                                       TariffSnapshot
```

| Relationship                         | Cardinality                                                     | Enforced by                                                                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Organization` → `BillingAccount`    | one-to-many                                                     | `BillingAccount.organizationId` required FK, `RESTRICT` on delete                                                                                                                                            |
| `BillingAccount` → `ChargingSession` | one-to-many, **required on the session side, same tenant only** | `ChargingSession.(organizationId, billingAccountId)` required composite FK → `BillingAccount.(organizationId, id)`, `RESTRICT` on delete. Hardened by WO-ARGOS-017A — see below and `CAP-009_INVARIANTS.md`. |
| `ChargingSession` → `TariffSnapshot` | one-to-many                                                     | `TariffSnapshot.chargingSessionId` required FK, `RESTRICT` on delete                                                                                                                                         |
| `Organization` → `TariffSnapshot`    | one-to-many, **independent of the session's own organization**  | `TariffSnapshot.organizationId` required FK, `RESTRICT` on delete — see the roaming note above                                                                                                               |

### "One session has exactly one BillingAccount" — now enforced, hardened by WO-ARGOS-017A

Originally implemented with a nullable `billingAccountId` (WO-ARGOS-017), documented at the time as a deliberate deviation from the literal "exactly one" wording. ARGOS's review of PR #34 found this mismatched the already-approved invariant and directed Option A: backfill every pre-existing session with a per-organization `SYSTEM_DEFAULT` `BillingAccount`, then make the column required. **`ChargingSession.billingAccountId` is now `String`, not `String?`** — every session has exactly one `BillingAccount`, database-enforced, no exceptions, including the deployment shapes (`CAP-008_SCENARIOS.md` §2's anonymous shopping-mall walk-up) that have no _real_ debtor: those sessions are attached to their organization's `SYSTEM_DEFAULT` placeholder rather than left `NULL`. See `CAP-009_BILLING_ACCOUNT_MODEL.md`'s "Hardening record" and `CAP-009_ARCHIVAL_POLICY.md` for the full backfill mechanics and evidence.

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

No implementing class for `TariffSnapshotService` exists; no cost-calculation logic (summing snapshots against a session's energy/duration to produce a total); no `Invoice` linkage; no UI; no wiring into `app.module.ts`. The snapshot-triggering rule (which specific events cause a new capture), the energy-attribution rule for splitting a session's energy across snapshot boundaries when `MeterValue` telemetry is sparse, and which clock governs pricing all remain exactly as open as `CAP-008_DECISION.md` left them — this foundation provides the entity and the contract to eventually resolve them against, not the resolution itself. Cross-snapshot currency consistency (above) is the one rule from this list that _is_ now enforced, by WO-ARGOS-017A — everything else in this paragraph remains open.
