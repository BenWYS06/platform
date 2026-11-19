// Integration: the login failure limits against a real Redis (spec 009 B3, B4, B12; plan 009b
// C1, C2; Done when 5, 10).
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../../common/apiError.js';
import { StoreUnavailableError } from '../../common/storeErrors.js';
import { createFailureCounter } from '../../common/failureCounter.js';
import { createRedis, type Redis } from '../../infra/stores.js';
import {
  createLoginLimit,
  LOGIN_WINDOW_SECONDS,
} from './loginLimit.service.js';
import { START_TIMEOUT_MS } from '../../../test/helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from '../../../test/helpers/redis.js';

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

const EMAIL = 'boss@team.test';
const IP = '203.0.113.5';
const sha256 = (text: string) =>
  createHash('sha256').update(text).digest('hex');

// A limit with its own key prefix, so tests never share counters.
function setup(client = redis.client) {
  const prefix = `test:${randomUUID()}:`;
  const limit = createLoginLimit(
    createFailureCounter(client, prefix, LOGIN_WINDOW_SECONDS),
  );
  const emailKey = `${prefix}email:${sha256(EMAIL)}`;
  const ipKey = `${prefix}ip:${IP}`;
  const scanKeys = async () => {
    const found: string[] = [];
    for await (const keys of client.scanIterator({ MATCH: `${prefix}*` }))
      found.push(...keys);
    return found;
  };
  return { limit, emailKey, ipKey, scanKeys };
}

async function rateLimited(call: Promise<void>): Promise<number> {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe('RATE_LIMITED');
  return Number((error as ApiError).params?.retryAfterSeconds);
}

describe('login failure limits', () => {
  it('sets a 900 s expiry on both keys with the first failure', async () => {
    const { limit, emailKey, ipKey } = setup();
    await limit.fail(EMAIL, IP);
    for (const key of [emailKey, ipKey]) {
      expect(await redis.client.get(key)).toBe('1');
      const ttl = await redis.client.ttl(key);
      expect(ttl).toBeGreaterThan(LOGIN_WINDOW_SECONDS - 5);
      expect(ttl).toBeLessThanOrEqual(LOGIN_WINDOW_SECONDS);
    }
  });

  it('clears the email key on success and leaves the IP key', async () => {
    const { limit, emailKey, ipKey } = setup();
    await limit.fail(EMAIL, IP);
    await limit.fail(EMAIL, IP);
    await limit.succeed(EMAIL);
    expect(await redis.client.exists(emailKey)).toBe(0);
    expect(await redis.client.get(ipKey)).toBe('2');
  });

  it('throws 429 after 5 failures for one email, with retryAfterSeconds equal to the key TTL', async () => {
    const { limit, emailKey } = setup();
    for (let i = 0; i < 4; i++) await limit.fail(EMAIL, `198.51.100.${i}`);
    await expect(limit.check(EMAIL, IP)).resolves.toBeUndefined();
    await limit.fail(EMAIL, '198.51.100.9');

    const seconds = await rateLimited(limit.check(EMAIL, IP));
    expect(
      Math.abs(seconds - (await redis.client.ttl(emailKey))),
    ).toBeLessThanOrEqual(1);
    // The same email in another case or with spaces is the same counter.
    await rateLimited(limit.check('  Boss@Team.TEST ', IP));
  });

  it('throws 429 after 20 failures from one IP across emails, with retryAfterSeconds equal to the key TTL', async () => {
    const { limit, ipKey } = setup();
    for (let i = 0; i < 19; i++) await limit.fail(`user${i}@team.test`, IP);
    await expect(limit.check('new@team.test', IP)).resolves.toBeUndefined();
    await limit.fail('user19@team.test', IP);

    const seconds = await rateLimited(limit.check('new@team.test', IP));
    expect(
      Math.abs(seconds - (await redis.client.ttl(ipKey))),
    ).toBeLessThanOrEqual(1);
    await expect(
      limit.check('new@team.test', '203.0.113.6'),
    ).resolves.toBeUndefined();
  });

  it('stores no plain email in any key', async () => {
    const { limit, scanKeys } = setup();
    await limit.fail(EMAIL, IP);
    const keys = await scanKeys();
    expect(keys).toHaveLength(2);
    for (const key of keys) {
      expect(key).not.toContain(EMAIL);
      expect(key).not.toContain('boss');
      expect(key).not.toContain('team.test');
    }
  });
});

describe('login limit with Redis down', () => {
  it(
    'makes check and fail throw StoreUnavailableError',
    async () => {
      const down = await startRedis();
      const own = createRedis(down.url);
      try {
        await waitFor(() => own.client.isReady);
        const { limit } = setup(own.client);
        await limit.check(EMAIL, IP);

        await down.stop();
        await waitFor(() => !own.client.isReady);
        await expect(limit.check(EMAIL, IP)).rejects.toBeInstanceOf(
          StoreUnavailableError,
        );
        await expect(limit.fail(EMAIL, IP)).rejects.toBeInstanceOf(
          StoreUnavailableError,
        );
        await expect(limit.succeed(EMAIL)).rejects.toBeInstanceOf(
          StoreUnavailableError,
        );
      } finally {
        await own.close();
      }
    },
    START_TIMEOUT_MS,
  );
});
