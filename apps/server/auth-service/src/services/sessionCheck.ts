// Job: the four access-token checks (spec 012 A2, A8, A9; auth-design 0.3), shared by the
// requireAccess middleware and GET /session. Order: verify the token; the session exists and
// its userId equals `sub`; not revoked; `cv` at least claimsVersion. One readForCheck (one
// HMGET) per call. Redis down: StoreUnavailableError passes through (503, never 401).
import { ApiError } from '../errors.js';
import type { SessionStore } from '../repositories/sessions.js';
import type { SessionTokens, VerifiedClaims } from './sessionTokens.js';

export interface SessionCheck {
  // The verified claims, or throws ApiError UNAUTHENTICATED, SESSION_REVOKED or TOKEN_CLAIMS_STALE.
  check(token: string): Promise<VerifiedClaims>;
}

export function createSessionCheck(tokens: SessionTokens, sessions: SessionStore): SessionCheck {
  return {
    async check(token) {
      const claims = tokens.verifyAccess(token);
      if (!claims) throw new ApiError('UNAUTHENTICATED');
      const session = await sessions.readForCheck(claims.sid);
      if (!session || session.userId !== claims.sub) throw new ApiError('UNAUTHENTICATED');
      if (session.revoked) throw new ApiError('SESSION_REVOKED');
      if (claims.cv < session.claimsVersion) throw new ApiError('TOKEN_CLAIMS_STALE');
      return claims;
    },
  };
}
