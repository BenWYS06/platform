// Integration: requireAccess and the four session checks against a real Redis (spec 012 A2,
// A6, A8, A9; plan 012a Task 6; Done when 5, part of 6, part of 9).
import { randomUUID } from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireAccess } from '../src/modules/auth/session/requireAccess.middleware.js';
import { createSessionStore, SESSION_FIELD, sessionKey } from '../src/modules/auth/session/session.repository.js';
import { createRedis, type Redis, type RedisClient } from '../src/infra/stores.js';
import { createSessionCheck } from '../src/modules/auth/session/sessionCheck.service.js';
import { createSessionTokens, newSid, type VerifiedClaims } from '../src/modules/auth/session/sessionTokens.service.js';
import { expectError } from './helpers/error-body.js';
import { START_TIMEOUT_MS } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

const SECRET = 'test-access-secret-of-32-characters!';
const TTL = 2592000;
const tokens = createSessionTokens({ jwtAccessSecret: SECRET, jwtAccessTtlSeconds: 900 });

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

function appFor(client: RedisClient) {
  const sessions = createSessionStore(client, TTL);
  const app = express();
  app.get('/protected', requireAccess(createSessionCheck(tokens, sessions)), (_req, res) => {
    res.json({ sub: (res.locals.claims as VerifiedClaims).sub });
  });
  app.use(errorHandler);
  return { app, sessions };
}

// A stored session and a matching access token.
async function login(client: RedisClient = redis.client) {
  const { app, sessions } = appFor(client);
  const sid = newSid();
  const userId = randomUUID();
  await sessions.create({ sid, userId, method: 'password', platform: 'web', deviceId: '', refreshHash: 'a'.repeat(64) });
  const claims = { sub: userId, sid, role: 'Owner' as const, perms: [], depts: [], cv: 1 };
  return { app, sid, userId, claims, token: tokens.signAccess(claims) };
}

const get = (app: express.Express, headers: Record<string, string> = {}) => request(app).get('/protected').set(headers);
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('requireAccess', () => {
  it('lets a valid Bearer token through with one HMGET', async () => {
    const { app, userId, token } = await login();
    const hmGet = vi.spyOn(redis.client, 'hmGet');
    const res = await get(app, bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ sub: userId });
    expect(hmGet).toHaveBeenCalledTimes(1);
    hmGet.mockRestore();
  });

  it('answers 401 UNAUTHENTICATED for a missing, wrong or unknown token', async () => {
    const { app, claims, token } = await login();
    const now = Math.floor(Date.now() / 1000);
    const cases: Record<string, string>[] = [
      {},
      { Cookie: `accessToken=${token}` },
      { Authorization: `Basic ${token}` },
      { Authorization: 'Bearer not-a-jwt' },
      bearer(jwt.sign({ ...claims, iat: now - 1000, exp: now - 10 }, SECRET, { algorithm: 'HS256' })),
      bearer(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, iat: now, exp: now + 900 })}.`),
      bearer(jwt.sign(claims, 'another-secret-of-32-characters!!', { algorithm: 'HS256', expiresIn: 900 })),
      bearer(tokens.signAccess({ ...claims, sid: newSid() })),
      bearer(tokens.signAccess({ ...claims, sub: randomUUID() })),
    ];
    for (const headers of cases) expectError(await get(app, headers), 'UNAUTHENTICATED');
  });

  it('answers 401 SESSION_REVOKED for a revoked session', async () => {
    const { app, sid, token } = await login();
    await redis.client.hSet(sessionKey(sid), SESSION_FIELD.REVOKED, '1');
    expectError(await get(app, bearer(token)), 'SESSION_REVOKED');
  });

  it('answers 401 TOKEN_CLAIMS_STALE when claimsVersion is above cv', async () => {
    const { app, sid, token } = await login();
    await redis.client.hSet(sessionKey(sid), SESSION_FIELD.CLAIMS_VERSION, '2');
    expectError(await get(app, bearer(token)), 'TOKEN_CLAIMS_STALE');
  });

  it('decides on the Bearer token when a cookie is also sent', async () => {
    const { app, claims, token } = await login();
    expect((await get(app, { ...bearer(token), Cookie: 'accessToken=junk' })).status).toBe(200);
    const other = jwt.sign(claims, 'another-secret-of-32-characters!!', { algorithm: 'HS256', expiresIn: 900 });
    expectError(await get(app, { ...bearer(other), Cookie: `accessToken=${token}` }), 'UNAUTHENTICATED');
  });

  it(
    'answers 503 SERVICE_UNAVAILABLE with Redis down',
    async () => {
      const down = await startRedis();
      const own = createRedis(down.url);
      try {
        await waitFor(() => own.client.isReady);
        const { app, token } = await login(own.client);
        await down.stop();
        await waitFor(() => !own.client.isReady);
        expectError(await get(app, bearer(token)), 'SERVICE_UNAVAILABLE');
      } finally {
        await own.close();
      }
    },
    START_TIMEOUT_MS,
  );
});
