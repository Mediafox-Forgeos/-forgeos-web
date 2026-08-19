import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ChargingSession } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import {
  OFFLINE_RECOVERY_WINDOW_MS,
  SessionLifecycleService,
} from '../../sessions/session-lifecycle.service';
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
 * into or out of OFFLINE. As of WO-ARGOS-061, clean and stale disconnects
 * both reconcile ACTIVE/SUSPENDED sessions to OFFLINE identically (see
 * `reconcileSessionsOffline`) — see
 * docs/domain/CAP-005_CONNECTIVITY_ENGINE.md §4 for the resolved history.
 */
@Injectable()
export class ConnectivityCoordinator implements OnModuleInit {
  private readonly logger = new Logger(ConnectivityCoordinator.name);

  /** 3x the current global heartbeat interval (BootNotification.conf's
   * hardcoded 300s), per DEC-017's approved policy. Not yet per-station —
   * see docs/domain/CAP-005_CONNECTIVITY_ENGINE.md's known limitations.
   * WO-ARGOS-063: the value now lives at
   * SessionLifecycleService.OFFLINE_RECOVERY_WINDOW_MS as the single shared
   * definition (also used by createSession's collision guard) — re-exported
   * here unchanged so this class's existing public reference keeps working. */
  static readonly RECOVERY_WINDOW_MS = OFFLINE_RECOVERY_WINDOW_MS;

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
   * (unregister) and a stale-sweep eviction. WO-ARGOS-061: both reasons now
   * reconcile session state identically — a station disconnect, however
   * it's detected, is an equally verified connectivity-loss event per
   * DEC-017 item 1 (ConnectionRegistryService is the single source of
   * connection-loss events). Fixes the WO-ARGOS-060-confirmed stranding
   * bug: a clean disconnect previously left an ACTIVE/SUSPENDED session
   * stuck forever, invisible to reconnect recovery. Still never completes
   * or fails a session (DEC-017 item 5) — only ever moves it to OFFLINE. */
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

    await this.reconcileSessionsOffline(input.chargingStationId, input.reason);
  }

  /**
   * The shared connectivity-loss reconciliation path (WO-ARGOS-061) —
   * station-scoped by design (§4 of the WO): every logically-active session
   * across every connector/EVSE on the station is moved to OFFLINE, not
   * just one. Reuses SessionLifecycleService.suspendSession exactly as the
   * pre-existing stale path already did; no parallel lifecycle mechanism.
   * Naturally idempotent — a session already reconciled to OFFLINE by a
   * prior call no longer matches the ACTIVE/SUSPENDED filter, so a
   * duplicate or overlapping disconnect signal for the same station is a
   * safe no-op here, never a re-transition or a thrown error.
   */
  private async reconcileSessionsOffline(
    chargingStationId: string,
    reason: 'clean' | 'stale',
  ): Promise<void> {
    const affected = await this.prisma.chargingSession.findMany({
      where: {
        chargingStationId,
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
          chargingStationId,
          protocolTransactionId: session.protocolTransactionId,
          reason: reason === 'stale' ? 'stale-connection' : 'clean-disconnect',
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

    // WO-ARGOS-063: delegates to SessionLifecycleService's shared
    // definition rather than computing this inline — the same rule
    // createSession's collision guard uses, so the two paths can never
    // diverge.
    const withinWindow =
      this.sessionLifecycle.isOfflineSessionRecoverable(session);

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
