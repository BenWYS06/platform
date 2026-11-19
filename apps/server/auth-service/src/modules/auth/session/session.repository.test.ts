// Integration: the session store against a real Redis (spec 012 A1, A14; plan 012a Task 4;
// Done when 2).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StoreUnavailableError } from '../../../common/storeErrors.js';
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

const newSession = () => ({
  sid: newSid(),
  userId: randomUUID(),
  method: 'password' as const,
  platform: 'web' as const,
  deviceId: '',
  refreshHash: 'a'.repeat(64),
});

describe('session store', () => {
  it('creates the hash with all 11 fields and the user set, both with the refresh TTL', async () => {
    const store = createSessionStore(redis.client, TTL);
    const session = newSession();

    expect(await store.create(session)).toBe(session.sid);

    const hash = await redis.client.hGetAll(sessionKey(session.sid));
    expect(Object.keys(hash).sort()).toEqual(
      [
        'userId',
        'method',
        'deviceId',
        'platform',
        'refreshHash',
        'prevRefreshHash',
        'rotatedAt',
        'claimsVersion',
        'revoked',
        'revokedReason',
        'createdAt',
      ].sort(),
    );
    expect(hash).toMatchObject({
      userId: session.userId,
      platform: 'web',
      claimsVersion: '1',
      revoked: '0',
      prevRefreshHash: '',
    });
    expect(
      TTL - (await redis.client.ttl(sessionKey(session.sid))),
    ).toBeLessThanOrEqual(2);
    expect(
      await redis.client.sIsMember(
        userSessionsKey(session.userId),
        session.sid,
      ),
    ).toBe(1);
    expect(
      TTL - (await redis.client.ttl(userSessionsKey(session.userId))),
    ).toBeLessThanOrEqual(2);

    expect(await store.readForCheck(session.sid)).toEqual({
      userId: session.userId,
      revoked: false,
      claimsVersion: 1,
    });
  });

  it('reads nothing for a missing sid', async () => {
    expect(
      await createSessionStore(redis.client, TTL).readForCheck(newSid()),
    ).toBeUndefined();
  });

  it(
    'throws StoreUnavailableError from create and readForCheck with Redis down',
    async () => {
      const down = await startRedis();
      const own = createRedis(down.url);
      try {
        await waitFor(() => own.client.isReady);
        const store = createSessionStore(own.client, TTL);
        await down.stop();
        await waitFor(() => !own.client.isReady);
        await expect(store.create(newSession())).rejects.toBeInstanceOf(
          StoreUnavailableError,
        );
        await expect(store.readForCheck(newSid())).rejects.toBeInstanceOf(
          StoreUnavailableError,
        );
      } finally {
        await own.close();
      }
    },
    START_TIMEOUT_MS,
  );
});
