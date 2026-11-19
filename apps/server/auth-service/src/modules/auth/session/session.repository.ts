// Job: session hashes in Redis (auth-design 0.2, spec 012 A1, A14). A session is created in one
// MULTI with its TTL, so no session hash exists without one. The check reads three fields with
// one HMGET (auth-design 0.3). Redis down: StoreUnavailableError (503, never 401; A8).
// Key patterns and field names match contracts/messaging.json (test/contract.test.ts).
// Rotate, revoke and claims writes run as one Lua script each (sessionScripts.ts, plan 012b
// D3 to D5).
import { StoreUnavailableError } from '../../../common/storeErrors.js';
import { MARK_CLAIMS_STALE, REVOKE_ALL_OF_USER, REVOKE_ONE, ROTATE } from './session.scripts.js';
import type { RedisClient } from '../../../infra/stores.js';

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

const SESSION_KEY_PREFIX = SESSION_KEY.replace('{sid}', '');
// The user set key around `{userId}`, for the rotate script (slice, so both are a string).
const USER_ID_AT = USER_SESSIONS_KEY.indexOf('{userId}');
const USER_SESSIONS_PREFIX = USER_SESSIONS_KEY.slice(0, USER_ID_AT);
const USER_SESSIONS_SUFFIX = USER_SESSIONS_KEY.slice(USER_ID_AT + '{userId}'.length);
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

export type RevokeReason = 'logout' | 'blocked' | 'refresh_reuse';

// Result of the refresh script (plan 012b D3); the service maps it to a response.
export type RotateResult =
  | { kind: 'rotated'; claimsVersion: number }
  | { kind: 'reuse' }
  | { kind: 'revoked'; reason: RevokeReason }
  | { kind: 'invalid' };

export interface SessionStore {
  create(session: NewSession): Promise<string>;
  // undefined when no session hash exists for the sid.
  readForCheck(sid: string): Promise<SessionForCheck | undefined>;
  // undefined when no session hash exists for the sid (one HGET, spec 012 B12).
  readUserId(sid: string): Promise<string | undefined>;
  // The five refresh steps in one script (B1); reuse revokes with refresh_reuse inside it.
  rotate(sid: string, presentedHash: string, newHash: string): Promise<RotateResult>;
  // true when this call revoked the session; false when it is missing, already revoked or
  // owned by another user than expectedUserId (D4).
  revoke(sid: string, reason: RevokeReason, expectedUserId?: string): Promise<boolean>;
  // Both return how many sessions they changed; sids whose hash is gone leave the set (D5).
  revokeAllOfUser(userId: string, reason: RevokeReason): Promise<number>;
  markClaimsStale(userId: string): Promise<number>;
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

    readUserId: (sid) =>
      run(async () => (await redis.hGet(sessionKey(sid), F.USER_ID)) ?? undefined),

    rotate: (sid, presentedHash, newHash) =>
      run(async () => {
        const [kind, value] = (await redis.eval(ROTATE, {
          keys: [sessionKey(sid)],
          arguments: [
            presentedHash,
            newHash,
            String(Date.now()),
            String(refreshTtlSeconds),
            USER_SESSIONS_PREFIX,
            USER_SESSIONS_SUFFIX,
            sid,
          ],
        })) as [string, string?];
        if (kind === 'rotated') return { kind, claimsVersion: Number(value) };
        if (kind === 'revoked') return { kind, reason: value as RevokeReason };
        if (kind === 'reuse') return { kind };
        return { kind: 'invalid' };
      }),

    revoke: (sid, reason, expectedUserId = '') =>
      run(async () => {
        const changed = await redis.eval(REVOKE_ONE, {
          keys: [sessionKey(sid)],
          arguments: [reason, expectedUserId],
        });
        return changed === 1;
      }),

    revokeAllOfUser: (userId, reason) =>
      run(async () =>
        Number(
          await redis.eval(REVOKE_ALL_OF_USER, {
            keys: [userSessionsKey(userId)],
            arguments: [SESSION_KEY_PREFIX, reason],
          }),
        ),
      ),

    markClaimsStale: (userId) =>
      run(async () =>
        Number(
          await redis.eval(MARK_CLAIMS_STALE, {
            keys: [userSessionsKey(userId)],
            arguments: [SESSION_KEY_PREFIX],
          }),
        ),
      ),
  };
}
