// Core flow: the burst limit and the security headers on the app as server.ts builds it
// (spec 009 B3, B11, B13; plan 009b Task 5, C5; Done when 8, 15).
import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createAppWithLimits } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import type { LoginService } from '../src/services/login.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';

const login: LoginService = {
  login: async ({ email }) => ({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1', email, displayName: 'Boss', role: 'Owner' } }),
};
const BODY = { email: 'boss@team.test', password: 'a long enough password' };

function app() {
  return createAppWithLimits({
    config: { internalApiKey: 'k' },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login,
  });
}

describe('burst limit and security headers', () => {
  it('answers the 6th login within one second with 429 and Retry-After: 1', async () => {
    const server = app();
    for (let i = 0; i < 5; i++) expect((await request(server).post('/api/auth/login').send(BODY)).status).toBe(200);

    const res = await request(server).post('/api/auth/login').send(BODY);
    expectError(res, 'RATE_LIMITED', { retryAfterSeconds: 1 });
    expect(res.headers['retry-after']).toBe('1');
  });

  it('never limits health', async () => {
    const server = app();
    for (let i = 0; i < 20; i++) expect((await request(server).get('/api/auth/health')).status).toBe(200);
  });

  it('sends the security headers on a login answer', async () => {
    const res = await request(app()).post('/api/auth/login').send(BODY);
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toBeTruthy();
  });
});
