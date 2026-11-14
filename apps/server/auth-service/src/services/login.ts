// Job: log in with email and password (spec 009 B1, B2, B8, B10). The order never changes:
// normalize the email; email locked, then IP over its limit: 429; find the user; check the
// password, against the dummy hash for an unknown email; failure: count it, 401; blocked: clear
// the email counter (not a guess), 403; success: clear the email counter, answer the user.
import { randomBytes } from 'node:crypto';
import { ApiError } from '../errors.js';
import { normalizeEmail, type Role, type UsersRepository } from '../repositories/users.js';
import type { LoginLimit } from './loginLimit.js';
import { hashPassword, verifyPassword } from './password.js';

export interface LoginInput {
  email: string;
  password: string;
  ip: string;
}

export interface LoggedInUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface LoginService {
  login(input: LoginInput): Promise<{ user: LoggedInUser }>;
}

export interface LoginServiceDeps {
  users: Pick<UsersRepository, 'findByEmail'>;
  loginLimit: LoginLimit;
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

export function createLoginService({ users, loginLimit, dummyHash, verify = verifyPassword }: LoginServiceDeps): LoginService {
  return {
    async login({ email: rawEmail, password, ip }) {
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
      return { user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role } };
    },
  };
}
