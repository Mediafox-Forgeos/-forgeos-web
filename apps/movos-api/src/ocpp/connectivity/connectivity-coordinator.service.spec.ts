import { ConnectivityCoordinator } from './connectivity-coordinator.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import {
  OFFLINE_RECOVERY_WINDOW_MS,
  type SessionLifecycleService,
} from '../../sessions/session-lifecycle.service';

type PrismaMock = {
  chargingStation: {
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  chargingSession: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
};

function createPrismaMock(): PrismaMock {
  return {
    chargingStation: {
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    chargingSession: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function createAuditMock(): jest.Mocked<Pick<AuditService, 'record'>> {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function createSessionLifecycleMock(): jest.Mocked<
  Pick<
    SessionLifecycleService,
    'suspendSession' | 'resumeSession' | 'isOfflineSessionRecoverable'
  >
> {
  return {
    suspendSession: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve({ id, status: 'OFFLINE' }),
      ),
    resumeSession: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve({ id, status: 'ACTIVE' }),
      ),
    // WO-ARGOS-063: the real implementation this mock mirrors now lives on
    // SessionLifecycleService — attemptRecovery delegates to it rather than
    // computing the window inline, so the mock must too, to keep this
    // spec's "outside the recovery window" scenario meaningful.
    isOfflineSessionRecoverable: jest
      .fn()
      .mockImplementation((session: { status: string; updatedAt: Date }) => {
        if (session.status !== 'OFFLINE') return false;
        return (
          Date.now() - session.updatedAt.getTime() <= OFFLINE_RECOVERY_WINDOW_MS
        );
      }),
  };
}

function offlineSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    chargingStationId: 'cs1',
    connectorId: 'connector-1',
    protocolTransactionId: '100',
    status: 'OFFLINE',
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ConnectivityCoordinator', () => {
  let coordinator: ConnectivityCoordinator;
  let prisma: PrismaMock;
  let audit: ReturnType<typeof createAuditMock>;
  let sessionLifecycle: ReturnType<typeof createSessionLifecycleMock>;

  beforeEach(() => {
    prisma = createPrismaMock();
    audit = createAuditMock();
    sessionLifecycle = createSessionLifecycleMock();
    coordinator = new ConnectivityCoordinator(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      sessionLifecycle as unknown as SessionLifecycleService,
    );
  });

  describe('onModuleInit (startup reconciliation)', () => {
    // Scenario 4: a restart must never leave a station falsely ONLINE —
    // the in-memory registry always boots empty, so any persisted ONLINE
    // belief predates this process and cannot be live fact.
    it('resets every persisted ONLINE station to UNKNOWN', async () => {
      prisma.chargingStation.updateMany.mockResolvedValue({ count: 3 });

      await coordinator.onModuleInit();

      expect(prisma.chargingStation.updateMany).toHaveBeenCalledWith({
        where: { connectivityStatus: 'ONLINE' },
        data: { connectivityStatus: 'UNKNOWN' },
      });
    });
  });

  describe('handleConnectionEstablished', () => {
    // Scenario 1: a valid connection with no prior OFFLINE session is a
    // plain CONNECTED — station goes ONLINE, no session is touched.
    it('marks the station ONLINE and records CONNECTED when no OFFLINE session exists', async () => {
      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(prisma.chargingStation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cs1' },
          data: expect.objectContaining({
            connectivityStatus: 'ONLINE',
            lastProtocolVersion: 'OCPP1_6J',
          }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STATION_CONNECTIVITY_CONNECTED' }),
      );
      expect(sessionLifecycle.resumeSession).not.toHaveBeenCalled();
    });

    // Scenario 8: an OFFLINE session on the reconnecting station, within
    // the recovery window and with no conflicting connector session, is
    // restored to ACTIVE — reported as RECONNECTED, not CONNECTED.
    it('restores an OFFLINE session and records RECONNECTED when recovery succeeds', async () => {
      const session = offlineSession();
      prisma.chargingSession.findFirst
        .mockResolvedValueOnce(session) // the OFFLINE-session lookup
        .mockResolvedValueOnce(null); // no conflicting session on the connector

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATION_CONNECTIVITY_RECONNECTED',
        }),
      );
      expect(sessionLifecycle.resumeSession).toHaveBeenCalledWith(session.id);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SESSION_RECOVERED' }),
      );
      // Scenario 12: recovery only ever resumes the existing row — it never
      // creates a new ChargingSession.
      expect(prisma.chargingSession.findMany).not.toHaveBeenCalled();
    });

    // Scenario 9: a conflicting non-terminal session already occupying the
    // same connector (e.g. a fresh session started under a different
    // transaction while this one was OFFLINE) blocks recovery — the old
    // session stays OFFLINE, not silently resumed alongside it.
    it('rejects recovery when a conflicting session exists on the same connector', async () => {
      const session = offlineSession();
      const conflicting = { id: 'session-2' };
      prisma.chargingSession.findFirst
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(conflicting);

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(sessionLifecycle.resumeSession).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_RECOVERY_REJECTED',
          metadata: expect.objectContaining({
            reason: 'conflicting-session-on-connector',
          }),
        }),
      );
    });

    it('rejects recovery when the OFFLINE session is outside the recovery window', async () => {
      const session = offlineSession({
        updatedAt: new Date(
          Date.now() - ConnectivityCoordinator.RECOVERY_WINDOW_MS - 60_000,
        ),
      });
      prisma.chargingSession.findFirst
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(null);

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(sessionLifecycle.resumeSession).not.toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_RECOVERY_REJECTED',
          metadata: expect.objectContaining({
            reason: 'outside-recovery-window',
          }),
        }),
      );
    });

    // WO-ARGOS-061 test H: reconnect after a clean-disconnect-created
    // OFFLINE session — attemptRecovery's own lookup is keyed purely on
    // `status: 'OFFLINE'`, with no dependency on which reason produced it,
    // so a session reconciled via 'clean' is discovered and recovered
    // exactly like one reconciled via 'stale'. This is the concrete
    // evidence that the WO-061 fix closes WO-060's §5 "invisible to
    // reconnect" gap as a side effect.
    it('[H] discovers and recovers a session that was moved OFFLINE by a clean disconnect', async () => {
      const session = offlineSession();
      prisma.chargingSession.findFirst
        .mockResolvedValueOnce(session)
        .mockResolvedValueOnce(null);

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATION_CONNECTIVITY_RECONNECTED',
        }),
      );
      expect(sessionLifecycle.resumeSession).toHaveBeenCalledWith(session.id);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SESSION_RECOVERED' }),
      );
    });

    // Scenario 13: the station update is always scoped to the exact
    // chargingStationId the connection reported — never a broader/cross-
    // tenant write. (Org scoping itself happens upstream in provisioning;
    // this asserts the coordinator never widens the write.)
    it('scopes the station update to exactly the reporting station', async () => {
      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs-tenant-a',
        ocppIdentity: 'movos-a',
        protocolVersion: 'OCPP1_6J',
      });

      expect(prisma.chargingStation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cs-tenant-a' } }),
      );
    });
  });

  describe('handleConnectionClosed', () => {
    // WO-ARGOS-061 test A: ACTIVE + clean disconnect -> station OFFLINE,
    // session OFFLINE. This is the core stranding-bug fix confirmed by
    // WO-ARGOS-060 — a clean disconnect must reconcile sessions exactly
    // like a stale one, not skip reconciliation.
    it('[A] moves an ACTIVE session to OFFLINE on a clean close', async () => {
      const active = {
        id: 'session-1',
        status: 'ACTIVE',
        protocolTransactionId: '100',
      };
      prisma.chargingSession.findMany.mockResolvedValue([active]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(prisma.chargingStation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cs1' },
          data: expect.objectContaining({ connectivityStatus: 'OFFLINE' }),
        }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'STATION_CONNECTIVITY_DISCONNECTED',
        }),
      );
      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-1',
        'OFFLINE',
      );
      // Audit metadata distinguishes detection mechanism per WO-061 item 10
      // — no new AuditEvent model, just a metadata field.
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_MOVED_OFFLINE',
          metadata: expect.objectContaining({ reason: 'clean-disconnect' }),
        }),
      );
    });

    // WO-ARGOS-061 test B: SUSPENDED + clean disconnect -> session OFFLINE.
    it('[B] moves a SUSPENDED session to OFFLINE on a clean close', async () => {
      const suspended = {
        id: 'session-2',
        status: 'SUSPENDED',
        protocolTransactionId: '101',
      };
      prisma.chargingSession.findMany.mockResolvedValue([suspended]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-2',
        'OFFLINE',
      );
    });

    // WO-ARGOS-061 test C: no session + clean disconnect -> safe no-op for
    // session reconciliation, station still flips OFFLINE.
    it('[C] is a safe no-op for session reconciliation when no session exists on a clean close', async () => {
      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(prisma.chargingStation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ connectivityStatus: 'OFFLINE' }),
        }),
      );
      expect(prisma.chargingSession.findMany).toHaveBeenCalledWith({
        where: {
          chargingStationId: 'cs1',
          status: { in: ['ACTIVE', 'SUSPENDED'] },
        },
      });
      expect(sessionLifecycle.suspendSession).not.toHaveBeenCalled();
    });

    // WO-ARGOS-061 test D: ACTIVE + stale disconnect -> existing behavior
    // unchanged (regression guard for the pre-061 stale path).
    it('[D] moves an ACTIVE session to OFFLINE on a stale close, unchanged from before', async () => {
      const active = {
        id: 'session-1',
        status: 'ACTIVE',
        protocolTransactionId: '100',
      };
      prisma.chargingSession.findMany.mockResolvedValue([active]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'stale',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'STATION_CONNECTIVITY_STALE' }),
      );
      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-1',
        'OFFLINE',
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_MOVED_OFFLINE',
          metadata: expect.objectContaining({ reason: 'stale-connection' }),
        }),
      );
    });

    // WO-ARGOS-061 test E: duplicate clean disconnect -> second
    // reconciliation call is a safe no-op, no duplicate lifecycle mutation.
    // Mirrors the real query behavior: the first call's findMany result no
    // longer includes a session it already moved to OFFLINE.
    it('[E] a duplicate clean disconnect signal for the same station does not re-mutate an already-reconciled session', async () => {
      const active = {
        id: 'session-1',
        status: 'ACTIVE',
        protocolTransactionId: '100',
      };
      prisma.chargingSession.findMany
        .mockResolvedValueOnce([active]) // first signal finds it ACTIVE
        .mockResolvedValueOnce([]); // second signal: already OFFLINE, excluded

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });
      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(sessionLifecycle.suspendSession).toHaveBeenCalledTimes(1);
    });

    // WO-ARGOS-061 test F: clean followed by stale for the same station is
    // equally safe/idempotent — same reasoning as [E], different reasons.
    it('[F] a clean close followed by a stale close for the same station is safe/idempotent', async () => {
      const active = {
        id: 'session-1',
        status: 'ACTIVE',
        protocolTransactionId: '100',
      };
      prisma.chargingSession.findMany
        .mockResolvedValueOnce([active])
        .mockResolvedValueOnce([]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });
      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'stale',
      });

      expect(sessionLifecycle.suspendSession).toHaveBeenCalledTimes(1);
    });

    // WO-ARGOS-061 test G: a session already COMPLETED before the disconnect
    // signal arrives is never in the ACTIVE/SUSPENDED query result, so it's
    // structurally untouched — same guarantee for clean as previously
    // verified for stale.
    it('[G] a terminal (already-COMPLETED) session is untouched by a clean close', async () => {
      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(prisma.chargingSession.findMany).toHaveBeenCalledWith({
        where: {
          chargingStationId: 'cs1',
          status: { in: ['ACTIVE', 'SUSPENDED'] },
        },
      });
      expect(sessionLifecycle.suspendSession).not.toHaveBeenCalled();
    });

    // WO-ARGOS-061 test I: multi-connector/multi-EVSE station — every
    // ACTIVE/SUSPENDED session belonging to the station is reconciled, not
    // only the first one. The query itself is station-scoped (not
    // connector-scoped), so findMany naturally returns every affected
    // session across every connector/EVSE.
    it('[I] reconciles every ACTIVE/SUSPENDED session across a multi-connector station on a clean close', async () => {
      const sessionA = {
        id: 'session-a',
        status: 'ACTIVE',
        protocolTransactionId: '100',
        connectorId: 'connector-a',
      };
      const sessionB = {
        id: 'session-b',
        status: 'SUSPENDED',
        protocolTransactionId: '101',
        connectorId: 'connector-b',
      };
      prisma.chargingSession.findMany.mockResolvedValue([sessionA, sessionB]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'clean',
      });

      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-a',
        'OFFLINE',
      );
      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-b',
        'OFFLINE',
      );
      expect(sessionLifecycle.suspendSession).toHaveBeenCalledTimes(2);
    });

    // WO-ARGOS-061 tests J & K: reconciliation must never touch
    // Connector.status or Evse.status — WO-060 confirmed
    // StatusNotificationHandler remains the sole writer of Connector.status,
    // and Evse.status (administrative) is independent of connectivity.
    // Asserted here via the Prisma mock surface: no connector/evse client
    // is even provided to the coordinator, so any attempt to write either
    // would throw as "not a function" — this test documents and locks in
    // that the coordinator's write surface is exactly
    // ChargingStation + ChargingSession, nothing else.
    it('[J, K] never touches Connector.status or Evse.status — no connector/evse Prisma client is used', async () => {
      const active = {
        id: 'session-1',
        status: 'ACTIVE',
        protocolTransactionId: '100',
      };
      prisma.chargingSession.findMany.mockResolvedValue([active]);
      expect(
        (prisma as unknown as Record<string, unknown>).connector,
      ).toBeUndefined();
      expect(
        (prisma as unknown as Record<string, unknown>).evse,
      ).toBeUndefined();

      await expect(
        coordinator.handleConnectionClosed({
          chargingStationId: 'cs1',
          ocppIdentity: 'movos-abc123',
          reason: 'clean',
        }),
      ).resolves.not.toThrow();
    });
  });
});
