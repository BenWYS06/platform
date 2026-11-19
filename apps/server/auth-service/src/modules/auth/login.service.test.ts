// Unit: the login service with fakes (spec 009 B1, B2, B8, B10; Done when 2, 6, part of 3).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../common/apiError.js';
import { type User, hashPassword, verifyPassword } from '../users/index.js';
import { createDummyHash, createLoginService, startLoginService } from './login.service.js';
import type { LoginLimit } from './loginLimit.service.js';

const PASSWORD = 'a long enough password';
const IP = '203.0.113.5';
// Sessions and tokens are proved in test/login-flow.test.ts; here they only must not fail.
const fakeSessions = { create: async ({ sid }: { sid: string }) => sid };
const fakeTokens = { signAccess: () => 'access-token' };

let dummyHash: string;
let activeUser: User;
let blockedUser: User;

beforeAll(async () => {
  dummyHash = await createDummyHash();
  const base = { displayName: 'Boss', role: 'Owner' as const, passwordHash: await hashPassword(PASSWORD), createdAt: new Date(), updatedAt: new Date() };
  activeUser = { id: 'u1', email: 'boss@team.test', status: 'active', ...base };
  blockedUser = { id: 'u2', email: 'gone@team.test', status: 'blocked', ...base };
});

function setup(locked = false) {
  const calls: string[] = [];
  const findByEmail = vi.fn(async (email: string) => [activeUser, blockedUser].find((u) => u.email === email) ?? null);
  const verify = vi.fn(verifyPassword);
  const loginLimit: LoginLimit = {
    check: vi.fn(async (email: string, ip: string) => {
      calls.push(`check ${email} ${ip}`);
      if (locked) throw new ApiError('RATE_LIMITED', { retryAfterSeconds: 600 });
    }),
    fail: vi.fn(async (email: string, ip: string) => {
      calls.push(`fail ${email} ${ip}`);
    }),
    succeed: vi.fn(async (email: string) => {
      calls.push(`succeed ${email}`);
    }),
  };
  const service = createLoginService({ users: { findByEmail }, loginLimit, sessions: fakeSessions, tokens: fakeTokens, dummyHash, verify });
  return { service, findByEmail, verify, loginLimit, calls };
}

async function codeOf(call: Promise<unknown>): Promise<string> {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).code;
}

describe('login service', () => {
  it('makes the dummy hash with the real argon2 settings', () => {
    expect(dummyHash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
  });

  it('returns the user without the hash for the right password and clears the email counter', async () => {
    const { service, calls } = setup();
    const result = await service.login({ email: '  Boss@Team.TEST ', password: PASSWORD, ip: IP, platform: 'other' });
    expect(result.user).toEqual({ id: 'u1', email: 'boss@team.test', displayName: 'Boss', role: 'Owner' });
    expect(calls).toEqual([`check boss@team.test ${IP}`, 'succeed boss@team.test']);
  });

  it('throws INVALID_CREDENTIALS and counts the failure for a wrong password', async () => {
    const { service, calls, verify } = setup();
    expect(await codeOf(service.login({ email: 'boss@team.test', password: 'wrong password here', ip: IP, platform: 'other' }))).toBe('INVALID_CREDENTIALS');
    expect(verify).toHaveBeenCalledWith(activeUser.passwordHash, 'wrong password here');
    expect(calls).toEqual([`check boss@team.test ${IP}`, `fail boss@team.test ${IP}`]);
  });

  it('throws INVALID_CREDENTIALS and counts the failure for an unknown email, checked against the dummy hash', async () => {
    const { service, calls, verify } = setup();
    expect(await codeOf(service.login({ email: 'nobody@team.test', password: PASSWORD, ip: IP, platform: 'other' }))).toBe('INVALID_CREDENTIALS');
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(dummyHash, PASSWORD);
    expect(calls).toEqual([`check nobody@team.test ${IP}`, `fail nobody@team.test ${IP}`]);
  });

  it('throws ACCOUNT_BLOCKED for a blocked user with the right password and clears, never counts', async () => {
    const { service, calls, loginLimit } = setup();
    expect(await codeOf(service.login({ email: 'gone@team.test', password: PASSWORD, ip: IP, platform: 'other' }))).toBe('ACCOUNT_BLOCKED');
    expect(loginLimit.fail).not.toHaveBeenCalled();
    expect(calls).toEqual([`check gone@team.test ${IP}`, 'succeed gone@team.test']);
  });

  it('throws INVALID_CREDENTIALS and counts the failure for a blocked user with a wrong password', async () => {
    const { service, calls, loginLimit } = setup();
    expect(await codeOf(service.login({ email: 'gone@team.test', password: 'wrong password here', ip: IP, platform: 'other' }))).toBe('INVALID_CREDENTIALS');
    expect(loginLimit.succeed).not.toHaveBeenCalled();
    expect(calls).toEqual([`check gone@team.test ${IP}`, `fail gone@team.test ${IP}`]);
  });

  it('throws 429 for a locked email before any user lookup or password check', async () => {
    const { service, findByEmail, verify, loginLimit } = setup(true);
    expect(await codeOf(service.login({ email: 'boss@team.test', password: PASSWORD, ip: IP, platform: 'other' }))).toBe('RATE_LIMITED');
    expect(findByEmail).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
    expect(loginLimit.fail).not.toHaveBeenCalled();
  });
});

describe('login service at startup', () => {
  it('checks an unknown-email login right after startup against the dummy hash', async () => {
    const verify = vi.fn(verifyPassword);
    const noLimit: LoginLimit = { check: async () => {}, fail: async () => {}, succeed: async () => {} };
    const service = await startLoginService({ users: { findByEmail: async () => null }, loginLimit: noLimit, sessions: fakeSessions, tokens: fakeTokens, verify });

    expect(await codeOf(service.login({ email: 'nobody@team.test', password: PASSWORD, ip: IP, platform: 'other' }))).toBe('INVALID_CREDENTIALS');
    expect(verify).toHaveBeenCalledTimes(1);
    const [hashUsed] = verify.mock.calls[0] ?? [];
    expect(hashUsed?.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    // The dummy hash really is a hash: the check took the full argon2 path, not a shortcut.
    expect(await verifyPassword(hashUsed ?? '', PASSWORD)).toBe(false);
  });
});
