// Integration: GET /api/auth/session and GET /api/auth/me against a real MongoDB and Redis
// (spec 012 A5, A6, A16, A17; plan 012a Task 7, C5; Done when 6, 7, 8, 9).
import { Writable } from 'node:stream';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { createSessionStore, SESSION_FIELD, sessionKey } from '../src/modules/auth/session/session.repository.js';
import { createMongo, createRedis, type Mongo, type Redis, type RedisClient } from '../src/infra/stores.js';
import { createUsersRepository } from '../src/modules/users/users.repository.js';
import { createSessionService } from '../src/services/session.js';
import { createSessionCheck } from '../src/modules/auth/session/sessionCheck.service.js';
import { createSessionTokens, newSid } from '../src/modules/auth/session/sessionTokens.service.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations, unusedLogin } from './helpers/invitations.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

const SECRET = 'test-access-secret-of-32-characters!';
const tokens = createSessionTokens({ jwtAccessSecret: SECRET, jwtAccessTtlSeconds: 900 });
const EMAIL = 'boss@team.test';

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

// A fresh database with one user, a stored session for that user and its access token.
async function setup(redisClient: RedisClient = redis.client) {
  const users = createUsersRepository(mongoClient.connection.useDb(uniqueDbName(), { useCache: false }));
  await users.ensureIndexes();
  const user = await users.insert({ email: EMAIL, displayName: 'Boss', role: 'Owner', passwordHash: 'x' });
  const sessions = createSessionStore(redisClient, 2592000);
  const sid = newSid();
  await sessions.create({ sid, userId: user.id, method: 'password', platform: 'web', deviceId: '', refreshHash: 'a'.repeat(64) });
  const claims = { sub: user.id, sid, role: 'Owner' as const, perms: [], depts: [], cv: 1 };
  const app = createApp({
    config: { internalApiKey: 'k' },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login: unusedLogin,
    session: createSessionService(createSessionCheck(tokens, sessions), users),
  });
  const me = (headers: Record<string, string>) => request(app).get('/api/auth/me').set(headers);
  const session = (cookie?: string) => {
    const req = request(app).get('/api/auth/session');
    return cookie === undefined ? req : req.set('Cookie', `accessToken=${cookie}`);
  };
  return { user, sid, claims, token: tokens.signAccess(claims), me, session };
}

const userBody = (id: string) => ({ id, email: EMAIL, displayName: 'Boss', role: 'Owner' });

describe('GET /api/auth/me', () => {
  it('answers a Bearer token with 200 { user } and perms []', async () => {
    const { user, token, me } = await setup();
    const res = await me({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: { ...userBody(user.id), perms: [] } });
  });

  it('answers the access cookie alone with 401 UNAUTHENTICATED', async () => {
    const { token, me } = await setup();
    expectError(await me({ Cookie: `accessToken=${token}` }), 'UNAUTHENTICATED');
  });

  it('answers 401 UNAUTHENTICATED for a user missing from MongoDB', async () => {
    const { claims, me } = await setup();
    const sid = newSid();
    const sub = '0123456789abcdef01234567';
    await createSessionStore(redis.client, 2592000).create({ sid, userId: sub, method: 'password', platform: 'other', deviceId: '', refreshHash: 'b'.repeat(64) });
    expectError(await me({ Authorization: `Bearer ${tokens.signAccess({ ...claims, sub, sid })}` }), 'UNAUTHENTICATED');
  });
});

describe('GET /api/auth/session', () => {
  it('answers a valid cookie with 200 and the same token, without touching the session', async () => {
    const { user, sid, token, session } = await setup();
    const before = await redis.client.hGetAll(sessionKey(sid));
    const res = await session(token);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accessToken: token, user: userBody(user.id) });
    expect(await redis.client.hGetAll(sessionKey(sid))).toEqual(before);
  });

  it('answers no cookie, an expired, a revoked and a stale session with their 401 codes', async () => {
    const { sid, claims, token, session } = await setup();
    const now = Math.floor(Date.now() / 1000);
    expectError(await session(), 'UNAUTHENTICATED');
    expectError(await session(jwt.sign({ ...claims, iat: now - 1000, exp: now - 10 }, SECRET, { algorithm: 'HS256' })), 'UNAUTHENTICATED');

    await redis.client.hSet(sessionKey(sid), SESSION_FIELD.CLAIMS_VERSION, '2');
    expectError(await session(token), 'TOKEN_CLAIMS_STALE');
    await redis.client.hSet(sessionKey(sid), SESSION_FIELD.REVOKED, '1');
    expectError(await session(token), 'SESSION_REVOKED');
  });
});

describe('Redis down', () => {
  it(
    'answers 503 SERVICE_UNAVAILABLE on /me and /session',
    async () => {
      const down = await startRedis();
      const own = createRedis(down.url);
      try {
        await waitFor(() => own.client.isReady);
        const { token, me, session } = await setup(own.client);
        await down.stop();
        await waitFor(() => !own.client.isReady);
        expectError(await me({ Authorization: `Bearer ${token}` }), 'SERVICE_UNAVAILABLE');
        expectError(await session(token), 'SERVICE_UNAVAILABLE');
      } finally {
        await own.close();
      }
    },
    START_TIMEOUT_MS,
  );
});
