import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ChargingSessionStatus,
  Prisma,
  type ChargingSession,
  type ChargingSessionTerminationReason,
  type OcppProtocolVersion,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TransactionIdGeneratorService } from './transaction-id-generator.service';
import { InvalidSessionTransitionError } from './session-lifecycle.errors';

/** A regular PrismaService call or an interactive-transaction client — the
 * subset of methods used throughout this service (chargingSession.*,
 * billingAccount.*) is structurally identical on both, so private helpers
 * that need to participate in createSession's WO-ARGOS-063 transaction
 * accept either. */
type Db = PrismaService | Prisma.TransactionClient;

/** WO-ARGOS-063 — single source of truth for how long an OFFLINE session
 * remains legitimately recoverable, shared by createSession's new-
 * StartTransaction collision guard (isOfflineSessionRecoverable below) and
 * ConnectivityCoordinator.attemptRecovery's reconnect path (which re-exports
 * this value as its own static RECOVERY_WINDOW_MS, unchanged, for the
 * existing public reference in its spec). Moved here, not duplicated —
 * value itself is unchanged: 3x the current global heartbeat interval
 * (BootNotification.conf's hardcoded 300s), per DEC-017's approved policy. */
export const OFFLINE_RECOVERY_WINDOW_MS = 3 * 300_000;

export interface CreateSessionInput {
  organizationId: string;
  siteId: string;
  chargingStationId: string;
  evseId: string;
  connectorId: string;
  authorizationCredentialId: string;
  protocolVersion: OcppProtocolVersion;
  meterStart: number;
  startedAt: Date;
}

export interface StopSessionInput {
  meterStop: number;
  reason: ChargingSessionTerminationReason;
  endedAt?: Date;
}

/** Non-terminal statuses — a connector may have at most one session in one
 * of these at a time (see createSession's idempotency check below). */
const NON_TERMINAL_STATUSES: ChargingSessionStatus[] = [
  ChargingSessionStatus.PENDING,
  ChargingSessionStatus.AUTHORIZED,
  ChargingSessionStatus.STARTING,
  ChargingSessionStatus.ACTIVE,
  ChargingSessionStatus.SUSPENDED,
  ChargingSessionStatus.OFFLINE,
  ChargingSessionStatus.STOPPING,
];

/** The allowed-transitions table from CAP-004_CHARGING_SESSIONS_
 * FOUNDATION.md §8. SUSPENDED shares OFFLINE's rules (both mean
 * "logically active, temporarily not delivering energy," distinguished
 * only by cause), so both are reachable from and return to ACTIVE. */
export const ALLOWED_TRANSITIONS: Record<
  ChargingSessionStatus,
  ChargingSessionStatus[]
> = {
  [ChargingSessionStatus.PENDING]: [
    ChargingSessionStatus.AUTHORIZED,
    ChargingSessionStatus.CANCELLED,
    ChargingSessionStatus.FAILED,
  ],
  [ChargingSessionStatus.AUTHORIZED]: [
    ChargingSessionStatus.STARTING,
    ChargingSessionStatus.CANCELLED,
    ChargingSessionStatus.FAILED,
  ],
  [ChargingSessionStatus.STARTING]: [
    ChargingSessionStatus.ACTIVE,
    ChargingSessionStatus.FAILED,
    ChargingSessionStatus.CANCELLED,
  ],
  [ChargingSessionStatus.ACTIVE]: [
    ChargingSessionStatus.STOPPING,
    ChargingSessionStatus.OFFLINE,
    ChargingSessionStatus.SUSPENDED,
    ChargingSessionStatus.FAILED,
    ChargingSessionStatus.CANCELLED,
  ],
  [ChargingSessionStatus.OFFLINE]: [
    ChargingSessionStatus.ACTIVE,
    ChargingSessionStatus.SUSPENDED,
    ChargingSessionStatus.FAILED,
    ChargingSessionStatus.STOPPING,
    ChargingSessionStatus.CANCELLED,
  ],
  [ChargingSessionStatus.SUSPENDED]: [
    ChargingSessionStatus.ACTIVE,
    ChargingSessionStatus.OFFLINE,
    ChargingSessionStatus.FAILED,
    ChargingSessionStatus.STOPPING,
    ChargingSessionStatus.CANCELLED,
  ],
  [ChargingSessionStatus.STOPPING]: [
    ChargingSessionStatus.COMPLETED,
    ChargingSessionStatus.FAILED,
  ],
  // Terminal — no outgoing transitions. This is also what makes "a session
  // cannot finish twice" true without a separate check: attempting
  // stopSession()/failSession() on an already-COMPLETED/FAILED/CANCELLED
  // row is rejected here as an invalid transition, same as any other
  // disallowed move.
  [ChargingSessionStatus.COMPLETED]: [],
  [ChargingSessionStatus.FAILED]: [],
  [ChargingSessionStatus.CANCELLED]: [],
};

const TERMINAL_STATUSES = new Set<ChargingSessionStatus>([
  ChargingSessionStatus.COMPLETED,
  ChargingSessionStatus.FAILED,
  ChargingSessionStatus.CANCELLED,
]);

@Injectable()
export class SessionLifecycleService {
  private readonly logger = new Logger(SessionLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly transactionIds: TransactionIdGeneratorService,
  ) {}

  /**
   * The only entry point that inserts a ChargingSession row. Per DEC-014,
   * this is called only from the StartTransaction/TransactionEvent(Started)
   * handler — never from an Authorize-only handler. The credential must
   * already be resolved and ACCEPTED by the caller (AuthorizationAttempt);
   * this method does not re-check credential validity.
   *
   * Idempotency note (refines CAP-004_CHARGING_SESSIONS_FOUNDATION.md §13):
   * StartTransaction has no pre-existing protocolTransactionId to key
   * idempotency on — MOVOS assigns it here, fresh, on every call. A
   * retransmitted StartTransaction is therefore detected by connector, not
   * by transaction id: if the target connector already has a non-terminal
   * session, that session is returned as-is rather than creating a second
   * concurrent one — the same response a genuine retransmission and a
   * connector-already-occupied conflict both need. This is CASE A/B below.
   *
   * WO-ARGOS-063: an OFFLINE session outside the shared recovery window
   * (isOfflineSessionRecoverable) is no longer treated as "the same
   * transaction retrying" — it is explicitly superseded (CASE C) so a
   * genuinely new StartTransaction on that connector gets its own row,
   * identity, and billing, instead of silently corrupting the abandoned
   * one's. See docs/domain/CAP-004_CHARGING_SESSIONS_FOUNDATION.md and
   * MOVOS_OFFLINE_SESSION_NEW_STARTTRANSACTION_COLLISION for the discovery
   * (WO-062) this closes.
   *
   * CASE A/B (an idempotent return, nothing written) is answered by a
   * plain, non-transactional read — identical to this method's pre-
   * WO-063 shape, zero new risk on that path. Only once a write is
   * actually possible (a fresh session, or CASE C's supersede-then-create)
   * does execution enter a SERIALIZABLE transaction — the narrowest locking
   * this schema supports without a migration (no unique constraint exists
   * to key a create-then-catch-P2002 pattern on, unlike BillingAccount's).
   * Two genuinely concurrent createSession calls for the same connector
   * will have one succeed and the other fail with a Postgres serialization
   * conflict (Prisma P2034) rather than silently producing two rows or a
   * corrupted one — a safe failure mode, not a full fix. See WO-063 §8/§21
   * for what this does and does not guarantee.
   *
   * Billing-account resolution always happens on `this.prisma` — its own
   * connection, strictly *before* the transaction below opens — never on
   * `tx`. Two reasons, both confirmed during WO-ARGOS-063 validation: (1)
   * a BillingAccount committed on a different connection *after* `tx`'s own
   * SERIALIZABLE snapshot was established is invisible to `tx`'s FK check
   * on ChargingSession.billingAccountId, producing a spurious FK violation
   * on an organization's first-ever session; (2) resolving it inside `tx`
   * collapses its existing create-then-catch-P2002 concurrent-first-session
   * tolerance (CAP-009/WO-ARGOS-017A, locked in by
   * billing-foundation.e2e-spec.ts) into an unhandled serialization-
   * conflict error under real concurrent load. Resolving it beforehand,
   * on its own connection, preserves that guarantee exactly as before.
   */
  async createSession(input: CreateSessionInput): Promise<ChargingSession> {
    const precheck = await this.prisma.chargingSession.findFirst({
      where: {
        connectorId: input.connectorId,
        status: { in: NON_TERMINAL_STATUSES },
      },
    });
    if (
      precheck &&
      (precheck.status !== ChargingSessionStatus.OFFLINE ||
        this.isOfflineSessionRecoverable(precheck))
    ) {
      // CASE A (any other non-terminal status) or CASE B (OFFLINE, still
      // inside the recovery window) — preserve the existing idempotency/
      // recovery behavior unchanged, no transaction, no billing-account
      // touch, exactly as before WO-063.
      this.logger.log(
        `createSession: connector ${input.connectorId} already has a non-terminal session (${precheck.id}) — returning it, not creating a duplicate`,
      );
      return precheck;
    }

    // CAP-009 (WO-ARGOS-017A): every ChargingSession now requires a
    // BillingAccount (Objective 1, Option A) — resolved once we know a
    // write is coming, before entering the transaction below (see the
    // method doc comment for why).
    const billingAccountId = await this.resolveSystemDefaultBillingAccountId(
      input.organizationId,
    );

    return this.prisma.$transaction(
      async (tx) => {
        // Re-checked inside the transaction: the precheck above is purely
        // an optimization to decide whether billing resolution was needed
        // — it is not the source of truth. Something may have changed
        // between the precheck and here (another caller created or
        // recovered a session on this connector); this is the real,
        // transactionally-consistent decision point.
        const existing = await tx.chargingSession.findFirst({
          where: {
            connectorId: input.connectorId,
            status: { in: NON_TERMINAL_STATUSES },
          },
        });

        if (existing) {
          if (
            existing.status !== ChargingSessionStatus.OFFLINE ||
            this.isOfflineSessionRecoverable(existing)
          ) {
            // Same as CASE A/B above, just re-confirmed post-race. The
            // billingAccountId resolved above goes unused this time —
            // harmless, the same "occasionally wasted work under a race"
            // CAP-009's own P2002 pattern already tolerates.
            this.logger.log(
              `createSession: connector ${input.connectorId} already has a non-terminal session (${existing.id}) — returning it, not creating a duplicate`,
            );
            return existing;
          }

          // CASE C — OFFLINE, outside the recovery window: no longer
          // legitimately recoverable. Terminalize it explicitly instead of
          // letting the incoming StartTransaction silently absorb it.
          await this.supersedeExpiredOfflineSession(tx, existing, input);
        }

        // The PENDING -> AUTHORIZED -> STARTING -> ACTIVE walk (§8)
        // collapses into a single insert here: 1.6J's StartTransaction
        // already implies a validated, physically-connecting device, and no
        // other process ever observes this row between PENDING and ACTIVE
        // within one handler invocation. See ALLOWED_TRANSITIONS above for
        // proof each hop in that walk is independently valid — verified
        // directly in this service's spec, not just asserted here.
        return tx.chargingSession.create({
          data: {
            organizationId: input.organizationId,
            siteId: input.siteId,
            chargingStationId: input.chargingStationId,
            evseId: input.evseId,
            connectorId: input.connectorId,
            authorizationCredentialId: input.authorizationCredentialId,
            protocolVersion: input.protocolVersion,
            protocolTransactionId: this.transactionIds.next(),
            status: ChargingSessionStatus.ACTIVE,
            meterStart: input.meterStart,
            energyWh: 0,
            startedAt: input.startedAt,
            billingAccountId,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * WO-ARGOS-063 — the single, shared definition of "is this OFFLINE session
   * still legitimately recoverable," used by both createSession's CASE B/C
   * split above and ConnectivityCoordinator.attemptRecovery's reconnect
   * path. Must not diverge (WO-063 §2).
   *
   * Uses `updatedAt` as the clock. Investigated whether that's safe: the
   * only writes that ever touch a session's `updatedAt` while it stays
   * OFFLINE are (a) transitions that move it OUT of OFFLINE — which
   * disqualifies it from this check by the status guard below anyway, so
   * they can't silently extend the window — or (b) a MeterValues sample
   * landing in the same event-loop tick as the connectivity-loss
   * transition (a live connection is required to deliver MeterValues at
   * all, so once genuinely disconnected nothing can touch this row's
   * `updatedAt` again). That race is bounded to milliseconds around the
   * disconnect moment, not an arbitrary later extension — not a meaningful
   * threat to the invariant this method exists to enforce. No existing
   * field better represents "when did this session enter OFFLINE," and no
   * new persistence field was introduced for this — `updatedAt` is reused
   * as-is, exactly as ConnectivityCoordinator.attemptRecovery already relied
   * on it before this WO.
   */
  isOfflineSessionRecoverable(session: ChargingSession): boolean {
    if (session.status !== ChargingSessionStatus.OFFLINE) {
      return false;
    }
    return (
      Date.now() - session.updatedAt.getTime() <= OFFLINE_RECOVERY_WINDOW_MS
    );
  }

  /**
   * WO-ARGOS-063 CASE C — terminalizes an OFFLINE session that fell outside
   * the recovery window and is being superseded by a genuinely new
   * StartTransaction on the same connector. Reuses failSession's existing
   * OFFLINE -> FAILED transition machinery (no parallel state engine).
   * `NETWORK_FAILURE` is used as the termination reason: the session's
   * continuity was lost to connectivity, and it was never recovered — not a
   * user/administrative cancellation (explicitly not CANCELLED, per
   * WO-063 decision 3). Never touches meterStart, meterStop, energyWh,
   * authorizationCredentialId, or protocolTransactionId — those remain
   * exactly as the abandoned transaction left them, for historical audit.
   * The audit event is recorded inside the same transaction as the FAILED
   * transition so both roll back together on a serialization conflict.
   */
  private async supersedeExpiredOfflineSession(
    tx: Prisma.TransactionClient,
    expired: ChargingSession,
    input: CreateSessionInput,
  ): Promise<void> {
    await this.failSession(expired.id, 'NETWORK_FAILURE', tx);
    await this.audit.record(
      {
        action: 'SESSION_ABANDONED_ON_NEW_TRANSACTION',
        subjectType: 'ChargingSession',
        subjectId: expired.id,
        metadata: {
          chargingStationId: input.chargingStationId,
          connectorId: input.connectorId,
          protocolTransactionId: expired.protocolTransactionId,
          reason: 'expired-offline-superseded-by-new-transaction',
        },
      },
      tx,
    );
    this.logger.warn(
      `createSession: connector ${input.connectorId}'s OFFLINE session ${expired.id} was outside the recovery window — superseded to FAILED; a new ChargingSession will be created for the incoming StartTransaction`,
    );
  }

  /**
   * Finds the organization's SYSTEM_DEFAULT BillingAccount, creating it on
   * first use. Optimistic-create-then-fallback, not a SELECT-then-INSERT:
   * two concurrent first-ever sessions for the same brand-new organization
   * could otherwise both observe "none exists yet" and both attempt to
   * create one. The partial unique index
   * `BillingAccount_one_system_default_per_org` (one per organizationId,
   * scoped to type=SYSTEM_DEFAULT only) turns the loser's attempt into a
   * detectable P2002 conflict instead of a silent duplicate row — the same
   * create-then-catch-P2002 pattern already used by
   * SitesService/ConnectorsService/EvsesService for their own natural-key
   * races.
   */
  private async resolveSystemDefaultBillingAccountId(
    organizationId: string,
    client: Db = this.prisma,
  ): Promise<string> {
    const existing = await client.billingAccount.findFirst({
      where: { organizationId, type: 'SYSTEM_DEFAULT' },
    });
    if (existing) {
      return existing.id;
    }

    try {
      const created = await client.billingAccount.create({
        data: {
          organizationId,
          type: 'SYSTEM_DEFAULT',
          displayName: 'Default Billing Account (system-created)',
          status: 'ACTIVE',
          currency: 'USD',
        },
      });
      return created.id;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await client.billingAccount.findFirst({
          where: { organizationId, type: 'SYSTEM_DEFAULT' },
        });
        if (winner) {
          return winner.id;
        }
      }
      throw error;
    }
  }

  /** STARTING -> ACTIVE. Not used by the synchronous 1.6J StartTransaction
   * path (createSession already lands on ACTIVE) — reserved for a future
   * MOVOS-initiated RemoteStart flow where activation is a genuinely
   * separate step from authorization. */
  async activateSession(id: string): Promise<ChargingSession> {
    return this.transition(id, ChargingSessionStatus.ACTIVE);
  }

  /** ACTIVE -> SUSPENDED (default) or ACTIVE -> OFFLINE, when explicitly
   * requested. Both share identical transition rules (§8) — the caller
   * decides which by *why* the session is pausing: a device-reported
   * charging suspension (SUSPENDED) vs. a connection loss (OFFLINE, this
   * is how "Handle: ACTIVE -> OFFLINE" is reached — there is no separate
   * markOffline() method beyond the WO's seven named methods). */
  async suspendSession(
    id: string,
    targetStatus: 'SUSPENDED' | 'OFFLINE' = 'SUSPENDED',
  ): Promise<ChargingSession> {
    return this.transition(
      id,
      targetStatus === 'OFFLINE'
        ? ChargingSessionStatus.OFFLINE
        : ChargingSessionStatus.SUSPENDED,
    );
  }

  /** OFFLINE|SUSPENDED -> ACTIVE. */
  async resumeSession(id: string): Promise<ChargingSession> {
    return this.transition(id, ChargingSessionStatus.ACTIVE);
  }

  /**
   * ACTIVE|OFFLINE|SUSPENDED -> STOPPING -> COMPLETED, collapsed into one
   * update for the same reason createSession collapses its walk. Sets
   * meterStop, finalizes energyWh = meterStop - meterStart (never trusting
   * a device-reported energyWh directly — see DEC-016), and endedAt.
   * Refuses (via the transition table — COMPLETED/FAILED/CANCELLED have no
   * outgoing transitions) to re-terminate an already-terminal session.
   */
  async stopSession(
    id: string,
    input: StopSessionInput,
  ): Promise<ChargingSession> {
    const session = await this.requireSession(id);
    this.assertTransitionAllowed(
      session.status,
      ChargingSessionStatus.STOPPING,
    );
    this.assertTransitionAllowed(
      ChargingSessionStatus.STOPPING,
      ChargingSessionStatus.COMPLETED,
    );

    const energyWh = Math.max(0, input.meterStop - session.meterStart);
    if (input.meterStop < session.meterStart) {
      this.logger.warn(
        `stopSession: meterStop (${input.meterStop}) < meterStart (${session.meterStart}) for session ${id} — energyWh floored at 0, not persisted negative`,
      );
    }

    return this.prisma.chargingSession.update({
      where: { id },
      data: {
        status: ChargingSessionStatus.COMPLETED,
        meterStop: input.meterStop,
        energyWh,
        terminationReason: input.reason,
        endedAt: input.endedAt ?? new Date(),
      },
    });
  }

  /** Any non-terminal status -> FAILED. Accepts an optional interactive-
   * transaction client (WO-ARGOS-063: createSession's CASE C supersession
   * calls this from inside its own SERIALIZABLE transaction) — defaults to
   * the regular PrismaService for every other caller, unchanged. */
  async failSession(
    id: string,
    reason: ChargingSessionTerminationReason,
    client: Db = this.prisma,
  ): Promise<ChargingSession> {
    const session = await this.requireSession(id, client);
    this.assertTransitionAllowed(session.status, ChargingSessionStatus.FAILED);
    return client.chargingSession.update({
      where: { id },
      data: {
        status: ChargingSessionStatus.FAILED,
        terminationReason: reason,
        endedAt: new Date(),
      },
    });
  }

  /** Any non-terminal status -> CANCELLED. Defaults to USER_CANCELLED
   * (the common case a bare "cancel" call represents) but accepts any
   * termination reason for callers that know a more specific one. */
  async cancelSession(
    id: string,
    reason: ChargingSessionTerminationReason = 'USER_CANCELLED',
  ): Promise<ChargingSession> {
    return this.transitionToTerminal(
      id,
      ChargingSessionStatus.CANCELLED,
      reason,
    );
  }

  /** Appends to ChargingSession.energyWh from a MeterValue reading —
   * called by TransactionUpdateHandler, never invents a status transition
   * itself. energyWh only ever moves forward (monotonic — see
   * MeterValuesService for where non-monotonic samples are rejected before
   * ever reaching this method). */
  async updateEnergy(id: string, energyWh: number): Promise<ChargingSession> {
    const session = await this.requireSession(id);
    if (TERMINAL_STATUSES.has(session.status)) {
      throw new InvalidSessionTransitionError(session.status, session.status);
    }
    return this.prisma.chargingSession.update({
      where: { id },
      data: { energyWh },
    });
  }

  private async transition(
    id: string,
    targetStatus: ChargingSessionStatus,
  ): Promise<ChargingSession> {
    const session = await this.requireSession(id);
    this.assertTransitionAllowed(session.status, targetStatus);
    return this.prisma.chargingSession.update({
      where: { id },
      data: { status: targetStatus },
    });
  }

  private async transitionToTerminal(
    id: string,
    targetStatus: ChargingSessionStatus,
    reason: ChargingSessionTerminationReason,
  ): Promise<ChargingSession> {
    const session = await this.requireSession(id);
    this.assertTransitionAllowed(session.status, targetStatus);
    return this.prisma.chargingSession.update({
      where: { id },
      data: {
        status: targetStatus,
        terminationReason: reason,
        endedAt: new Date(),
      },
    });
  }

  private assertTransitionAllowed(
    from: ChargingSessionStatus,
    to: ChargingSessionStatus,
  ): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new InvalidSessionTransitionError(from, to);
    }
  }

  private async requireSession(
    id: string,
    client: Db = this.prisma,
  ): Promise<ChargingSession> {
    const session = await client.chargingSession.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException(`ChargingSession ${id} not found`);
    }
    return session;
  }
}
