// Integration: the refresh service against a real Redis and MongoDB (spec 012 B1 to B4, B11,
// B12; plan 012b Task 5; Done when 2, 4 to 9, 11 per session, 16).
import { Writable } from 'node:stream';
import type { Connection } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/logger.js';
import { userModel } from '../src/modules/users/user.model.js';
import { StoreUnavailableError } from '../src/common/storeErrors.js';
import { createFailureCounter } from '../src/common/failureCounter.js';
import { createSessionStore, sessionKey } from '../src/modules/auth/session/session.repository.js';
import { createMongo, createRedis, type Mongo, type Redis, type RedisClient } from '../src/infra/stores.js';
import { createUsersRepository } from '../src/modules/users/users.repository.js';
import { createRefreshService, REFRESH_KEY_PREFIX, REFRESH_WINDOW_SECONDS } from '../src/services/refresh.js';
import { createSessionRevoker, SESSIONS_REVOKED_CHANNEL, type SessionRevokerDeps } from '../src/modules/auth/session/sessionRevoker.service.js';
import { createSessionTokens, newRefreshToken, newSid } from '../src/modules/auth/session/sessionTokens.service.js';
import { hashToken } from '../src/common/secretToken.js';
import { freePort, START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

const TTL = 2592000;
const tokens = createSessionTokens({ jwtAccessSecret: 'test-access-secret-of-32-characters!', jwtAccessTtlSeconds: 900 });
const silent = createLogger(new Writable({ write: (_c, _e, done) => done() }));
const throwingPublisher = { publish: async () => Promise.reject(new Error('redis down')) };
const MARKER = 'marker';

let mongo: TestMongo;
let mongoClient: Mongo;
let redisServer: TestRedis;
let redis: Redis;
let subscriber: RedisClient;
let events: { userId: string; sid?: string; reason?: string }[] = [];

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

// Pub/sub keeps order on one channel: once the marker arrives, every earlier event has too.
async function eventsFor(userId: string) {
  await redis.client.publish(SESSIONS_REVOKED_CHANNEL, JSON.stringify({ userId: MARKER }));
  await waitFor(() => events.some((e) => e.userId === MARKER));
  events = events.filter((e) => e.userId !== MARKER);
  return events.filter((e) => e.userId === userId);
}

async function setup(publisher: SessionRevokerDeps['publisher'] = redis.client, db?: Connection) {
  const conn = db ?? mongoClient.connection.useDb(uniqueDbName(), { useCache: false });
  const users = createUsersRepository(conn);
  const user = await users.insert({ email: 'boss@team.test', displayName: 'Boss', role: 'Owner', passwordHash: '$argon2id$fake' });
  const sessions = createSessionStore(redis.client, TTL);
  const counter = createFailureCounter(redis.client, REFRESH_KEY_PREFIX, REFRESH_WINDOW_SECONDS);
  const revoker = createSessionRevoker({ sessions, publisher, logger: silent });
  const service = createRefreshService({ users, sessions, counter, revoker, tokens });
  const sid = newSid();
  const token = newRefreshToken(sid);
  await sessions.create({ sid, userId: user.id, method: 'password', platform: 'web', deviceId: '', refreshHash: hashToken(token) });
  const block = () => userModel(conn).updateOne({ _id: user.id }, { $set: { status: 'blocked' } });
  return { conn, users, sessions, counter, revoker, service, user, sid, token, block };
}

const fields = (sid: string) => redis.client.hGetAll(sessionKey(sid));
const rotation = async (sid: string) => {
  const { refreshHash, prevRefreshHash, rotatedAt } = await fields(sid);
  return { refreshHash, prevRefreshHash, rotatedAt };
};
const rejectsWith = (p: Promise<unknown>, code: string) => expect(p).rejects.toMatchObject({ code });

describe('refresh service', () => {
  it('rotates and signs with the claimsVersion of the session, also after markClaimsStale', async () => {
    const { service, revoker, user, sid, token } = await setup();
    const first = await service.refresh(token);
    expect(first.refreshToken).not.toBe(token);
    expect(first.user).toEqual({ id: user.id, email: 'boss@team.test', displayName: 'Boss', role: 'Owner' });
    expect(tokens.verifyAccess(first.accessToken)).toMatchObject({ sub: user.id, sid, cv: 1 });

    await revoker.markClaimsStale(user.id);
    const second = await service.refresh(first.refreshToken);
    expect(tokens.verifyAccess(second.accessToken)?.cv).toBe(2);
  });

  it('answers reuse, publishes once, and refuses the next refresh', async () => {
    const { service, user, sid, token } = await setup();
    const { refreshToken } = await service.refresh(token);

    await rejectsWith(service.refresh(token), 'REFRESH_TOKEN_REUSE');
    expect(await eventsFor(user.id)).toEqual([{ userId: user.id, sid, reason: 'refresh_reuse' }]);
    await rejectsWith(service.refresh(refreshToken), 'SESSION_REVOKED');
  });

  it('answers a forged secret with REFRESH_TOKEN_INVALID and keeps the session live', async () => {
    const { service, sid, token } = await setup();
    await rejectsWith(service.refresh(newRefreshToken(sid)), 'REFRESH_TOKEN_INVALID');
    expect((await fields(sid)).revoked).toBe('0');
    await expect(service.refresh(token)).resolves.toBeDefined();
  });

  it('refuses a malformed or missing token before any Redis call', async () => {
    const { service, sessions, counter } = await setup();
    const readUserId = vi.spyOn(sessions, 'readUserId');
    const get = vi.spyOn(counter, 'get');
    for (const bad of [undefined, '', 'short.token', `${newSid()}.${'x'.repeat(42)}!`]) {
      await rejectsWith(service.refresh(bad), 'REFRESH_TOKEN_INVALID');
    }
    expect(readUserId).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('answers a well-formed unknown sid with 401, no counter key and no MongoDB call', async () => {
    const { service, users } = await setup();
    const findById = vi.spyOn(users, 'findById');
    const sid = newSid();
    await rejectsWith(service.refresh(newRefreshToken(sid)), 'REFRESH_TOKEN_INVALID');
    expect(await redis.client.exists(REFRESH_KEY_PREFIX + sid)).toBe(0);
    expect(findById).not.toHaveBeenCalled();
  });

  it('revokes a blocked user once with 403, then answers the same token ACCOUNT_BLOCKED', async () => {
    const { service, user, sid, token, block } = await setup();
    await block();

    await rejectsWith(service.refresh(token), 'ACCOUNT_BLOCKED');
    expect(await fields(sid)).toMatchObject({ revoked: '1', revokedReason: 'blocked' });
    await rejectsWith(service.refresh(token), 'ACCOUNT_BLOCKED');
    expect(await eventsFor(user.id)).toEqual([{ userId: user.id, sid, reason: 'blocked' }]);
  });

  it('keeps the reuse and blocked answers when publish throws', async () => {
    const reuse = await setup(throwingPublisher);
    await reuse.service.refresh(reuse.token);
    await rejectsWith(reuse.service.refresh(reuse.token), 'REFRESH_TOKEN_REUSE');

    const blocked = await setup(throwingPublisher);
    await blocked.block();
    await rejectsWith(blocked.service.refresh(blocked.token), 'ACCOUNT_BLOCKED');
  });

  it('answers a deleted user with REFRESH_TOKEN_INVALID and rotates nothing', async () => {
    const { service, conn, user, sid, token } = await setup();
    const before = await rotation(sid);
    await userModel(conn).deleteOne({ _id: user.id });
    await rejectsWith(service.refresh(token), 'REFRESH_TOKEN_INVALID');
    expect(await rotation(sid)).toEqual(before);
  });

  it('answers the 11th refresh of one session in a minute with RATE_LIMITED', async () => {
    const { service, token } = await setup();
    let current = token;
    for (let i = 0; i < 10; i++) current = (await service.refresh(current)).refreshToken;
    const err = await service.refresh(current).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'RATE_LIMITED', params: { retryAfterSeconds: expect.any(Number) } });
    expect((err as { params: { retryAfterSeconds: number } }).params.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('answers 503 with nothing rotated while MongoDB is down, then rotates the same token', async () => {
    const port = await freePort();
    let own = await startMongo(port);
    const client = createMongo(`mongodb://127.0.0.1:${port}/?directConnection=true`, uniqueDbName(), 500);
    try {
      await client.connect();
      const { service, user, sid, token } = await setup(redis.client, client.connection);
      const before = await rotation(sid);

      await own.stop();
      await expect(service.refresh(token)).rejects.toBeInstanceOf(StoreUnavailableError);
      expect(await rotation(sid)).toEqual(before);

      // A new container has no data: put the same user back under the same id.
      own = await startMongo(port);
      await vi.waitFor(() => client.ping(), { timeout: 30_000, interval: 200 });
      await userModel(client.connection).create({ _id: user.id, email: user.email, displayName: user.displayName, role: user.role, passwordHash: user.passwordHash });
      await expect(service.refresh(token)).resolves.toMatchObject({ user: { id: user.id } });
    } finally {
      await client.close();
      await own.stop();
    }
  }, START_TIMEOUT_MS);
});
