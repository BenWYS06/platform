// Job: fixed-window failure counters in Redis (hand-written on purpose, auth CLAUDE.md). The
// first failure starts the window; the key expires with it. Redis down: StoreUnavailableError
// (the error handler answers 503), so limits fail closed (A13).
import { StoreUnavailableError } from './errors.js';
import type { RedisClient } from './stores.js';

export interface FailureCount {
  count: number;
  // Seconds until the window ends; 0 when no window is open.
  retryAfterSeconds: number;
}

export interface FailureCounter {
  get(key: string): Promise<FailureCount>;
  add(key: string): Promise<void>;
}

export function createFailureCounter(redis: RedisClient, prefix: string, windowSeconds: number): FailureCounter {
  async function run<T>(call: () => Promise<T>): Promise<T> {
    if (!redis.isReady) throw new StoreUnavailableError();
    try {
      return await call();
    } catch {
      throw new StoreUnavailableError();
    }
  }
  return {
    get: (key) =>
      run(async () => {
        const [count, ttl] = await redis.multi().get(prefix + key).ttl(prefix + key).exec();
        return { count: Number(count ?? 0), retryAfterSeconds: Math.max(Number(ttl), 0) };
      }),
    add: (key) =>
      run(async () => {
        await redis.multi().incr(prefix + key).expire(prefix + key, windowSeconds, 'NX').exec();
      }),
  };
}
