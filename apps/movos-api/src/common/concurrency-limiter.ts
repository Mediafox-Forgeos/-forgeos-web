/**
 * A minimal in-process concurrency limiter — CAP-006A (WO-ARGOS-012)
 * Objective 3, closing RA-003. Caps how many `run()` callbacks may be
 * in flight at once; anything past the limit queues (FIFO) instead of
 * firing immediately. No distributed infrastructure (Redis, a message
 * broker) — a correlated mass event (a network incident disconnecting
 * many stations in one `sweepStale()` tick, or a reconnect storm after
 * that same incident resolves) is bounded to at most `limit` concurrent
 * downstream calls, regardless of how many candidates arrive at once or
 * how they're spread out over time.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {
    if (limit < 1) {
      throw new Error('ConcurrencyLimiter requires a limit of at least 1');
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /** Diagnostics only — never used to gate behavior. */
  get pending(): number {
    return this.queue.length;
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}
