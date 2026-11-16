// Job: GET /session and GET /me (spec 012 A5, A16, A17; plan 012a C5). Both read the user from
// MongoDB by `sub`, because email and displayName are not in the token; a user missing there
// answers 401 UNAUTHENTICATED, MongoDB down 503. Neither writes to Redis: /session never rotates.
import { ApiError } from '../errors.js';
import type { UsersRepository } from '../repositories/users.js';
import type { LoggedInUser } from './login.js';
import type { SessionCheck } from './sessionCheck.js';
import type { VerifiedClaims } from './sessionTokens.js';

export interface SessionService extends SessionCheck {
  // The same access token and its user, after the four checks.
  restore(accessToken: string): Promise<{ accessToken: string; user: LoggedInUser }>;
  // The caller from requireAccess, with perms from the token (empty until 1.3).
  me(claims: VerifiedClaims): Promise<LoggedInUser & { perms: string[] }>;
}

export function createSessionService(sessionCheck: SessionCheck, users: Pick<UsersRepository, 'findById'>): SessionService {
  async function userOf(sub: string): Promise<LoggedInUser> {
    const user = await users.findById(sub);
    if (!user) throw new ApiError('UNAUTHENTICATED');
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
  }
  return {
    check: (token) => sessionCheck.check(token),
    async restore(accessToken) {
      const claims = await sessionCheck.check(accessToken);
      return { accessToken, user: await userOf(claims.sub) };
    },
    async me(claims) {
      return { ...(await userOf(claims.sub)), perms: claims.perms };
    },
  };
}
