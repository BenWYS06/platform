// Integration: POST /api/auth/logout against a real MongoDB and Redis (spec 012 B6, B13; plan
// 012b Task 7, D4, D9; Done when 10). A second Redis client subscribes to the revoke channel.
import { Writable } from 'node:stream';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { createSessionStore, SESSION_FIELD, sessionKey } from '../src/repositories/sessions.js';
import { createMongo, createRedis, type Mongo, type Redis, type RedisClient } from '../src/repositories/stores.js';
import { createUsersRepository } from '../src/repositories/users.js';
import { createLogoutService } from '../src/services/logout.js';
import { createSessionService } from '../src/services/session.js';
import { createSessionCheck } from '../src/services/sessionCheck.js';
import { createSessionRevoker, SESSIONS_REVOKED_CHANNEL } from '../src/services/sessionRevoker.js';
import { createSessionTokens, newSid } from '../src/services/sessionTokens.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations, unusedLogin } from './helpers/invitations.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

const SECRET = 'test-access-secret-of-32-characters!';
const tokens = createSessionTokens({ jwtAccessSecret: SECRET, jwtAccessTtlSeconds: 900 });
const silent = createLogger(new Writable({ write: (_c, _e, done) => done() }));
const MARKER = 'marker';

let mongo: TestMongo;
let mongoClient: Mongo;
let redisServer: TestRedis;
let redis: Redis;
let subscriber: RedisClient;
let events: { userId: string; sid?: string; reason: string }[] = [];

beforeAll(async () => {
  [mongo, redisServer] = await Promise.all([startMongo(), startRedis()]);
  mongoClient = createMongo(mongo.uri, 'unused');
  await mongoClient.connect();
  redis = createRedis(redisServer.url);
  await waitFor(() => redis.client.isReady);
  subscriber = redis.client.duplicate();
  await subscriber.connect();
  await subscriber.subscribe(SESSIONS_REVOKED_CHANNEL, (message) => {
    events.push(JSON.parse(message));
  });
}, START_TIMEOUT_MS);

afterAll(async () => {
  await subscriber?.close();
  await redis?.close();
  await mongoClient?.close();
  await Promise.all([redisServer?.stop(), mongo?.stop()]);
}, START_TIMEOUT_MS);

beforeEach(() => {
  events = [];
});

// Every event before a marker published now has arrived once the marker arrives (no sleeps).
async function settle(): Promise<void> {
  await redis.client.publish(SESSIONS_REVOKED_CHANNEL, JSON.stringify({ userId: MARKER, reason: MARKER }));
  await waitFor(() => events.some((e) => e.userId === MARKER));
  events = events.filter((e) => e.userId !== MARKER);
}

// A fresh database with two users, one live session each; the app with logout, /me and /session.
async function setup() {
  const users = createUsersRepository(mongoClient.connection.useDb(uniqueDbName(), { useCache: false }));
  await users.ensureIndexes();
  const sessions = createSessionStore(redis.client, 2592000);
  async function userWithSession(email: string) {
    const user = await users.insert({ email, displayName: 'Boss', role: 'Owner', passwordHash: 'x' });
    const sid = newSid();
    await sessions.create({ sid, userId: user.id, method: 'password', platform: 'web', deviceId: '', refreshHash: 'a'.repeat(64) });
    const claims = { sub: user.id, sid, role: 'Owner' as const, perms: [], depts: [], cv: 1 };
    return { user, sid, claims, token: tokens.signAccess(claims) };
  }
  const own = await userWithSession('boss@team.test');
  const other = await userWithSession('other@team.test');
  const app = createApp({
    config: { internalApiKey: 'k' },
    logger: silent,
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: unusedInvitations,
    acceptLimit: noLimit,
    login: unusedLogin,
    session: createSessionService(createSessionCheck(tokens, sessions), users),
    logout: createLogoutService({ tokens, revoker: createSessionRevoker({ sessions, publisher: redis.client, logger: silent }) }),
  });
  const logout = (token?: string) => {
    const req = request(app).post('/api/auth/logout');
    return token === undefined ? req : req.set('Authorization', `Bearer ${token}`);
  };
  return { app, own, other, logout };
}

const fields = (sid: string) => redis.client.hGetAll(sessionKey(sid));
const cookieNamed = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));

describe('POST /api/auth/logout', () => {
  it('answers 204, clears both cookies, revokes only the token session and publishes once', async () => {
    const { app, own, other, logout } = await setup();
    // A body naming another session is never read.
    const res = await logout(own.token).send({ sid: other.sid });
    expect(res.status).toBe(204);
    for (const name of ['accessToken', 'refreshToken']) {
      const cookie = cookieNamed(res, name);
      expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/Secure/);
      expect(cookie).toMatch(/SameSite=Lax/);
    }
    expect(await fields(own.sid)).toMatchObject({ [SESSION_FIELD.REVOKED]: '1', [SESSION_FIELD.REVOKED_REASON]: 'logout' });
    expect((await fields(other.sid))[SESSION_FIELD.REVOKED]).toBe('0');

    expectError(await request(app).get('/api/auth/me').set('Authorization', `Bearer ${own.token}`), 'SESSION_REVOKED');
    expectError(await request(app).get('/api/auth/session').set('Cookie', `accessToken=${own.token}`), 'SESSION_REVOKED');

    expect((await logout(own.token)).status).toBe(204);
    await settle();
    expect(events).toEqual([{ userId: own.user.id, sid: own.sid, reason: 'logout' }]);
  });

  it('answers an expired but correctly signed token with 204 and revokes', async () => {
    const { own, logout } = await setup();
    const now = Math.floor(Date.now() / 1000);
    const expired = jwt.sign({ ...own.claims, iat: now - 1000, exp: now - 10 }, SECRET, { algorithm: 'HS256' });
    expect((await logout(expired)).status).toBe(204);
    expect((await fields(own.sid))[SESSION_FIELD.REVOKED_REASON]).toBe('logout');
  });

  it('answers a wrong signature or no header with 401 UNAUTHENTICATED and revokes nothing', async () => {
    const { own, logout } = await setup();
    const forged = jwt.sign(own.claims, 'another-secret-of-32-characters!!!!', { algorithm: 'HS256', expiresIn: 900 });
    expectError(await logout(forged), 'UNAUTHENTICATED');
    expectError(await logout(), 'UNAUTHENTICATED');
    expect((await fields(own.sid))[SESSION_FIELD.REVOKED]).toBe('0');
    await settle();
    expect(events).toEqual([]);
  });
});
