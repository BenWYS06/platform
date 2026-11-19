// Integration: readUserId and the refresh rotate script against a real Redis (spec 012 B1 to
// B3; plan 012b Task 4; part of Done when 2, 4, 5, 6, 13, 15).
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
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const H3 = 'c'.repeat(64);
const H4 = 'd'.repeat(64);

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
const fields = (sid: string) => redis.client.hGetAll(sessionKey(sid));

async function createFor(userId: string): Promise<string> {
  return store().create({
    sid: newSid(),
    userId,
    method: 'password',
    platform: 'web',
    deviceId: '',
    refreshHash: H1,
  });
}

// Prepares the user set so a failed rotation can be seen not to touch it: the real sid out,
// a dummy sid in (an empty set is deleted), TTL cut to 5 s.
async function shrinkSet(userId: string, sid: string): Promise<string> {
  const setKey = userSessionsKey(userId);
  await redis.client.sRem(setKey, sid);
  await redis.client.sAdd(setKey, 'dummy');
  await redis.client.expire(setKey, 5);
  return setKey;
}

async function expectSetUntouched(setKey: string, sid: string): Promise<void> {
  expect(await redis.client.sMembers(setKey)).toEqual(['dummy']);
  expect(await redis.client.sIsMember(setKey, sid)).toBe(0);
  expect(await redis.client.ttl(setKey)).toBeLessThanOrEqual(5);
}

describe('session rotate script', () => {
  it('reads the userId, or undefined for a missing sid', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    expect(await store().readUserId(sid)).toBe(userId);
    expect(await store().readUserId(newSid())).toBeUndefined();
  });

  it('rotates the current hash and resets both TTLs', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    const setKey = userSessionsKey(userId);
    await redis.client.expire(sessionKey(sid), 5);
    await redis.client.expire(setKey, 5);

    expect(await store().rotate(sid, H1, H2)).toEqual({
      kind: 'rotated',
      claimsVersion: 1,
    });
    const f = await fields(sid);
    expect(f).toMatchObject({
      refreshHash: H2,
      prevRefreshHash: H1,
      revoked: '0',
    });
    expect(Number(f.rotatedAt)).toBeGreaterThan(0);
    expect(await redis.client.ttl(sessionKey(sid))).toBeGreaterThanOrEqual(
      TTL - 2,
    );
    expect(await redis.client.ttl(setKey)).toBeGreaterThanOrEqual(TTL - 2);
  });

  it('puts the sid back in an expired user set so revokeAllOfUser finds it', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    const setKey = userSessionsKey(userId);
    await redis.client.del(setKey);

    expect((await store().rotate(sid, H1, H2)).kind).toBe('rotated');
    expect(await redis.client.sMembers(setKey)).toEqual([sid]);
    expect(await redis.client.ttl(setKey)).toBeGreaterThanOrEqual(TTL - 2);
    expect(await store().revokeAllOfUser(userId, 'blocked')).toBe(1);
  });

  it('revokes on a reused previous hash and leaves the set alone', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    await store().rotate(sid, H1, H2);
    const setKey = await shrinkSet(userId, sid);

    expect(await store().rotate(sid, H1, H3)).toEqual({ kind: 'reuse' });
    expect(await fields(sid)).toMatchObject({
      refreshHash: H2,
      revoked: '1',
      revokedReason: 'refresh_reuse',
    });
    await expectSetUntouched(setKey, sid);
  });

  it('answers invalid for an unknown hash and revokes nothing', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    await store().rotate(sid, H1, H2);
    const setKey = await shrinkSet(userId, sid);

    expect(await store().rotate(sid, H4, H3)).toEqual({ kind: 'invalid' });
    expect(await fields(sid)).toMatchObject({ refreshHash: H2, revoked: '0' });
    await expectSetUntouched(setKey, sid);
  });

  it('answers the reason of a revoked session only for a matching hash', async () => {
    const userId = randomUUID();
    const sid = await createFor(userId);
    await store().rotate(sid, H1, H2);
    await store().revoke(sid, 'blocked');
    const setKey = await shrinkSet(userId, sid);

    expect(await store().rotate(sid, H2, H3)).toEqual({
      kind: 'revoked',
      reason: 'blocked',
    });
    expect(await store().rotate(sid, H1, H3)).toEqual({
      kind: 'revoked',
      reason: 'blocked',
    });
    expect(await store().rotate(sid, H4, H3)).toEqual({ kind: 'invalid' });
    expect((await fields(sid)).refreshHash).toBe(H2);
    await expectSetUntouched(setKey, sid);
  });

  it('answers invalid for a missing sid and leaves no key', async () => {
    const sid = newSid();
    expect(await store().rotate(sid, H1, H2)).toEqual({ kind: 'invalid' });
    expect(await redis.client.exists(sessionKey(sid))).toBe(0);
  });
});
