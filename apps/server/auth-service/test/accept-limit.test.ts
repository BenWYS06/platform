// Integration: the accept failure limit, client IP and the 429 answer against a real Redis
// (spec 009 Done when 13, 14, 15).
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Config } from '../src/config.js';
import { ApiError } from '../src/errors.js';
import { createLogger } from '../src/logger.js';
import { createFailureCounter } from '../src/repositories/failureCounter.js';
import { createRedis, type Redis } from '../src/repositories/stores.js';
import { ACCEPT_WINDOW_SECONDS, createAcceptLimit } from '../src/services/acceptLimit.js';
import type { InvitationsService } from '../src/services/invitations.js';
import { expectError } from './helpers/error-body.js';
import { START_TIMEOUT_MS } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

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

// Tokens starting with "G" are accepted; any other well-formed token is unknown.
const GOOD_TOKEN = 'G'.repeat(43);
const UNKNOWN_TOKEN = 'U'.repeat(43);
const BODY = { password: 'a long enough password', displayName: 'Boss' };
// A 429 always carries retryAfterSeconds; its exact value depends on the clock.
const RETRY = { retryAfterSeconds: expect.any(Number) as unknown as number };
const path = (token: string) => `/api/auth/invitations/${token}/accept-password`;

const service: InvitationsService = {
  acceptWithPassword: async ({ token, displayName }) => {
    if (!token.startsWith('G')) throw new ApiError('INVITATION_INVALID');
    return { id: 'u1', email: 'boss@team.test', displayName, role: 'Owner' };
  },
};

// An app with its own key prefix, so tests never share counters.
function setup(config: Partial<Pick<Config, 'trustProxy' | 'clientIpHeader'>> = {}, client = redis.client) {
  const prefix = `test:${randomUUID()}:`;
  const app = createApp({
    config: { internalApiKey: 'k', ...config },
    logger: createLogger(new Writable({ write: (_c, _e, done) => done() })),
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: service,
    acceptLimit: createAcceptLimit(createFailureCounter(client, prefix, ACCEPT_WINDOW_SECONDS)),
  });
  const countOf = async (ip: string) => Number((await redis.client.get(prefix + ip)) ?? 0);
  const keys = async () => (await redis.client.keys(`${prefix}*`)).map((k) => k.slice(prefix.length)).sort();
  return { app, countOf, keys };
}

describe('accept failure limit', () => {
  it('answers the 21st failure with 429, Retry-After equal to params.retryAfterSeconds', async () => {
    const { app } = setup();
    for (let i = 0; i < 20; i++) expectError(await request(app).post(path(UNKNOWN_TOKEN)).send(BODY), 'INVITATION_INVALID');

    const res = await request(app).post(path(UNKNOWN_TOKEN)).send(BODY);
    expectError(res, 'RATE_LIMITED', RETRY);
    const seconds = res.body.params.retryAfterSeconds;
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThanOrEqual(ACCEPT_WINDOW_SECONDS);
    expect(res.headers['retry-after']).toBe(String(seconds));
    // Blocked: even a good token waits for the window to end.
    expectError(await request(app).post(path(GOOD_TOKEN)).send(BODY), 'RATE_LIMITED', RETRY);
  });

  it('does not count a success, bad input or a 429; it counts a malformed token', async () => {
    const { app, keys, countOf } = setup();
    for (let i = 0; i < 3; i++) await request(app).post(path(UNKNOWN_TOKEN)).send(BODY);
    expect((await request(app).post(path(GOOD_TOKEN)).send(BODY)).status).toBe(201);
    expectError(await request(app).post(path(GOOD_TOKEN)).send({}), 'VALIDATION_FAILED');
    const [ip = ''] = await keys();
    expect(await countOf(ip)).toBe(3);

    expectError(await request(app).post(path('short')).send(BODY), 'INVITATION_INVALID');
    expect(await countOf(ip)).toBe(4);
  });

  it('starts the window with the first failure and lets the key expire with it', async () => {
    const { app, keys } = setup();
    await request(app).post(path(UNKNOWN_TOKEN)).send(BODY);
    const [ip = ''] = await keys();
    const ttl = await redis.client.ttl((await redis.client.keys(`*${ip}`))[0] ?? '');
    expect(ttl).toBeGreaterThan(ACCEPT_WINDOW_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(ACCEPT_WINDOW_SECONDS);
  });
});

describe('accept limit with Redis down', () => {
  it('answers 503 SERVICE_UNAVAILABLE, never 201 or 404', async () => {
    const down = await startRedis();
    const own = createRedis(down.url);
    try {
      await waitFor(() => own.client.isReady);
      const { app } = setup({}, own.client);
      expect((await request(app).post(path(GOOD_TOKEN)).send(BODY)).status).toBe(201);

      await down.stop();
      await waitFor(() => !own.client.isReady);
      expectError(await request(app).post(path(GOOD_TOKEN)).send(BODY), 'SERVICE_UNAVAILABLE');
      expectError(await request(app).post(path(UNKNOWN_TOKEN)).send(BODY), 'SERVICE_UNAVAILABLE');
      expectError(await request(app).post(path('short')).send(BODY), 'SERVICE_UNAVAILABLE');
    } finally {
      await own.close();
    }
  }, START_TIMEOUT_MS);
});

describe('client IP', () => {
  it('gives two X-Forwarded-For values separate counters with TRUST_PROXY=1', async () => {
    const { app, countOf } = setup({ trustProxy: 1 });
    for (let i = 0; i < 20; i++) await request(app).post(path(UNKNOWN_TOKEN)).set('X-Forwarded-For', '203.0.113.1').send(BODY);

    expectError(await request(app).post(path(UNKNOWN_TOKEN)).set('X-Forwarded-For', '203.0.113.1').send(BODY), 'RATE_LIMITED', RETRY);
    expectError(await request(app).post(path(UNKNOWN_TOKEN)).set('X-Forwarded-For', '203.0.113.2').send(BODY), 'INVITATION_INVALID');
    expect(await countOf('203.0.113.1')).toBe(20);
    expect(await countOf('203.0.113.2')).toBe(1);
  });

  it('lets the trusted hop decide with TRUST_PROXY=1: a fake first X-Forwarded-For value gets no new counter', async () => {
    const { app, keys } = setup({ trustProxy: 1 });
    await request(app).post(path(UNKNOWN_TOKEN)).set('X-Forwarded-For', '198.51.100.7, 203.0.113.9').send(BODY);
    await request(app).post(path(UNKNOWN_TOKEN)).set('X-Forwarded-For', '198.51.100.8, 203.0.113.9').send(BODY);
    expect(await keys()).toEqual(['203.0.113.9']);
  });

  it('lets CLIENT_IP_HEADER decide when it is set', async () => {
    const { app, keys } = setup({ clientIpHeader: 'cf-connecting-ip' });
    await request(app).post(path(UNKNOWN_TOKEN)).set('CF-Connecting-IP', '203.0.113.10').set('X-Forwarded-For', '198.51.100.1').send(BODY);
    await request(app).post(path(UNKNOWN_TOKEN)).set('CF-Connecting-IP', '2001:db8::1').send(BODY);
    expect(await keys()).toEqual(['2001:db8::1', '203.0.113.10']);
  });

  it('falls back to req.ip when CLIENT_IP_HEADER is set but the header is missing or not an IP', async () => {
    const { app, keys, countOf } = setup({ clientIpHeader: 'cf-connecting-ip' });
    await request(app).post(path(UNKNOWN_TOKEN)).send(BODY);
    await request(app).post(path(UNKNOWN_TOKEN)).set('CF-Connecting-IP', 'not-an-ip').send(BODY);
    await request(app).post(path(UNKNOWN_TOKEN)).set('CF-Connecting-IP', '203.0.113.10, 198.51.100.1').send(BODY);
    const found = await keys();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatch(/127\.0\.0\.1|::1/);
    expect(await countOf(found[0] ?? '')).toBe(3);
  });
});
