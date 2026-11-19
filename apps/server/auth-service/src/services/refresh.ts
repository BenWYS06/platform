// Job: refresh an access token with a rotating refresh token (spec 012 B1 to B4, B9, B11, B12;
// plan 012b D3, D6, D7, D11). The order never changes: token shape (no Redis call); HGET userId
// (no session: 401, no counter key); per-session counter, 10 per 60 s; the user from MongoDB
// (down: 503 from StoreUnavailableError, nothing rotated; no user: 401); the rotate script;
// blocked user: revoke, 403; else sign with the script's claimsVersion.
import { ApiError } from '../common/apiError.js';
import type { FailureCounter } from '../common/failureCounter.js';
import type { SessionStore } from '../repositories/sessions.js';
import type { UsersRepository } from '../repositories/users.js';
import type { LoginResult } from './login.js';
import type { SessionRevoker } from './sessionRevoker.js';
import { newRefreshToken, type SessionTokens } from './sessionTokens.js';
import { hashToken } from '../common/secretToken.js';

export const REFRESH_SESSION_LIMIT = 10;
export const REFRESH_WINDOW_SECONDS = 60;
export const REFRESH_KEY_PREFIX = 'auth:refresh:sid:';
// `<sid: 22 chars>.<secret: 43 chars>`, both base64url (D6).
const REFRESH_TOKEN_SHAPE = /^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$/;
const SID_LENGTH = 22;

export interface RefreshService {
  // A missing token answers REFRESH_TOKEN_INVALID like a malformed one (D6).
  refresh(refreshToken: string | undefined): Promise<LoginResult>;
}

export interface RefreshServiceDeps {
  users: Pick<UsersRepository, 'findById'>;
  sessions: Pick<SessionStore, 'readUserId' | 'rotate'>;
  // createFailureCounter with REFRESH_KEY_PREFIX and REFRESH_WINDOW_SECONDS (D7).
  counter: FailureCounter;
  revoker: Pick<SessionRevoker, 'revokeSession' | 'announceRevoked'>;
  tokens: Pick<SessionTokens, 'signAccess'>;
}

export function createRefreshService({ users, sessions, counter, revoker, tokens }: RefreshServiceDeps): RefreshService {
  return {
    async refresh(refreshToken) {
      if (!refreshToken || !REFRESH_TOKEN_SHAPE.test(refreshToken)) throw new ApiError('REFRESH_TOKEN_INVALID');
      const sid = refreshToken.slice(0, SID_LENGTH);

      const userId = await sessions.readUserId(sid);
      if (!userId) throw new ApiError('REFRESH_TOKEN_INVALID');

      // Every refresh that passes HGET counts, success or not (D7).
      const { count, retryAfterSeconds } = await counter.get(sid);
      if (count >= REFRESH_SESSION_LIMIT) {
        throw new ApiError('RATE_LIMITED', { retryAfterSeconds: retryAfterSeconds || REFRESH_WINDOW_SECONDS });
      }
      await counter.add(sid);

      const user = await users.findById(userId);
      if (!user) throw new ApiError('REFRESH_TOKEN_INVALID');

      const nextToken = newRefreshToken(sid);
      const result = await sessions.rotate(sid, hashToken(refreshToken), hashToken(nextToken));
      if (result.kind === 'invalid') throw new ApiError('REFRESH_TOKEN_INVALID');
      if (result.kind === 'revoked') throw new ApiError(result.reason === 'blocked' ? 'ACCOUNT_BLOCKED' : 'SESSION_REVOKED');
      if (result.kind === 'reuse') {
        // The script has already revoked; only the event is left (D11).
        await revoker.announceRevoked({ userId, sid, reason: 'refresh_reuse' });
        throw new ApiError('REFRESH_TOKEN_REUSE');
      }

      if (user.status === 'blocked') {
        await revoker.revokeSession(sid, 'blocked', userId);
        throw new ApiError('ACCOUNT_BLOCKED');
      }
      // perms and depts stay empty until 1.3 and 4.1, as at login (spec 012 A12).
      const accessToken = tokens.signAccess({ sub: user.id, sid, role: user.role, perms: [], depts: [], cv: result.claimsVersion });
      return {
        accessToken,
        refreshToken: nextToken,
        user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
      };
    },
  };
}
