// Job: the accept failure limit (spec 009 A6, A14): 20 token-check failures per client IP in a
// 15-minute fixed window, then 429 RATE_LIMITED with retryAfterSeconds. Successes never count.
import { ApiError } from '../errors.js';
import type { FailureCounter } from '../repositories/failureCounter.js';

export const ACCEPT_FAILURE_LIMIT = 20;
export const ACCEPT_WINDOW_SECONDS = 15 * 60;
export const ACCEPT_KEY_PREFIX = 'auth:accept-fail:';

export interface AcceptLimit {
  // Throws ApiError RATE_LIMITED when this IP has used up its failures.
  check(ip: string): Promise<void>;
  fail(ip: string): Promise<void>;
}

export function createAcceptLimit(counter: FailureCounter): AcceptLimit {
  return {
    async check(ip) {
      const { count, retryAfterSeconds } = await counter.get(ip);
      if (count >= ACCEPT_FAILURE_LIMIT) {
        throw new ApiError('RATE_LIMITED', { retryAfterSeconds: retryAfterSeconds || ACCEPT_WINDOW_SECONDS });
      }
    },
    fail: (ip) => counter.add(ip),
  };
}
