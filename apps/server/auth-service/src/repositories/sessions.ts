// Job: session hashes in Redis (auth-design 0.2, spec 012 A1, A14). A session is created in one
// MULTI with its TTL, so no session hash exists without one. The check reads three fields with
// one HMGET (auth-design 0.3). Redis down: StoreUnavailableError (503, never 401; A8).
// Key patterns and field names match contracts/messaging.json (test/contract.test.ts).
import { StoreUnavailableError } from './errors.js';
import type { RedisClient } from './stores.js';

export const SESSION_KEY = 'sess:{sid}';
export const USER_SESSIONS_KEY = 'user:{userId}:sessions';
export const SESSION_FIELD = {
  USER_ID: 'userId',
  METHOD: 'method',
  DEVICE_ID: 'deviceId',
  PLATFORM: 'platform',
  REFRESH_HASH: 'refreshHash',
  PREV_REFRESH_HASH: 'prevRefreshHash',
  ROTATED_AT: 'rotatedAt',
  CLAIMS_VERSION: 'claimsVersion',
  REVOKED: 'revoked',
  REVOKED_REASON: 'revokedReason',
  CREATED_AT: 'createdAt',
} as const;

export const sessionKey = (sid: string) => SESSION_KEY.replace('{sid}', sid);
export const userSessionsKey = (userId: string) =>
  USER_SESSIONS_KEY.replace('{userId}', userId);

export interface NewSession {
  // From newSid(); the caller needs it first to build the refresh token and its hash.
  sid: string;
  userId: string;
  method: 'password';
  platform: 'web' | 'other';
  deviceId: string;
  refreshHash: string;
}

export interface SessionForCheck {
  userId: string;
  revoked: boolean;
  claimsVersion: number;
}

export interface SessionStore {
  create(session: NewSession): Promise<string>;
  // undefined when no session hash exists for the sid.
  readForCheck(sid: string): Promise<SessionForCheck | undefined>;
}

export function createSessionStore(
  redis: RedisClient,
  refreshTtlSeconds: number,
): SessionStore {
  async function run<T>(call: () => Promise<T>): Promise<T> {
    if (!redis.isReady) throw new StoreUnavailableError();
    try {
      return await call();
    } catch {
      throw new StoreUnavailableError();
    }
  }
  const F = SESSION_FIELD;
  return {
    create: ({ sid, userId, method, platform, deviceId, refreshHash }) =>
      run(async () => {
        const key = sessionKey(sid);
        const setKey = userSessionsKey(userId);
        await redis
          .multi()
          .hSet(key, {
            [F.USER_ID]: userId,
            [F.METHOD]: method,
            [F.DEVICE_ID]: deviceId,
            [F.PLATFORM]: platform,
            [F.REFRESH_HASH]: refreshHash,
            [F.PREV_REFRESH_HASH]: '',
            [F.ROTATED_AT]: '',
            [F.CLAIMS_VERSION]: '1',
            [F.REVOKED]: '0',
            [F.REVOKED_REASON]: '',
            [F.CREATED_AT]: String(Date.now()),
          })
          .expire(key, refreshTtlSeconds)
          .sAdd(setKey, sid)
          .expire(setKey, refreshTtlSeconds)
          .exec();
        return sid;
      }),

    readForCheck: (sid) =>
      run(async () => {
        const [userId, revoked, claimsVersion] = await redis.hmGet(
          sessionKey(sid),
          [F.USER_ID, F.REVOKED, F.CLAIMS_VERSION],
        );
        if (!userId) return undefined;
        return {
          userId,
          revoked: revoked === '1',
          claimsVersion: Number(claimsVersion),
        };
      }),
  };
}
