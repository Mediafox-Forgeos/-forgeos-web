import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ChargingSession } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SessionLifecycleService } from '../../sessions/session-lifecycle.service';
import type { OcppProtocolVersion } from '../protocol/common/normalized-events';

export interface ConnectionEstablishedInput {
  chargingStationId: string;
  ocppIdentity: string;
  protocolVersion: OcppProtocolVersion;
}

export interface ConnectionClosedInput {
  chargingStationId: string;
  ocppIdentity: string;
  reason: 'clean' | 'stale';
}

/**
 * The seam between the transport layer (ConnectionRegistryService, CAP-003)
 * and the domain layer (SessionLifecycleService, CAP-004) — DEC-017's
 * approved design. ConnectionRegistryService is the sole source of these
 * calls; nothing else in the codebase should call this class from a
 * connectivity-detection path of its own. See
 * docs/domain/CAP-005_CONNECTIVITY_ENGINE.md and
 * docs/domain/DEC-017_OFFLINE_POLICY.md's Approval Record.
 *
 * A disconnect alone (clean or stale) never completes or fails a
 * ChargingSession — only an explicit protocol event (StopTransaction) or
 * administrative action does that. This class only ever moves a session
 * into or out of OFFLINE.
 */
@Injectable()
export class ConnectivityCoordinator implements OnModuleInit {
  private readonly logger = new Logger(ConnectivityCoordinator.name);

  /** 3x the current global heartbeat interval (BootNotification.conf's
   * hardcoded 300s), per DEC-017's approved policy. Not yet per-station —
   * see docs/domain/CAP-005_CONNECTIVITY_ENGINE.md's known limitations. */
  static readonly RECOVERY_WINDOW_MS = 3 * 300_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessionLifecycle: SessionLifecycleService,
  ) {}

  /**
   * Startup reconciliation (Phase 6's exact rule): `ConnectionRegistryService`
   * always boots with an empty, in-memory map — no station can have fresh
   * connection evidence at the instant this runs, by construction. Any
   * station whose persisted `connectivityStatus` still says `ONLINE` is
   * therefore stale by definition (it reflects a belief from before this
   * process started, not a live fact) and is forced to `UNKNOWN` — never
   * left as a false `ONLINE`, and never guessed to `OFFLINE` either, since
   * "we don't know yet" is the honest state until the device actually
   * reconnects (which will correctly set it back to `ONLINE` via
   * `handleConnectionEstablished`). `OFFLINE` stations are left as `OFFLINE`
   * — that belief doesn't become less true just because the process
   * restarted.
   */
  async onModuleInit(): Promise<void> {
    const { count } = await this.prisma.chargingStation.updateMany({
      where: { connectivityStatus: 'ONLINE' },
      data: { connectivityStatus: 'UNKNOWN' },
    });
    if (count > 0) {
      this.logger.log(
        `Startup reconciliation: ${count} station(s) reset from ONLINE to UNKNOWN (no live connection evidence at boot)`,
      );
    }
  }

  /** Called by ConnectionRegistryService.register() — a real WebSocket
   * connection was just authenticated and accepted. Never creates a
   * ChargingSession, whether this is a first connection (CONNECTED) or a
   * reconnect (RECONNECTED). */
  async handleConnectionEstablished(
    input: ConnectionEstablishedInput,
  ): Promise<void> {
    const offlineSession = await this.prisma.chargingSession.findFirst({
      where: { chargingStationId: input.chargingStationId, status: 'OFFLINE' },
    });
    const eventType = offlineSession ? 'RECONNECTED' : 'CONNECTED';

    const now = new Date();
    await this.prisma.chargingStation.update({
      where: { id: input.chargingStationId },
      data: {
        connectivityStatus: 'ONLINE',
        lastConnectedAt: now,
        lastSeenAt: now,
        lastProtocolVersion: input.protocolVersion,
      },
    });

    await this.audit.record({
      action:
        eventType === 'RECONNECTED'
          ? 'STATION_CONNECTIVITY_RECONNECTED'
          : 'STATION_CONNECTIVITY_CONNECTED',
      subjectType: 'ChargingStation',
      subjectId: input.chargingStationId,
      metadata: {
        ocppIdentity: input.ocppIdentity,
        protocolVersion: input.protocolVersion,
      },
    });

    if (offlineSession) {
      await this.attemptRecovery(offlineSession, input.chargingStationId);
    }
  }

  /** Called by ConnectionRegistryService for both a clean close
   * (unregister) and a stale-sweep eviction. Only `reason: 'stale'`
   * touches ChargingSession — a clean disconnect updates station
   * connectivity only, per DEC-017 item 5 ("a disconnect alone must never
   * complete or fail a session") and the Phase 5 spec's explicit
   * distinction between DISCONNECTED (no session change) and STALE
   * (ACTIVE/SUSPENDED -> OFFLINE). */
  async handleConnectionClosed(input: ConnectionClosedInput): Promise<void> {
    await this.prisma.chargingStation.update({
      where: { id: input.chargingStationId },
      data: {
        connectivityStatus: 'OFFLINE',
        lastDisconnectedAt: new Date(),
      },
    });

    await this.audit.record({
      action:
        input.reason === 'stale'
          ? 'STATION_CONNECTIVITY_STALE'
          : 'STATION_CONNECTIVITY_DISCONNECTED',
      subjectType: 'ChargingStation',
      subjectId: input.chargingStationId,
      metadata: { ocppIdentity: input.ocppIdentity },
    });

    if (input.reason !== 'stale') return;

    const affected = await this.prisma.chargingSession.findMany({
      where: {
        chargingStationId: input.chargingStationId,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
      },
    });

    for (const session of affected) {
      await this.sessionLifecycle.suspendSession(session.id, 'OFFLINE');
      await this.audit.record({
        action: 'SESSION_MOVED_OFFLINE',
        subjectType: 'ChargingSession',
        subjectId: session.id,
        metadata: {
          chargingStationId: input.chargingStationId,
          protocolTransactionId: session.protocolTransactionId,
          reason: 'stale-connection',
        },
      });
    }
  }

  /**
   * The recovery policy (DEC-017 item 4 / Phase 7): an OFFLINE session may
   * return to ACTIVE only when the reconnecting station is the same one
   * that went offline (trivially true here — we only look up OFFLINE
   * sessions scoped to `chargingStationId`), the transaction is still
   * non-terminal (true by definition of being OFFLINE, not COMPLETED/
   * FAILED/CANCELLED), no conflicting active session exists on the same
   * connector, and the reconnect lands within the recovery window
   * (measured from the session's own last update — the moment it was
   * moved to OFFLINE). If evidence is insufficient, the session stays
   * OFFLINE and a diagnostic audit event is recorded — never a guess.
   */
  private async attemptRecovery(
    session: ChargingSession,
    chargingStationId: string,
  ): Promise<void> {
    const conflicting = await this.prisma.chargingSession.findFirst({
      where: {
        connectorId: session.connectorId,
        status: {
          in: [
            'PENDING',
            'AUTHORIZED',
            'STARTING',
            'ACTIVE',
            'SUSPENDED',
            'STOPPING',
          ],
        },
        id: { not: session.id },
      },
    });

    const withinWindow =
      Date.now() - session.updatedAt.getTime() <=
      ConnectivityCoordinator.RECOVERY_WINDOW_MS;

    if (conflicting || !withinWindow) {
      this.logger.warn(
        `Recovery rejected for session ${session.id} on station ${chargingStationId}: ${conflicting ? 'conflicting session on connector' : 'outside recovery window'}`,
      );
      await this.audit.record({
        action: 'SESSION_RECOVERY_REJECTED',
        subjectType: 'ChargingSession',
        subjectId: session.id,
        metadata: {
          chargingStationId,
          protocolTransactionId: session.protocolTransactionId,
          reason: conflicting
            ? 'conflicting-session-on-connector'
            : 'outside-recovery-window',
        },
      });
      return;
    }

    await this.sessionLifecycle.resumeSession(session.id);
    await this.audit.record({
      action: 'SESSION_RECOVERED',
      subjectType: 'ChargingSession',
      subjectId: session.id,
      metadata: {
        chargingStationId,
        protocolTransactionId: session.protocolTransactionId,
      },
    });
  }
}
