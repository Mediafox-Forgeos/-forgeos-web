import { Test } from '@nestjs/testing';

import { PendingCallRegistryService } from './pending-call-registry.service';

describe('PendingCallRegistryService (WO-ARGOS-059)', () => {
  let service: PendingCallRegistryService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PendingCallRegistryService],
    }).compile();
    service = moduleRef.get(PendingCallRegistryService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('correlates a CALLRESULT to the pending call that registered its messageId', () => {
    const resolve = jest.fn();
    const onTimeout = jest.fn();
    service.register('msg-1', 'station-abc', { resolve, onTimeout });

    expect(service.has('msg-1')).toBe(true);
    service.resolve('msg-1', {
      kind: 'CALLRESULT',
      payload: { status: 'Accepted' },
    });

    expect(resolve).toHaveBeenCalledWith({
      kind: 'CALLRESULT',
      payload: { status: 'Accepted' },
    });
    expect(onTimeout).not.toHaveBeenCalled();
    // Resolved entries are removed — a duplicate/late response for the
    // same messageId must not resolve twice.
    expect(service.has('msg-1')).toBe(false);
  });

  it('correlates a CALLERROR the same way', () => {
    const resolve = jest.fn();
    service.register('msg-2', 'station-abc', { resolve, onTimeout: jest.fn() });

    service.resolve('msg-2', {
      kind: 'CALLERROR',
      errorCode: 'NotSupported',
      errorDescription: 'nope',
      details: {},
    });

    expect(resolve).toHaveBeenCalledWith({
      kind: 'CALLERROR',
      errorCode: 'NotSupported',
      errorDescription: 'nope',
      details: {},
    });
  });

  it('an unknown/stale messageId resolves safely as a no-op, never throws', () => {
    expect(() =>
      service.resolve('never-registered', {
        kind: 'CALLRESULT',
        payload: {},
      }),
    ).not.toThrow();
  });

  it('a messageId that already resolved cannot be resolved again (stale duplicate is a no-op)', () => {
    const resolve = jest.fn();
    service.register('msg-3', 'station-abc', { resolve, onTimeout: jest.fn() });
    service.resolve('msg-3', {
      kind: 'CALLRESULT',
      payload: { status: 'Accepted' },
    });
    service.resolve('msg-3', {
      kind: 'CALLRESULT',
      payload: { status: 'Rejected' },
    });

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('times out deterministically when no response arrives within the window', () => {
    const resolve = jest.fn();
    const onTimeout = jest.fn();
    service.register('msg-4', 'station-abc', { resolve, onTimeout }, 5_000);

    jest.advanceTimersByTime(5_000);

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(resolve).not.toHaveBeenCalled();
    expect(service.has('msg-4')).toBe(false);
  });

  it('a response that arrives just before the timeout cancels the timer — no double-fire', () => {
    const resolve = jest.fn();
    const onTimeout = jest.fn();
    service.register('msg-5', 'station-abc', { resolve, onTimeout }, 5_000);

    jest.advanceTimersByTime(4_999);
    service.resolve('msg-5', { kind: 'CALLRESULT', payload: {} });
    jest.advanceTimersByTime(10_000);

    expect(resolve).toHaveBeenCalledTimes(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('pending calls do not live forever — cancelAll() fires onTimeout for every still-pending entry', () => {
    const onTimeout1 = jest.fn();
    const onTimeout2 = jest.fn();
    service.register('msg-6', 'station-a', {
      resolve: jest.fn(),
      onTimeout: onTimeout1,
    });
    service.register('msg-7', 'station-b', {
      resolve: jest.fn(),
      onTimeout: onTimeout2,
    });

    expect(service.pendingCount()).toBe(2);
    service.cancelAll();

    expect(onTimeout1).toHaveBeenCalledTimes(1);
    expect(onTimeout2).toHaveBeenCalledTimes(1);
    expect(service.pendingCount()).toBe(0);
  });

  it('two different pending calls resolve independently', () => {
    const resolveA = jest.fn();
    const resolveB = jest.fn();
    service.register('msg-a', 'station-a', {
      resolve: resolveA,
      onTimeout: jest.fn(),
    });
    service.register('msg-b', 'station-b', {
      resolve: resolveB,
      onTimeout: jest.fn(),
    });

    service.resolve('msg-b', { kind: 'CALLRESULT', payload: { for: 'b' } });

    expect(resolveB).toHaveBeenCalledWith({
      kind: 'CALLRESULT',
      payload: { for: 'b' },
    });
    expect(resolveA).not.toHaveBeenCalled();
    expect(service.has('msg-a')).toBe(true);
  });
});
