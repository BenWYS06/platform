// Job: POST /api/auth/logout (spec 012 B6, B13; plan 012b D4, D9). Only the signature is checked,
// expiry ignored; the sid and the owner come from the token, never from the request. The
// session is revoked only when it exists and belongs to `sub`; a missing or already revoked
// session still answers success (the route sends 204). The revoker publishes only on a change.
import { ApiError } from '../errors.js';
import type { SessionRevoker } from './sessionRevoker.js';
import type { SessionTokens } from './sessionTokens.js';

export interface LogoutService {
  // Throws UNAUTHENTICATED for a missing token or a bad signature; revokes nothing then.
  logout(accessToken: string | undefined): Promise<void>;
}

export interface LogoutServiceDeps {
  tokens: Pick<SessionTokens, 'verifyAccessSignature'>;
  revoker: Pick<SessionRevoker, 'revokeSession'>;
}

export function createLogoutService({ tokens, revoker }: LogoutServiceDeps): LogoutService {
  return {
    async logout(accessToken) {
      const claims = accessToken ? tokens.verifyAccessSignature(accessToken) : undefined;
      if (!claims) throw new ApiError('UNAUTHENTICATED');
      await revoker.revokeSession(claims.sid, 'logout', claims.sub);
    },
  };
}
