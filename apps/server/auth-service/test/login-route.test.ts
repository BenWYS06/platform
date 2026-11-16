// Route: POST /api/auth/login with a fake service (spec 009 B9; plan 009b Task 4). Body checks,
// client IP, readiness gate, one service call.
import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import type { LoginService } from '../src/services/login.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';

const USER = { id: 'u1', email: 'boss@team.test', displayName: 'Boss', role: 'Owner' as const };
const PASSWORD = 'a long enough password';

function setup(config: Partial<Pick<Config, 'trustProxy' | 'clientIpHeader'>> = {}, ready = true) {
  const login = vi.fn<LoginService['login']>(async () => ({ accessToken: 'a', refreshToken: 'r', user: USER }));
  const service: LoginService = { login };
  const app = createApp({
    config: { internalApiKey: 'k', ...config },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => ready },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login: service,
  });
  return { app, login };
}

// An email of exactly `length` characters with a valid shape (labels of at most 63).
function emailOfLength(length: number): string {
  const head = `boss@${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.`;
  return `${head}${'d'.repeat(length - head.length - 4)}.com`;
}

describe('POST /api/auth/login', () => {
  it('answers 200 with the user and passes the trimmed, lower-case email and the password as typed', async () => {
    const { app, login } = setup();
    const res = await request(app).post('/api/auth/login').send({ email: '  Boss@Team.TEST ', password: ` ${PASSWORD} ` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: 'a', refreshToken: 'r', user: USER });
    expect(login).toHaveBeenCalledTimes(1);
    expect(login.mock.calls[0]?.[0]).toMatchObject({ email: 'boss@team.test', password: ` ${PASSWORD} ` });
  });

  it('takes the client IP from CLIENT_IP_HEADER through clientIp, not req.ip', async () => {
    const { app, login } = setup({ clientIpHeader: 'cf-connecting-ip' });
    await request(app).post('/api/auth/login').set('CF-Connecting-IP', '203.0.113.10').send({ email: USER.email, password: PASSWORD });
    expect(login.mock.calls[0]?.[0].ip).toBe('203.0.113.10');
  });

  it('accepts a 254-character email and refuses a 255-character one', async () => {
    const { app, login } = setup();
    expect((await request(app).post('/api/auth/login').send({ email: emailOfLength(254), password: PASSWORD })).status).toBe(200);
    expectError(await request(app).post('/api/auth/login').send({ email: emailOfLength(255), password: PASSWORD }), 'VALIDATION_FAILED');
    expect(login).toHaveBeenCalledTimes(1);
  });

  for (const [name, body] of [
    ['a bad email', { email: 'not-an-email', password: PASSWORD }],
    ['a missing email', { password: PASSWORD }],
    ['a missing password', { email: USER.email }],
    ['an unknown field', { email: USER.email, password: PASSWORD, role: 'Owner' }],
    ['a short password', { email: USER.email, password: 'short' }],
    ['a 129-character password', { email: USER.email, password: 'p'.repeat(129) }],
    ['a number as email', { email: 42, password: PASSWORD }],
  ] as const) {
    it(`answers 400 VALIDATION_FAILED for ${name}, without a service call`, async () => {
      const { app, login } = setup();
      expectError(await request(app).post('/api/auth/login').send(body), 'VALIDATION_FAILED');
      expect(login).not.toHaveBeenCalled();
    });
  }

  it('answers 503 SERVICE_UNAVAILABLE before the indexes exist, without a service call', async () => {
    const { app, login } = setup({}, false);
    expectError(await request(app).post('/api/auth/login').send({ email: USER.email, password: PASSWORD }), 'SERVICE_UNAVAILABLE');
    expect(login).not.toHaveBeenCalled();
  });
});
