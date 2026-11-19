// Job: log in with email and password (spec 009 B1, B2, B8, B10; spec 012 A1 to A3, C6). The
// order never changes: normalize the email; email locked, then IP over its limit: 429; find the
// user; check the password, against the dummy hash for an unknown email; failure: count it, 401;
// blocked: clear the email counter (not a guess), 403; success: clear the email counter, create
// the session (Redis down: 503, no token), then sign the access token.
import { randomBytes } from 'node:crypto';
import { ApiError } from '../common/apiError.js';
import type { NewSession, SessionStore } from '../repositories/sessions.js';
import { normalizeEmail, type Role, type UsersRepository, hashPassword, verifyPassword } from '../modules/users/index.js';
import type { LoginLimit } from './loginLimit.js';
import { newRefreshToken, newSid, type SessionTokens } from './sessionTokens.js';
import { hashToken } from '../common/secretToken.js';

export interface LoginInput {
  email: string;
  password: string;
  ip: string;
  // `web` with X-Client: web, else `other` (A13).
  platform: NewSession['platform'];
}

export interface LoggedInUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: LoggedInUser;
}

export interface LoginService {
  login(input: LoginInput): Promise<LoginResult>;
}

export interface LoginServiceDeps {
  users: Pick<UsersRepository, 'findByEmail'>;
  loginLimit: LoginLimit;
  sessions: Pick<SessionStore, 'create'>;
  tokens: Pick<SessionTokens, 'signAccess'>;
  // From createDummyHash, made once at startup.
  dummyHash: string;
  // Tests pass a spy; the default is the real argon2 check.
  verify?: typeof verifyPassword;
}

// An argon2id hash of a random password with the same settings as real hashes (B2, B10), so an
// unknown email costs the same time as a wrong password.
export function createDummyHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString('base64url'));
}

// The startup step: makes the dummy hash once, then the service; server.ts awaits it before it
// listens, so the first login already has the dummy hash.
export async function startLoginService(deps: Omit<LoginServiceDeps, 'dummyHash'>): Promise<LoginService> {
  return createLoginService({ ...deps, dummyHash: await createDummyHash() });
}

export function createLoginService({ users, loginLimit, sessions, tokens, dummyHash, verify = verifyPassword }: LoginServiceDeps): LoginService {
  return {
    async login({ email: rawEmail, password, ip, platform }) {
      const email = normalizeEmail(rawEmail);
      await loginLimit.check(email, ip);

      const user = await users.findByEmail(email);
      const passwordOk = await verify(user?.passwordHash ?? dummyHash, password); // left side undefined or null will fallback dummyHash
      if (!user || !passwordOk) {
        await loginLimit.fail(email, ip);
        throw new ApiError('INVALID_CREDENTIALS');
      }

      await loginLimit.succeed(email);
      if (user.status === 'blocked') throw new ApiError('ACCOUNT_BLOCKED');

      const sid = newSid();
      const refreshToken = newRefreshToken(sid);
      await sessions.create({ sid, userId: user.id, method: 'password', platform, deviceId: '', refreshHash: hashToken(refreshToken) });
      // perms and depts stay empty until 1.3 and 4.1 (A12); a new session starts at claimsVersion 1.
      const accessToken = tokens.signAccess({ sub: user.id, sid, role: user.role, perms: [], depts: [], cv: 1 });
      return { accessToken, refreshToken, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
    },
  };
}
