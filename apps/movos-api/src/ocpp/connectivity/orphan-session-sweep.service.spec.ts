import { OrphanSessionSweepService } from './orphan-session-sweep.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { SessionLifecycleService } from '../../sessions/session-lifecycle.service';

function fakePrisma(): jest.Mocked<Pick<PrismaService, '$queryRaw'>> {
  return { $queryRaw: jest.fn().mockResolvedValue([]) };
}

function fakeAudit(): jest.Mocked<Pick<AuditService, 'record'>> {
  return { record: jest.fn().mockResolvedValue(undefined) };
}

function fakeSessionLifecycle(): jest.Mocked<
  Pick<SessionLifecycleService, 'failSession'>
> {
  return {
    failSession: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve({ id, status: 'FAILED' }),
      ),
  };
}

describe('OrphanSessionSweepService', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let audit: ReturnType<typeof fakeAudit>;
  let sessionLifecycle: ReturnType<typeof fakeSessionLifecycle>;
  let service: OrphanSessionSweepService;

  beforeEach(() => {
    prisma = fakePrisma();
    audit = fakeAudit();
    sessionLifecycle = fakeSessionLifecycle();
    service = new OrphanSessionSweepService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      sessionLifecycle as unknown as SessionLifecycleService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('does nothing when the query finds no orphan candidates', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await service.sweep();
    expect(sessionLifecycle.failSession).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('fails an orphan candidate with NETWORK_FAILURE and records SESSION_ORPHAN_EXPIRED', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'session-1',
        chargingStationId: 'cs1',
        protocolTransactionId: '100',
      },
    ]);

    await service.sweep();

    expect(sessionLifecycle.failSession).toHaveBeenCalledWith(
      'session-1',
      'NETWORK_FAILURE',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SESSION_ORPHAN_EXPIRED',
        subjectType: 'ChargingSession',
        subjectId: 'session-1',
        metadata: expect.objectContaining({
          chargingStationId: 'cs1',
          protocolTransactionId: '100',
        }),
      }),
    );
  });

  it('processes every candidate the query returns, independently', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'session-1', chargingStationId: 'cs1', protocolTransactionId: '1' },
      { id: 'session-2', chargingStationId: 'cs2', protocolTransactionId: '2' },
      { id: 'session-3', chargingStationId: 'cs3', protocolTransactionId: '3' },
    ]);

    await service.sweep();

    expect(sessionLifecycle.failSession).toHaveBeenCalledTimes(3);
    expect(audit.record).toHaveBeenCalledTimes(3);
  });

  // Recovery-replay scenario: a session resolved (recovered, stopped, or
  // already failed) between the raw SELECT and this sweep's failSession
  // call — failSession's own transition-table check rejects the stale
  // attempt; the sweep must not crash or misreport it as expired.
  it('skips a candidate cleanly, without recording an audit event, when it was already resolved before failSession runs', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'session-1',
        chargingStationId: 'cs1',
        protocolTransactionId: '100',
      },
    ]);
    sessionLifecycle.failSession.mockRejectedValueOnce(
      new Error('invalid transition: COMPLETED -> FAILED'),
    );

    await expect(service.sweep()).resolves.toBeUndefined();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('continues processing remaining candidates after one fails to expire', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'session-1', chargingStationId: 'cs1', protocolTransactionId: '1' },
      { id: 'session-2', chargingStationId: 'cs2', protocolTransactionId: '2' },
    ]);
    sessionLifecycle.failSession.mockRejectedValueOnce(
      new Error('already resolved'),
    );

    await service.sweep();

    expect(sessionLifecycle.failSession).toHaveBeenCalledTimes(2);
    // Only session-2 (the one that didn't throw) gets an audit record.
    expect(audit.record).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'session-2' }),
    );
  });

  it('does not throw when the sweep query itself fails — logs and returns', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    await expect(service.sweep()).resolves.toBeUndefined();
    expect(sessionLifecycle.failSession).not.toHaveBeenCalled();
  });
});

describe('OrphanSessionSweepService — timer behavior', () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let audit: ReturnType<typeof fakeAudit>;
  let sessionLifecycle: ReturnType<typeof fakeSessionLifecycle>;
  let service: OrphanSessionSweepService;

  const SWEEP_INTERVAL_MS = 60_000;

  beforeEach(() => {
    jest.useFakeTimers();
    prisma = fakePrisma();
    audit = fakeAudit();
    sessionLifecycle = fakeSessionLifecycle();
    service = new OrphanSessionSweepService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      sessionLifecycle as unknown as SessionLifecycleService,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('runs the sweep automatically on the configured interval', async () => {
    expect(prisma.$queryRaw).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(SWEEP_INTERVAL_MS);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('clears the sweep timer on module destroy, leaving no pending timers', () => {
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });
});
