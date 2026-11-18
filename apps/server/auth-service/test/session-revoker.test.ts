// Integration: revoke helpers change Redis, then publish (spec 012 B8; plan 012b Task 3; Done
// when 12). A second client subscribes to both channels.
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { createSessionStore, sessionKey } from '../src/repositories/sessions.js';
import { createRedis, type Redis, type RedisClient } from '../src/repositories/stores.js';
import {
  CLAIMS_CHANGED_CHANNEL,
  createSessionRevoker,
  SESSIONS_REVOKED_CHANNEL,
  type SessionRevokerDeps,
} from '../src/services/sessionRevoker.js';
import { newSid } from '../src/services/sessionTokens.js';
import { START_TIMEOUT_MS } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

let server: TestRedis;
let redis: Redis;
let subscriber: RedisClient;
let events: { channel: string; payload: unknown }[] = [];

beforeAll(async () => {
  server = await startRedis();
  redis = createRedis(server.url);
  await waitFor(() => redis.client.isReady);
  subscriber = redis.client.duplicate();
  await subscriber.connect();
  for (const channel of [SESSIONS_REVOKED_CHANNEL, CLAIMS_CHANGED_CHANNEL]) {
    await subscriber.subscribe(channel, (message) => {
      events.push({ channel, payload: JSON.parse(message) });
    });
  }
}, START_TIMEOUT_MS);

afterAll(async () => {
  await subscriber?.close();
  await redis?.close();
  await server?.stop();
}, START_TIMEOUT_MS);

beforeEach(() => {
  events = [];
});

const store = () => createSessionStore(redis.client, 2592000);

function setup(publisher: SessionRevokerDeps['publisher'] = redis.client) {
  const logs: string[] = [];
  const logger = createLogger(
    new Writable({
      write: (c, _e, done) => {
        logs.push(...String(c).split('\n').filter(Boolean));
        done();
      },
    }),
  );
  return { logs, revoker: createSessionRevoker({ sessions: store(), publisher, logger }) };
}

async function createFor(userId: string): Promise<string> {
  return store().create({
    sid: newSid(),
    userId,
    method: 'password',
    platform: 'web',
    deviceId: '',
    refreshHash: 'a'.repeat(64),
  });
}

const fields = (sid: string) => redis.client.hGetAll(sessionKey(sid));
const eventsOf = (userId: string) =>
  events.filter((e) => (e.payload as { userId: string }).userId === userId);

describe('session revoker', () => {
  it('revokes, then publishes each event with its payload', async () => {
    const { revoker } = setup();
    const userId = randomUUID();
    const one = await createFor(userId);
    await createFor(userId);

    expect(await revoker.revokeSession(one, 'logout')).toBe(true);
    expect((await fields(one)).revokedReason).toBe('logout');
    expect(await revoker.revokeSession(one, 'logout')).toBe(false);
    expect(await revoker.revokeAllSessions(userId, 'blocked')).toBe(1);
    await revoker.markClaimsStale(userId);

    await waitFor(() => eventsOf(userId).length >= 3);
    expect(eventsOf(userId)).toEqual([
      { channel: SESSIONS_REVOKED_CHANNEL, payload: { userId, sid: one, reason: 'logout' } },
      { channel: SESSIONS_REVOKED_CHANNEL, payload: { userId, reason: 'blocked' } },
      { channel: CLAIMS_CHANGED_CHANNEL, payload: { userId } },
    ]);
  });

  it('announces a revoke without changing Redis', async () => {
    const { revoker } = setup();
    const userId = randomUUID();
    const sid = await createFor(userId);
    const before = await fields(sid);

    await revoker.announceRevoked({ userId, sid, reason: 'refresh_reuse' });

    await waitFor(() => eventsOf(userId).length === 1);
    expect(eventsOf(userId)[0]).toEqual({
      channel: SESSIONS_REVOKED_CHANNEL,
      payload: { userId, sid, reason: 'refresh_reuse' },
    });
    expect(await fields(sid)).toEqual(before);
  });

  it('keeps the change and logs one warn line when publish fails', async () => {
    const { revoker, logs } = setup({
      publish: async () => {
        throw new Error('publish down');
      },
    });
    const userId = randomUUID();
    const sid = await createFor(userId);

    await expect(revoker.revokeSession(sid, 'logout')).resolves.toBe(true);
    expect((await fields(sid)).revoked).toBe('1');
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0] ?? '{}')).toMatchObject({ level: 40, channel: SESSIONS_REVOKED_CHANNEL });
  });
});
