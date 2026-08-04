import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ChargingSessionStatus,
  Prisma,
  type ChargingSession,
  type ChargingSessionTerminationReason,
  type OcppProtocolVersion,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { TransactionIdGeneratorService } from './transaction-id-generator.service';
import { InvalidSessionTransitionError } from './session-lifecycle.errors';

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
   * connector-already-occupied conflict both need.
   */
  async createSession(input: CreateSessionInput): Promise<ChargingSession> {
    const existing = await this.prisma.chargingSession.findFirst({
      where: {
        connectorId: input.connectorId,
        status: { in: NON_TERMINAL_STATUSES },
      },
    });
    if (existing) {
      this.logger.log(
        `createSession: connector ${input.connectorId} already has a non-terminal session (${existing.id}) — returning it, not creating a duplicate`,
      );
      return existing;
    }

    // CAP-009 (WO-ARGOS-017A): every ChargingSession now requires a
    // BillingAccount (Objective 1, Option A). This handler has no concept
    // of billing/debt ownership — it only knows which organization the
    // session belongs to — so it resolves (or, on an organization's very
    // first session, creates) that organization's SYSTEM_DEFAULT
    // placeholder account. A real BillingAccount can be assigned later by
    // a future capability; nothing here forecloses that.
    const billingAccountId = await this.resolveSystemDefaultBillingAccountId(
      input.organizationId,
    );

    // The PENDING -> AUTHORIZED -> STARTING -> ACTIVE walk (§8) collapses
    // into a single insert here: 1.6J's StartTransaction already implies a
    // validated, physically-connecting device, and no other process ever
    // observes this row between PENDING and ACTIVE within one handler
    // invocation. See ALLOWED_TRANSITIONS above for proof each hop in that
    // walk is independently valid — verified directly in this service's
    // spec, not just asserted here.
    return this.prisma.chargingSession.create({
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
  ): Promise<string> {
    const existing = await this.prisma.billingAccount.findFirst({
      where: { organizationId, type: 'SYSTEM_DEFAULT' },
    });
    if (existing) {
      return existing.id;
    }

    try {
      const created = await this.prisma.billingAccount.create({
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
        const winner = await this.prisma.billingAccount.findFirst({
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

  /** Any non-terminal status -> FAILED. */
  async failSession(
    id: string,
    reason: ChargingSessionTerminationReason,
  ): Promise<ChargingSession> {
    const session = await this.requireSession(id);
    this.assertTransitionAllowed(session.status, ChargingSessionStatus.FAILED);
    return this.prisma.chargingSession.update({
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

  private async requireSession(id: string): Promise<ChargingSession> {
    const session = await this.prisma.chargingSession.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException(`ChargingSession ${id} not found`);
    }
    return session;
  }
}
