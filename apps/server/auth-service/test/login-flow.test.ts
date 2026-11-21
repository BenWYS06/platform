// Integration: POST /api/auth/login against a real MongoDB and Redis (spec 009 Done when 2, 3,
// 4, 6, 7, 9, 11, 12; plan 009b Task 4; spec 012 Done when 2, 3, 4, plan 012a Task 5).
import { createHash, randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { Connection } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { userModel } from '../src/modules/users/user.model.js';
import { createFailureCounter } from '../src/common/failureCounter.js';
import { createSessionStore, SESSION_FIELD, sessionKey, userSessionsKey } from '../src/modules/auth/session/session.repository.js';
import { createMongo, createRedis, type Mongo, type Redis, type RedisClient } from '../src/infra/stores.js';
import { createUsersRepository } from '../src/modules/users/users.repository.js';
import { startLoginService } from '../src/modules/auth/login.service.js';
import { createLoginLimit, LOGIN_WINDOW_SECONDS } from '../src/modules/auth/loginLimit.service.js';
import { hashPassword } from '../src/modules/users/password.util.js';
import { createSessionTokens } from '../src/modules/auth/session/sessionTokens.service.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

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

const PASSWORD = 'correct horse battery';
const WRONG = 'wrong horse battery';
const EMAIL = 'boss@team.test';
const RETRY = { retryAfterSeconds: expect.any(Number) as unknown as number };
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const ACCESS_TTL = 900;
const REFRESH_TTL = 2592000;
const tokens = createSessionTokens({ jwtAccessSecret: 'test-access-secret-of-32-characters!', jwtAccessTtlSeconds: ACCESS_TTL });

// C4: no repository method blocks a user until 1.5; tests set it through the model.
async function block(db: Connection, email: string): Promise<void> {
  await userModel(db).updateOne({ email }, { $set: { status: 'blocked' } });
}

// A fresh database and Redis key prefix; X-Forwarded-For picks the client IP (TRUST_PROXY=1).
// sessionClient lets a test stop the session Redis while the failure counters keep working.
async function setup(redisClient: RedisClient = redis.client, sessionClient: RedisClient = redisClient) {
  const db = mongoClient.connection.useDb(uniqueDbName(), { useCache: false });
  const users = createUsersRepository(db);
  await users.ensureIndexes();
  await users.insert({ email: EMAIL, displayName: 'Boss', role: 'Owner', passwordHash: await hashPassword(PASSWORD) });
  const prefix = `test:${randomUUID()}:`;
  const login = await startLoginService({
    users,
    loginLimit: createLoginLimit(createFailureCounter(redisClient, prefix, LOGIN_WINDOW_SECONDS)),
    sessions: createSessionStore(sessionClient, REFRESH_TTL),
    tokens,
  });
  const app = createApp({
    config: { internalApiKey: 'k', trustProxy: 1, jwtAccessTtlSeconds: ACCESS_TTL, refreshTtlSeconds: REFRESH_TTL },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login,
  });
  const post = (email: string, password: string, ip = '203.0.113.1', client?: string) => {
    const req = request(app).post('/api/auth/login').set('X-Forwarded-For', ip);
    return (client ? req.set('X-Client', client) : req).send({ email, password });
  };
  const emailCount = async (email: string) => Number((await redis.client.get(`${prefix}email:${sha256(email)}`)) ?? 0);
  const userId = (await users.findByEmail(EMAIL))?.id ?? '';
  // The user's session set: empty when no session was created.
  const sessionIds = () => redis.client.sMembers(userSessionsKey(userId));
  return { db, post, emailCount, userId, sessionIds };
}

// Every 429: contract body, Retry-After equal to params.retryAfterSeconds (B5).
function expect429(res: request.Response): void {
  expectError(res, 'RATE_LIMITED', RETRY);
  expect(res.body.params.retryAfterSeconds).toBeGreaterThan(0);
  expect(res.headers['retry-after']).toBe(String(res.body.params.retryAfterSeconds));
}

describe('login flow', () => {
  it('answers the right password with 200 { user } and no passwordHash', async () => {
    const { post } = await setup();
    const res = await post(EMAIL, PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ id: expect.any(String), email: EMAIL, displayName: 'Boss', role: 'Owner' });
    expect(res.text).not.toContain('passwordHash');
    expect(res.text).not.toContain('argon2');
  });

  it('gives a wrong password and an unknown email byte-identical 401 bodies', async () => {
    const { post } = await setup();
    const wrong = await post(EMAIL, WRONG);
    const unknown = await post('nobody@team.test', PASSWORD);
    expectError(wrong, 'INVALID_CREDENTIALS');
    expectError(unknown, 'INVALID_CREDENTIALS');
    expect(unknown.text).toBe(wrong.text);
    expect(unknown.headers['content-type']).toBe(wrong.headers['content-type']);
  });

  it('answers the 6th login for an unknown email with 429 after 5 failures', async () => {
    const { post } = await setup();
    for (let i = 0; i < 5; i++) expectError(await post('nobody@team.test', PASSWORD, `198.51.100.${i}`), 'INVALID_CREDENTIALS');
    expect429(await post('nobody@team.test', PASSWORD, '198.51.100.9'));
  });

  it('answers even the right password with 429 after 5 failures for a real user', async () => {
    const { post } = await setup();
    for (let i = 0; i < 5; i++) expectError(await post(EMAIL, WRONG), 'INVALID_CREDENTIALS');
    expect429(await post(EMAIL, PASSWORD));
    expect429(await post(' BOSS@team.test ', PASSWORD, '198.51.100.20'));
  });

  it('answers the 21st login from one IP with 429 after 20 failures across emails', async () => {
    const { post } = await setup();
    for (let i = 0; i < 20; i++) expectError(await post(`user${i}@team.test`, PASSWORD), 'INVALID_CREDENTIALS');
    expect429(await post('new@team.test', PASSWORD));
    expect429(await post(EMAIL, PASSWORD));
    // Another IP is not limited.
    expect((await post(EMAIL, PASSWORD, '203.0.113.2')).status).toBe(200);
  });

  // 30 real argon2 verifications in a row: past the 5 s default when all test files run at once.
  it('answers 30 successful logins from one IP all with 200', { timeout: 20_000 }, async () => {
    const { post } = await setup();
    for (let i = 0; i < 30; i++) expect((await post(EMAIL, PASSWORD)).status).toBe(200);
  });

  it('clears the email counter on success', async () => {
    const { post, emailCount } = await setup();
    for (let i = 0; i < 4; i++) await post(EMAIL, WRONG);
    expect(await emailCount(EMAIL)).toBe(4);
    expect((await post(EMAIL, PASSWORD)).status).toBe(200);
    expect(await emailCount(EMAIL)).toBe(0);
  });

  it('answers a blocked user: wrong password 401 counted, right password 403 with the counter gone', async () => {
    const { db, post, emailCount } = await setup();
    await block(db, EMAIL);
    expectError(await post(EMAIL, WRONG), 'INVALID_CREDENTIALS');
    expectError(await post(EMAIL, WRONG), 'INVALID_CREDENTIALS');
    expect(await emailCount(EMAIL)).toBe(2);

    expectError(await post(EMAIL, PASSWORD), 'ACCOUNT_BLOCKED');
    expect(await emailCount(EMAIL)).toBe(0);
  });
});

describe('login answers tokens', () => {
  const sidOf = (refreshToken: string) => refreshToken.split('.')[0] ?? '';

  it('web login: 200 { accessToken, user } and both cookies with the right flags and max ages', async () => {
    const { post, userId, sessionIds } = await setup();
    const res = await post(EMAIL, PASSWORD, '203.0.113.1', 'web');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: expect.any(String), user: { id: userId, email: EMAIL, displayName: 'Boss', role: 'Owner' } });

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    const access = cookies.find((c) => c.startsWith('accessToken='));
    const refresh = cookies.find((c) => c.startsWith('refreshToken='));
    for (const cookie of [access, refresh]) {
      for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/api/auth']) expect(cookie).toContain(flag);
    }
    expect(access).toContain(`accessToken=${res.body.accessToken};`);
    expect(access).toContain(`Max-Age=${ACCESS_TTL}`);
    expect(refresh).toContain(`Max-Age=${REFRESH_TTL}`);

    const refreshToken = decodeURIComponent(refresh?.split(';')[0]?.slice('refreshToken='.length) ?? '');
    const sid = sidOf(refreshToken);
    expect(await sessionIds()).toEqual([sid]);
    expect(await redis.client.hGet(sessionKey(sid), SESSION_FIELD.PLATFORM)).toBe('web');
    expect(tokens.verifyAccess(res.body.accessToken)).toMatchObject({ sub: userId, sid, role: 'Owner', perms: [], depts: [], cv: 1 });
  });

  it('login without X-Client: web sets no cookie and returns the refresh token', async () => {
    for (const client of [undefined, 'android']) {
      const { post, sessionIds } = await setup();
      const res = await post(EMAIL, PASSWORD, '203.0.113.1', client);
      expect(res.status).toBe(200);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(res.body).toEqual({ accessToken: expect.any(String), refreshToken: expect.any(String), user: expect.any(Object) });
      const sid = sidOf(res.body.refreshToken);
      expect(await sessionIds()).toEqual([sid]);
      expect(await redis.client.hGet(sessionKey(sid), SESSION_FIELD.PLATFORM)).toBe('other');
    }
  });

  it('a wrong password, a locked email and a blocked user create no session and no cookie', async () => {
    const { post, sessionIds } = await setup();
    const wrong = await post(EMAIL, WRONG, '203.0.113.1', 'web');
    expectError(wrong, 'INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
    for (let i = 0; i < 4; i++) await post(EMAIL, WRONG);
    const locked = await post(EMAIL, PASSWORD, '203.0.113.1', 'web');
    expect429(locked);
    expect(locked.headers['set-cookie']).toBeUndefined();
    expect(await sessionIds()).toEqual([]);

    const other = await setup();
    await block(other.db, EMAIL);
    const blocked = await other.post(EMAIL, PASSWORD, '203.0.113.1', 'web');
    expectError(blocked, 'ACCOUNT_BLOCKED');
    expect(blocked.headers['set-cookie']).toBeUndefined();
    expect(await other.sessionIds()).toEqual([]);
  });

  it('answers 503 with no cookie when the session Redis is down after the user check', async () => {
    const down = await startRedis();
    const own = createRedis(down.url);
    try {
      await waitFor(() => own.client.isReady);
      const { post } = await setup(redis.client, own.client);
      await down.stop();
      await waitFor(() => !own.client.isReady);
      const res = await post(EMAIL, PASSWORD, '203.0.113.1', 'web');
      expectError(res, 'SERVICE_UNAVAILABLE');
      expect(res.headers['set-cookie']).toBeUndefined();
    } finally {
      await own.close();
    }
  }, START_TIMEOUT_MS);
});

describe('login with Redis down', () => {
  it('answers 503 SERVICE_UNAVAILABLE', async () => {
    const down = await startRedis();
    const own = createRedis(down.url);
    try {
      await waitFor(() => own.client.isReady);
      const { post } = await setup(own.client);
      expect((await post(EMAIL, PASSWORD)).status).toBe(200);

      await down.stop();
      await waitFor(() => !own.client.isReady);
      expectError(await post(EMAIL, PASSWORD), 'SERVICE_UNAVAILABLE');
      expectError(await post(EMAIL, WRONG), 'SERVICE_UNAVAILABLE');
      expectError(await post('nobody@team.test', PASSWORD), 'SERVICE_UNAVAILABLE');
    } finally {
      await own.close();
    }
  }, START_TIMEOUT_MS);
});
