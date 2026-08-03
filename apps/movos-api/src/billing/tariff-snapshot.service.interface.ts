import type { TariffSnapshot } from '@prisma/client';

/**
 * CAP-009 (WO-ARGOS-017) — the domain-service contract for TariffSnapshot,
 * materializing docs/domain/CAP-008_DECISION.md's tariff-timing choice
 * (Option C: a snapshot captured at session start and again at each
 * pricing-relevant boundary crossed).
 *
 * Interface only, per this work order's explicit scope: no implementing
 * class exists yet, and no method here may calculate a session's total
 * cost or a running balance — that remains Architecture Backlog #24
 * (Tariffs) / #25 (Billing), not this foundation. See
 * docs/domain/CAP-009_TARIFF_SNAPSHOT_MODEL.md.
 */

export interface CaptureTariffSnapshotInput {
  chargingSessionId: string;
  /** Denormalized — may legitimately differ from the session's own
   * organizationId in a roaming case (DEC-018). */
  organizationId: string;
  /** Decimal values are passed as strings at this boundary, not `number`,
   * to avoid IEEE-754 float precision loss on money before it ever
   * reaches the `Decimal`-typed database column. */
  energyPricePerKwh: string;
  pricePerMinute: string;
  fixedFee: string;
  /** ISO 4217 currency code — must match every other TariffSnapshot for
   * the same ChargingSession (CAP-009_INVARIANTS.md). */
  currency: string;
  /** IANA timezone name (e.g. "America/Bogota"). */
  timezone: string;
  effectiveAt: Date;
}

export interface TariffSnapshotService {
  /**
   * Captures a new, immutable TariffSnapshot. There is deliberately no
   * `update`/`delete` method on this interface — snapshots are
   * append-only by construction.
   */
  capture(input: CaptureTariffSnapshotInput): Promise<TariffSnapshot>;

  /** All snapshots for one session, ordered by `effectiveAt` ascending. */
  findByChargingSession(chargingSessionId: string): Promise<TariffSnapshot[]>;

  /** The snapshot currently in effect for a session, or null if none has been captured yet. */
  findLatestForSession(
    chargingSessionId: string,
  ): Promise<TariffSnapshot | null>;
}
