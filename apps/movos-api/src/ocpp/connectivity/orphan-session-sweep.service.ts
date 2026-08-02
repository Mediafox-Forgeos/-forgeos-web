import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import { ConnectivityCoordinator } from './connectivity-coordinator.service';

const SWEEP_INTERVAL_MS = 60_000;

interface OrphanCandidateRow {
  id: string;
  chargingStationId: string;
  protocolTransactionId: string;
}

/**
 * CAP-006A (WO-ARGOS-012) Objective 2 / Invariant 4 — closes RA-002: "an
 * ACTIVE session may never survive indefinitely." CAP-005 already handles
 * the *stale* disconnect path (ConnectivityCoordinator moves ACTIVE/
 * SUSPENDED -> OFFLINE, and a reconnect within the recovery window
 * recovers it) — but a *clean* disconnect that never reconnects leaves a
 * session with no automatic path forward at all (see
 * CAP-005_CONNECTIVITY_ENGINE.md §4's documented, deliberate asymmetry).
 * This service is the backstop that closes that gap without inventing a
 * second connectivity-detection timer competing with
 * ConnectionRegistryService's own sweep (the same constraint DEC-017
 * imposed on CAP-005 itself) — it never touches connection state, never
 * decides ONLINE/OFFLINE, and reads only already-persisted evidence.
 *
 * A session is orphaned when: its status is still non-terminal (ACTIVE,
 * SUSPENDED, or OFFLINE), its station's connectivityStatus is not ONLINE,
 * and the station has lacked connectivity evidence for longer than the
 * same recovery window CAP-005 already uses (`ConnectivityCoordinator.
 * RECOVERY_WINDOW_MS`) — deliberately reusing that constant rather than
 * introducing a second, independently-tunable threshold: if a session is
 * still eligible for reconnect-recovery, it must not also be eligible for
 * orphan expiry at the same time.
 *
 * "Lacked connectivity evidence since" is COALESCE(lastDisconnectedAt,
 * lastConnectedAt, session.startedAt) — in that order: lastDisconnectedAt
 * is set on every close (clean or stale), covering the common case;
 * lastConnectedAt is the fallback for a station whose ONLINE belief was
 * only ever corrected by startup reconciliation (never actually recorded
 * a disconnect event) — see CAP-005 §5; the session's own startedAt is
 * the final, maximally defensive fallback so a NULL never excludes a row
 * outright.
 *
 * Expiry outcome: FAILED with terminationReason NETWORK_FAILURE — reusing
 * SessionLifecycleService's existing terminal machinery rather than
 * inventing a new ChargingSessionStatus value (e.g. a dedicated EXPIRED
 * state). ACTIVE/SUSPENDED/OFFLINE -> FAILED is already a valid,
 * already-tested transition; NETWORK_FAILURE is already a real
 * ChargingSessionTerminationReason value with exactly this meaning. See
 * CAP-006A_INVARIANTS.md for the full justification against the
 * alternative (STALE -> OFFLINE -> EXPIRED) the work order offered.
 */
@Injectable()
export class OrphanSessionSweepService implements OnModuleDestroy {
  private readonly logger = new Logger(OrphanSessionSweepService.name);
  private readonly sweepTimer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessionLifecycle: SessionLifecycleService,
  ) {
    this.sweepTimer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  async sweep(): Promise<void> {
    const threshold = new Date(
      Date.now() - ConnectivityCoordinator.RECOVERY_WINDOW_MS,
    );

    let candidates: OrphanCandidateRow[];
    try {
      candidates = await this.prisma.$queryRaw<OrphanCandidateRow[]>`
        SELECT cs.id, cs."chargingStationId", cs."protocolTransactionId"
        FROM "ChargingSession" cs
        JOIN "ChargingStation" st ON st.id = cs."chargingStationId"
        WHERE cs.status IN ('ACTIVE', 'SUSPENDED', 'OFFLINE')
        AND st."connectivityStatus" != 'ONLINE'
        AND COALESCE(st."lastDisconnectedAt", st."lastConnectedAt", cs."startedAt") < ${threshold}
      `;
    } catch (error) {
      // Same fire-and-forget-safe posture as ConnectivityCoordinator: a
      // transient DB error on this backstop must not crash the process or
      // block the next tick — it will simply retry in SWEEP_INTERVAL_MS.
      this.logger.error(
        'Orphan session sweep query failed',
        error instanceof Error ? error.stack : undefined,
      );
      return;
    }

    for (const candidate of candidates) {
      await this.expireOrphan(candidate);
    }
  }

  private async expireOrphan(candidate: OrphanCandidateRow): Promise<void> {
    try {
      await this.sessionLifecycle.failSession(candidate.id, 'NETWORK_FAILURE');
    } catch (error) {
      // The session may have been resolved (recovered, stopped, or
      // already failed) between the raw SELECT above and this call —
      // failSession's own transition-table check rejects that cleanly
      // rather than corrupting state; nothing further to do here.
      this.logger.log(
        `Orphan expiry skipped for session ${candidate.id}: already resolved (${error instanceof Error ? error.message : String(error)})`,
      );
      return;
    }

    this.logger.warn(
      `Session ${candidate.id} on station ${candidate.chargingStationId} expired as an orphan — no connectivity evidence for longer than the recovery window`,
    );
    await this.audit.record({
      action: 'SESSION_ORPHAN_EXPIRED',
      subjectType: 'ChargingSession',
      subjectId: candidate.id,
      metadata: {
        chargingStationId: candidate.chargingStationId,
        protocolTransactionId: candidate.protocolTransactionId,
        reason: 'no-connectivity-evidence-past-recovery-window',
      },
    });
  }
}
