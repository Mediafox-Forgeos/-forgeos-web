import { ConcurrencyLimiter } from './concurrency-limiter';

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('ConcurrencyLimiter', () => {
  it('rejects a limit below 1', () => {
    expect(() => new ConcurrencyLimiter(0)).toThrow();
  });

  it('runs a single task immediately', async () => {
    const limiter = new ConcurrencyLimiter(2);
    const result = await limiter.run(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('never exceeds the concurrency limit — excess tasks queue until a slot frees', async () => {
    const limiter = new ConcurrencyLimiter(2);
    let concurrent = 0;
    let maxConcurrent = 0;
    const gates = [deferred<void>(), deferred<void>(), deferred<void>()];

    const runs = gates.map((gate, i) =>
      limiter.run(async () => {
        concurrent += 1;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await gate.promise;
        concurrent -= 1;
        return i;
      }),
    );

    // Let the microtask queue settle so the first two tasks actually start.
    await Promise.resolve();
    await Promise.resolve();
    expect(maxConcurrent).toBe(2); // the 3rd task is queued, not running yet

    gates[0]!.resolve();
    await Promise.resolve();
    await Promise.resolve();
    gates[1]!.resolve();
    gates[2]!.resolve();

    const results = await Promise.all(runs);
    expect(results.sort()).toEqual([0, 1, 2]);
    expect(maxConcurrent).toBe(2);
  });

  it('releases the slot even when the task throws, so queued work still runs', async () => {
    const limiter = new ConcurrencyLimiter(1);

    await expect(
      limiter.run(() => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');

    // If the slot weren't released, this would hang forever.
    const result = await limiter.run(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('reports pending queue depth for diagnostics', async () => {
    const limiter = new ConcurrencyLimiter(1);
    const gate = deferred<void>();

    const first = limiter.run(() => gate.promise);
    const second = limiter.run(() => Promise.resolve());
    await Promise.resolve();

    expect(limiter.pending).toBe(1);
    gate.resolve();
    await first;
    await second;
    expect(limiter.pending).toBe(0);
  });
});
