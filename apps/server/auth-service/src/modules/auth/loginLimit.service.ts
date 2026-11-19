// Job: the login failure limits (spec 009 B1, B3, B4, B12; plan 009b C1, C2): 5 failures per
// email, then 20 per client IP, in a 15-minute fixed window; then 429 RATE_LIMITED with
// retryAfterSeconds. A success clears the email counter only; the IP counter only expires.
// Email keys hold the sha256 of the normalized email, never the email itself.
import { createHash } from 'node:crypto';
import { ApiError } from '../../common/apiError.js';
import type { FailureCounter } from '../../common/failureCounter.js';

export const LOGIN_EMAIL_FAILURE_LIMIT = 5;
export const LOGIN_IP_FAILURE_LIMIT = 20;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_KEY_PREFIX = 'auth:login-fail:';

export interface LoginLimit {
  // Throws ApiError RATE_LIMITED when the email, then the IP, has used up its failures.
  check(email: string, ip: string): Promise<void>;
  // Counts one failure for the email and one for the IP.
  fail(email: string, ip: string): Promise<void>;
  // Clears the email counter; the IP counter stays (C1).
  succeed(email: string): Promise<void>;
}

const emailKey = (email: string) =>
  `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
const ipKey = (ip: string) => `ip:${ip}`;

export function createLoginLimit(counter: FailureCounter): LoginLimit {
  async function checkOne(key: string, limit: number): Promise<void> {
    const { count, retryAfterSeconds } = await counter.get(key);
    if (count >= limit) {
      throw new ApiError('RATE_LIMITED', {
        retryAfterSeconds: retryAfterSeconds || LOGIN_WINDOW_SECONDS,
      });
    }
  }
  return {
    async check(email, ip) {
      await checkOne(emailKey(email), LOGIN_EMAIL_FAILURE_LIMIT);
      await checkOne(ipKey(ip), LOGIN_IP_FAILURE_LIMIT);
    },
    async fail(email, ip) {
      await counter.add(emailKey(email));
      await counter.add(ipKey(ip));
    },
    succeed: (email) => counter.clear(emailKey(email)),
  };
}
