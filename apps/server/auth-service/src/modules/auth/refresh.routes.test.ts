// Integration: POST /api/auth/refresh on the app as server.ts builds it, against a real Redis and
// MongoDB (spec 012 B7, B10; plan 012b Task 6, D6, D8; Done when 3, 11 burst).
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAppWithLimits } from '../../app.js';
import { createLogger } from '../../logger.js';
import { createFailureCounter } from '../../common/failureCounter.js';
import { createSessionStore } from './session/session.repository.js';
import { createMongo, createRedis, type Mongo, type Redis } from '../../infra/stores.js';
import { createUsersRepository } from '../users/index.js';
import type { LoginService } from './login.service.js';
import { createRefreshService, REFRESH_KEY_PREFIX, REFRESH_WINDOW_SECONDS } from './refresh.service.js';
import { createSessionRevoker } from './session/sessionRevoker.service.js';
import { createSessionTokens, newRefreshToken, newSid } from './session/sessionTokens.service.js';
import { hashToken } from '../../common/secretToken.js';
import { expectError } from '../../../test/helpers/error-body.js';
import { noLimit, unusedInvitations } from '../../../test/helpers/invitations.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from '../../../test/helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from '../../../test/helpers/redis.js';

const tokens = createSessionTokens({ jwtAccessSecret: 'test-access-secret-of-32-characters!', jwtAccessTtlSeconds: 900 });
const silent = createLogger(new Writable({ write: (_c, _e, done) => done() }));
const login: LoginService = {
  login: async ({ email }) => ({ accessToken: 'a', refreshToken: 'r', user: { id: 'u1', email, displayName: 'Boss', role: 'Owner' } }),
};

let mongo: TestMongo;
let mongoClient: Mongo;
let redisServer: TestRedis;
let redis: Redis;

beforeAll(async () => {
  [mongo, redisServer] = await Promise.all([startMongo(), startRedis()]);
  mongoClient = createMongo(mongo.uri, 'unused');
  await mongoClient.connect();
  redis = createRedis(redisServer.url);
  await waitFor(() => redis.client.isReady);
}, START_TIMEOUT_MS);

afterAll(async () => {
  await redis?.close();
  await mongoClient?.close();
  await Promise.all([redisServer?.stop(), mongo?.stop()]);
}, START_TIMEOUT_MS);

// A fresh database with one user and a live session; the app with both burst limits.
async function setup() {
  const users = createUsersRepository(mongoClient.connection.useDb(uniqueDbName(), { useCache: false }));
  const user = await users.insert({ email: 'boss@team.test', displayName: 'Boss', role: 'Owner', passwordHash: '$argon2id$fake' });
  const sessions = createSessionStore(redis.client, 2592000);
  const sid = newSid();
  const token = newRefreshToken(sid);
  await sessions.create({ sid, userId: user.id, method: 'password', platform: 'web', deviceId: '', refreshHash: hashToken(token) });
  const app = createAppWithLimits({
    config: { internalApiKey: 'k' },
    logger: silent,
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login,
    refresh: createRefreshService({
      users,
      sessions,
      counter: createFailureCounter(redis.client, REFRESH_KEY_PREFIX, REFRESH_WINDOW_SECONDS),
      revoker: createSessionRevoker({ sessions, publisher: redis.client, logger: silent }),
      tokens,
    }),
  });
  return { app, user, token };
}

const userBody = (id: string) => ({ id, email: 'boss@team.test', displayName: 'Boss', role: 'Owner' });
const cookieNamed = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));

describe('POST /api/auth/refresh', () => {
  it('answers a web refresh with the cookie: both cookies set again, no refreshToken in the body', async () => {
    const { app, user, token } = await setup();
    const res = await request(app).post('/api/auth/refresh').set('X-Client', 'web').set('Cookie', `refreshToken=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: expect.any(String), user: userBody(user.id) });
    for (const name of ['accessToken', 'refreshToken']) {
      const cookie = cookieNamed(res, name);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Lax/);
    }
    expect(cookieNamed(res, 'refreshToken')).not.toContain(token);
  });

  it('answers a body refresh with the new refreshToken and sets no cookie', async () => {
    const { app, user, token } = await setup();
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: token });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String), user: userBody(user.id) });
    expect(res.body.refreshToken).not.toBe(token);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('answers an unknown body field with 400 and no token with 401 REFRESH_TOKEN_INVALID', async () => {
    const { app, token } = await setup();
    expectError(await request(app).post('/api/auth/refresh').send({ refreshToken: token, sid: 'x' }), 'VALIDATION_FAILED');
    expectError(await request(app).post('/api/auth/refresh'), 'REFRESH_TOKEN_INVALID');
  });

  it('answers the 101st refresh within a second from one IP with 429, while login keeps its burst of 5', async () => {
    // Freeze the clock before the limiters are built: their memory store resets a count only
    // when Date.now() passes the window, and drops idle clients on a setInterval tick. Frozen,
    // all 101 requests count in one window however slow the machine is (no real-time race).
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const { app } = await setup();
    const server = http.createServer(app).listen(0);
    try {
      const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const first = await Promise.all(Array.from({ length: 100 }, () => request(url).post('/api/auth/refresh').send({ refreshToken: 'bad' })));
      expect(first.every((r) => r.status === 401)).toBe(true);
      const over = await request(url).post('/api/auth/refresh').send({ refreshToken: 'bad' });
      expectError(over, 'RATE_LIMITED', { retryAfterSeconds: 1 });
      expect(over.headers['retry-after']).toBe('1');

      const body = { email: 'boss@team.test', password: 'a long enough password' };
      for (let i = 0; i < 5; i++) expect((await request(url).post('/api/auth/login').send(body)).status).toBe(200);
      expectError(await request(url).post('/api/auth/login').send(body), 'RATE_LIMITED', { retryAfterSeconds: 1 });
    } finally {
      server.close();
      vi.useRealTimers();
    }
  });
});
