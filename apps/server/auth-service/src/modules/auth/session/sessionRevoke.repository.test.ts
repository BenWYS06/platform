// Integration: the revoke and claims scripts against a real Redis (spec 012 B8; plan 012b
// Task 2; part of Done when 13).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSessionStore,
  sessionKey,
  userSessionsKey,
} from './session.repository.js';
import { createRedis, type Redis } from '../../../infra/stores.js';
import { newSid } from './sessionTokens.service.js';
import { START_TIMEOUT_MS } from '../../../../test/helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from '../../../../test/helpers/redis.js';

const TTL = 2592000;

let server: TestRedis;
let redis: Redis;

beforeAll(async () => {
  server = await startRedis();
  redis = createRedis(server.url);
  await waitFor(() => redis.client.isReady);
}, START_TIMEOUT_MS);

afterAll(async () => {
  await redis?.close();
  await server?.stop();
}, START_TIMEOUT_MS);

const store = () => createSessionStore(redis.client, TTL);

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

describe('session revoke scripts', () => {
  it('revokes one session once, and never for another user', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);

    expect(await store().revoke(sid, 'logout', randomUUID())).toBe(false);
    expect(await fields(sid)).toMatchObject({ revoked: '0', revokedReason: '' });

    expect(await store().revoke(sid, 'logout', userId)).toBe(true);
    expect(await fields(sid)).toMatchObject({ revoked: '1', revokedReason: 'logout' });
    expect(await store().revoke(sid, 'blocked')).toBe(false);
    expect((await fields(sid)).revokedReason).toBe('logout');
  });

  it('revokes every live session of a user and drops gone sids from the set', async () => {
    const userId = randomUUID();
    const a = await createFor(userId);
    const b = await createFor(userId);
    const gone = await createFor(userId);
    await redis.client.del(sessionKey(gone));

    expect(await store().revokeAllOfUser(userId, 'blocked')).toBe(2);
    for (const sid of [a, b]) {
      expect(await fields(sid)).toMatchObject({ revoked: '1', revokedReason: 'blocked' });
    }
    expect((await redis.client.sMembers(userSessionsKey(userId))).sort()).toEqual([a, b].sort());
  });

  it('marks claims stale on live sessions and skips revoked and gone ones', async () => {
    const userId = randomUUID();
    const live = await createFor(userId);
    const revoked = await createFor(userId);
    const gone = await createFor(userId);
    await store().revoke(revoked, 'logout');
    await redis.client.del(sessionKey(gone));

    expect(await store().markClaimsStale(userId)).toBe(1);
    expect((await fields(live)).claimsVersion).toBe('2');
    expect((await fields(revoked)).claimsVersion).toBe('1');
    expect((await redis.client.sMembers(userSessionsKey(userId))).sort()).toEqual(
      [live, revoked].sort(),
    );
  });

  it('leaves no session key behind for an expired sid', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    await redis.client.del(sessionKey(sid));

    expect(await store().revoke(sid, 'logout')).toBe(false);
    expect(await store().revokeAllOfUser(userId, 'blocked')).toBe(0);
    expect(await store().markClaimsStale(userId)).toBe(0);
    expect(await redis.client.exists(sessionKey(sid))).toBe(0);
  });
});
