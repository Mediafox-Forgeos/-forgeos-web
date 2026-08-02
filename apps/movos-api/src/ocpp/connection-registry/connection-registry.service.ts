import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type WebSocket from 'ws';

import type { OcppProtocolVersion } from '../protocol/common/normalized-events';
import { ConnectivityCoordinator } from '../connectivity/connectivity-coordinator.service';
import { ConcurrencyLimiter } from '../../common/concurrency-limiter';

export interface ConnectionRecord {
  ocppIdentity: string;
  chargingStationId: string;
  protocolVersion: OcppProtocolVersion;
  socket: WebSocket;
  connectedAt: Date;
  lastMessageAt: Date;
}

export interface ConnectionSummary {
  ocppIdentity: string;
  chargingStationId: string;
  protocolVersion: OcppProtocolVersion;
  connectedAt: Date;
  lastMessageAt: Date;
}

const STALE_THRESHOLD_MS = 5 * 60_000; // 5 minutes without any message
const SWEEP_INTERVAL_MS = 60_000;

/** CAP-006A (WO-ARGOS-012) Objective 3 — closes RA-003: how many
 * connectivity notifications (connect or close, so this single limiter
 * covers both a mass-disconnect from sweepStale() AND a reconnect storm
 * once a shared outage resolves) may be in flight against the database at
 * once. Deliberately conservative and not (yet) configurable — see
 * CAP-006A_INVARIANTS.md for the reasoning and CAP-006A_FAILURE_MATRIX.md
 * for the mass-disconnect/regional-outage scenarios this bounds. */
const NOTIFY_CONCURRENCY_LIMIT = 25;

/**
 * In-memory connection registry — deliberately not Redis-backed (CAP-003
 * Architecture Decisions Decision 6: single-instance MVP constraint). This
 * class is the one component a future distributed-routing decision would
 * replace; nothing in the protocol or domain layers is aware this is
 * in-memory, satisfying ADR-0009's "future scaling must not require
 * redesigning the protocol adapter or domain layer" requirement.
 *
 * One active connection per ocppIdentity: a new connection for an identity
 * that's already connected deterministically closes the previous socket
 * before registering the new one — never two live sockets for the same
 * station. A connection's presence here means "a WebSocket is open," not
 * "the station is operationally available" — see the OCPP Engine Guide.
 *
 * CAP-005 (WO-ARGOS-010) — this class is also the sole source of
 * connectivity events (DEC-017's approved design): register(), unregister(),
 * and the stale sweep each notify ConnectivityCoordinator, which owns what
 * happens next (persisted ChargingStation connectivity fields, session
 * OFFLINE transitions, audit events). Notifications are fire-and-forget
 * from this class's point of view — a connectivity-side failure must never
 * block or break the transport-layer connection handling above it.
 */
@Injectable()
export class ConnectionRegistryService implements OnModuleDestroy {
  private readonly logger = new Logger(ConnectionRegistryService.name);
  private readonly connections = new Map<string, ConnectionRecord>();
  private readonly sweepTimer: NodeJS.Timeout;
  private readonly notifyLimiter = new ConcurrencyLimiter(
    NOTIFY_CONCURRENCY_LIMIT,
  );

  constructor(private readonly connectivity: ConnectivityCoordinator) {
    this.sweepTimer = setInterval(() => this.sweepStale(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  /** Registers a newly-authenticated connection. If one already exists for
   * this identity, it is closed first — deterministic reconnection, never
   * two live sockets for the same station. */
  register(
    record: Omit<ConnectionRecord, 'connectedAt' | 'lastMessageAt'>,
  ): void {
    const existing = this.connections.get(record.ocppIdentity);
    if (existing && existing.socket !== record.socket) {
      this.logger.log(
        `Replacing existing connection for ${record.ocppIdentity} (new connection arrived)`,
      );
      existing.socket.close(1000, 'replaced-by-new-connection');
    }

    const now = new Date();
    this.connections.set(record.ocppIdentity, {
      ...record,
      connectedAt: now,
      lastMessageAt: now,
    });

    this.notifyConnected(
      record.chargingStationId,
      record.ocppIdentity,
      record.protocolVersion,
    );
  }

  /** Called on every inbound message to keep liveness accurate. */
  touch(ocppIdentity: string): void {
    const record = this.connections.get(ocppIdentity);
    if (record) record.lastMessageAt = new Date();
  }

  /** Graceful disconnect — only removes the record if the closing socket
   * is still the one on file (a stale close event from an already-replaced
   * connection must not evict the newer, live one). */
  unregister(ocppIdentity: string, socket: WebSocket): void {
    const record = this.connections.get(ocppIdentity);
    if (record && record.socket === socket) {
      this.connections.delete(ocppIdentity);
      this.notifyClosed(record.chargingStationId, ocppIdentity, 'clean');
    }
  }

  /** Administrative force-disconnect (e.g. on credential revocation). */
  forceDisconnect(ocppIdentity: string, reason: string): void {
    const record = this.connections.get(ocppIdentity);
    if (record) {
      record.socket.close(1000, reason);
      this.connections.delete(ocppIdentity);
    }
  }

  get(ocppIdentity: string): ConnectionRecord | undefined {
    return this.connections.get(ocppIdentity);
  }

  isConnected(ocppIdentity: string): boolean {
    return this.connections.has(ocppIdentity);
  }

  /** For diagnostics — never exposes the raw socket. */
  listConnected(): ConnectionSummary[] {
    return Array.from(this.connections.values()).map(
      ({ socket: _socket, ...summary }) => summary,
    );
  }

  private sweepStale(): void {
    const now = Date.now();
    for (const [ocppIdentity, record] of this.connections) {
      if (now - record.lastMessageAt.getTime() > STALE_THRESHOLD_MS) {
        this.logger.warn(
          `Closing stale connection for ${ocppIdentity} (no message received)`,
        );
        record.socket.close(1001, 'stale-connection');
        this.connections.delete(ocppIdentity);
        this.notifyClosed(record.chargingStationId, ocppIdentity, 'stale');
      }
    }
  }

  /** Fire-and-forget from this class's own point of view (a connectivity-
   * side failure must never propagate back into transport-layer
   * connection handling — logged, never thrown), but every call — whether
   * it arrives one at a time from individual register() calls or in a
   * tight burst from sweepStale()'s single-tick loop — is routed through
   * the shared `notifyLimiter` (CAP-006A, WO-ARGOS-012 Objective 3): at
   * most NOTIFY_CONCURRENCY_LIMIT of these are ever in flight against the
   * database at once, with the rest queued (FIFO), not fired unbounded.
   * This is what bounds both a mass-disconnect (many sweepStale evictions
   * in one tick) and a reconnect storm (many independent register() calls
   * once a shared outage resolves) to the same, predictable worst case. */
  private notifyConnected(
    chargingStationId: string,
    ocppIdentity: string,
    protocolVersion: OcppProtocolVersion,
  ): void {
    void this.notifyLimiter
      .run(() =>
        this.connectivity.handleConnectionEstablished({
          chargingStationId,
          ocppIdentity,
          protocolVersion,
        }),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `ConnectivityCoordinator.handleConnectionEstablished failed for ${ocppIdentity}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
  }

  private notifyClosed(
    chargingStationId: string,
    ocppIdentity: string,
    reason: 'clean' | 'stale',
  ): Promise<void> {
    return this.notifyLimiter
      .run(() =>
        this.connectivity.handleConnectionClosed({
          chargingStationId,
          ocppIdentity,
          reason,
        }),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `ConnectivityCoordinator.handleConnectionClosed failed for ${ocppIdentity}`,
          error instanceof Error ? error.stack : undefined,
        );
      });
  }
}
