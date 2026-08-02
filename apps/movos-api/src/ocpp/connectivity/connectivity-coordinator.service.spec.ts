import type { ChargingSession } from '@prisma/client';

import { ConnectivityCoordinator } from './connectivity-coordinator.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { SessionLifecycleService } from '../../sessions/session-lifecycle.service';

// Test fixtures below are deliberately partial (only the fields each test
// actually reads) — cast at the boundary rather than filling in a dozen
// irrelevant ChargingSession columns per fixture.
function asSession(partial: Record<string, unknown>): ChargingSession {
  return partial as unknown as ChargingSession;
}

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
  Pick<SessionLifecycleService, 'suspendSession' | 'recoverOfflineSession'>
> {
  return {
    suspendSession: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve({ id, status: 'OFFLINE' }),
      ),
    // CAP-006A: the conflict-check + window-check + resume decision is now
    // one atomic call into SessionLifecycleService — the coordinator only
    // interprets the result. Defaults to 'recovered'; individual tests
    // override with mockResolvedValueOnce for the other outcomes.
    recoverOfflineSession: jest.fn().mockImplementation((id: string) =>
      Promise.resolve({
        outcome: 'recovered',
        session: { id, status: 'ACTIVE' },
      }),
    ),
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
      expect(sessionLifecycle.recoverOfflineSession).not.toHaveBeenCalled();
    });

    // Scenario 8: an OFFLINE session on the reconnecting station, within
    // the recovery window and with no conflicting connector session, is
    // restored to ACTIVE — reported as RECONNECTED, not CONNECTED.
    it('restores an OFFLINE session and records RECONNECTED when recovery succeeds', async () => {
      const session = offlineSession();
      prisma.chargingSession.findFirst.mockResolvedValueOnce(session); // the OFFLINE-session lookup
      sessionLifecycle.recoverOfflineSession.mockResolvedValueOnce({
        outcome: 'recovered',
        session: asSession({ ...session, status: 'ACTIVE' }),
      });

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
      expect(sessionLifecycle.recoverOfflineSession).toHaveBeenCalledWith(
        session.id,
        ConnectivityCoordinator.RECOVERY_WINDOW_MS,
      );
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
      prisma.chargingSession.findFirst.mockResolvedValueOnce(session);
      sessionLifecycle.recoverOfflineSession.mockResolvedValueOnce({
        outcome: 'rejected',
        session: asSession(session),
        rejectionReason: 'conflicting-session-on-connector',
      });

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

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
      prisma.chargingSession.findFirst.mockResolvedValueOnce(session);
      sessionLifecycle.recoverOfflineSession.mockResolvedValueOnce({
        outcome: 'rejected',
        session: asSession(session),
        rejectionReason: 'outside-recovery-window',
      });

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SESSION_RECOVERY_REJECTED',
          metadata: expect.objectContaining({
            reason: 'outside-recovery-window',
          }),
        }),
      );
    });

    // CAP-006A Invariant 3 (WO-ARGOS-012): a duplicate/replayed reconnect
    // that finds the session already resolved (recovered by a concurrent
    // call, or terminated by a StopTransaction, while this call waited for
    // the connector lock) is a clean no-op — no audit event of its own,
    // since the event that actually resolved the session owns that trail.
    it('records no audit event when recovery finds the session already resolved', async () => {
      const session = offlineSession();
      prisma.chargingSession.findFirst.mockResolvedValueOnce(session);
      sessionLifecycle.recoverOfflineSession.mockResolvedValueOnce({
        outcome: 'already-resolved',
        session: asSession({ ...session, status: 'ACTIVE' }),
      });

      await coordinator.handleConnectionEstablished({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        protocolVersion: 'OCPP1_6J',
      });

      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SESSION_RECOVERED' }),
      );
      expect(audit.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'SESSION_RECOVERY_REJECTED' }),
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
    // Scenario 2: a clean disconnect updates station connectivity and
    // records DISCONNECTED, but never touches any ChargingSession.
    it('marks the station OFFLINE and records DISCONNECTED on a clean close, without touching sessions', async () => {
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
      expect(prisma.chargingSession.findMany).not.toHaveBeenCalled();
      expect(sessionLifecycle.suspendSession).not.toHaveBeenCalled();
    });

    // Scenarios 3 & 5: a stale close moves an ACTIVE session to OFFLINE.
    it('moves an ACTIVE session to OFFLINE on a stale close', async () => {
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
        expect.objectContaining({ action: 'SESSION_MOVED_OFFLINE' }),
      );
    });

    // Scenario 6: a SUSPENDED session is equally moved to OFFLINE — the
    // query includes both ACTIVE and SUSPENDED by design (CAP-004 treats
    // both as "logically active, temporarily not delivering energy").
    it('moves a SUSPENDED session to OFFLINE on a stale close', async () => {
      const suspended = {
        id: 'session-2',
        status: 'SUSPENDED',
        protocolTransactionId: '101',
      };
      prisma.chargingSession.findMany.mockResolvedValue([suspended]);

      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'stale',
      });

      expect(sessionLifecycle.suspendSession).toHaveBeenCalledWith(
        'session-2',
        'OFFLINE',
      );
    });

    // Scenario 7: a COMPLETED session is never in the ACTIVE/SUSPENDED
    // query result in the first place, so it is structurally impossible
    // for a stale close to touch it.
    it('queries only ACTIVE and SUSPENDED sessions, never terminal ones, on a stale close', async () => {
      await coordinator.handleConnectionClosed({
        chargingStationId: 'cs1',
        ocppIdentity: 'movos-abc123',
        reason: 'stale',
      });

      expect(prisma.chargingSession.findMany).toHaveBeenCalledWith({
        where: {
          chargingStationId: 'cs1',
          status: { in: ['ACTIVE', 'SUSPENDED'] },
        },
      });
      expect(sessionLifecycle.suspendSession).not.toHaveBeenCalled();
    });
  });
});
