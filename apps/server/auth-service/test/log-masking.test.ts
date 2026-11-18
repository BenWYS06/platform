// Invitation tokens never reach the logs: request, error and 404 lines (spec 009 Done when 17).
// Session tokens never reach the logs or stdout: login, /session, /me (spec 012 Done when 12).
// Nor during refresh, reuse, a failed publish and logout (spec 012 part 1.2b Done when 14).
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { noLimit, unusedInvitations, unusedLogin } from './helpers/invitations.js';
import { createLogger } from '../src/logger.js';
import { errorHandler, notFound } from '../src/middleware/errors.js';
import { maskTokens, requestLogger } from '../src/middleware/requestLog.js';
import { createFailureCounter } from '../src/repositories/failureCounter.js';
import { createSessionStore, SESSION_FIELD, sessionKey } from '../src/repositories/sessions.js';
import { createMongo, createRedis, type Mongo, type Redis } from '../src/repositories/stores.js';
import { createUsersRepository } from '../src/repositories/users.js';
import { startLoginService } from '../src/services/login.js';
import { createLoginLimit, LOGIN_WINDOW_SECONDS } from '../src/services/loginLimit.js';
import { createLogoutService } from '../src/services/logout.js';
import { hashPassword } from '../src/services/password.js';
import { createRefreshService, REFRESH_WINDOW_SECONDS } from '../src/services/refresh.js';
import { createSessionService } from '../src/services/session.js';
import { createSessionCheck } from '../src/services/sessionCheck.js';
import { createSessionRevoker, SESSIONS_REVOKED_CHANNEL } from '../src/services/sessionRevoker.js';
import { createSessionTokens } from '../src/services/sessionTokens.js';
import { hashToken } from '../src/services/tokens.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';
import { startRedis, type TestRedis, waitFor } from './helpers/redis.js';

// Low entropy on purpose, so the secret scan does not take it for a key.
const TOKEN = 'T'.repeat(44);
const MASKED = '/api/auth/invitations/[redacted]/';

function capture() {
  const lines: string[] = [];
  const logger = createLogger(new Writable({ write: (c, _e, done) => (lines.push(...String(c).split('\n').filter(Boolean)), done()) }));
  return { logger, lines };
}

// The real request logger in front of a test-only route under the invitations path.
function testApp() {
  const { logger, lines } = capture();
  const app = express();
  app.use(requestLogger(logger));
  app.post('/api/auth/invitations/:token/ok', (req, res) => void res.status(201).json({ referer: req.headers.referer ?? null }));
  app.post('/api/auth/invitations/:token/boom', (req) => {
    throw new Error(`failed at ${req.originalUrl}`);
  });
  app.use(notFound);
  app.use(errorHandler);
  return { app, lines };
}

function expectMasked(lines: string[], path: string) {
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) expect(line).not.toContain(TOKEN);
  expect(lines.some((l) => JSON.parse(l).req?.url === path)).toBe(true);
}

describe('token masking in logs', () => {
  it('masks the token in the request log of a route that succeeds', async () => {
    const { app, lines } = testApp();
    expect((await request(app).post(`/api/auth/invitations/${TOKEN}/ok`)).status).toBe(201);
    expectMasked(lines, `${MASKED}ok`);
  });

  it('masks the token in the error log and the error message of a route that throws', async () => {
    const { app, lines } = testApp();
    expect((await request(app).post(`/api/auth/invitations/${TOKEN}/boom`)).status).toBe(500);
    expectMasked(lines, `${MASKED}boom`);
    const error = lines.map((l) => JSON.parse(l)).find((l) => l.msg === 'unexpected error');
    expect(error?.err.message).toBe(`failed at ${MASKED}boom`);
  });

  it('masks the token in the 404 log of a path with no route', async () => {
    const { app, lines } = testApp();
    expect((await request(app).post(`/api/auth/invitations/${TOKEN}/nope?x=1`)).status).toBe(404);
    expectMasked(lines, `${MASKED}nope?x=1`);
  });

  it('masks the token in the 404 log of the real app, in any letter case', async () => {
    const { logger, lines } = capture();
    const app = createApp({ config: { internalApiKey: 'k' }, logger, health: { allUp: async () => true }, readiness: { isReady: () => true }, invitations: unusedInvitations, acceptLimit: noLimit, login: unusedLogin });
    expect((await request(app).post(`/API/Auth/Invitations/${TOKEN}/accept-password`)).status).toBe(404);
    expectMasked(lines, '/API/Auth/Invitations/[redacted]/accept-password');
  });

  it('masks the token of the web invite page in the Referer header and leaves the request unchanged', async () => {
    const { app, lines } = testApp();
    const res = await request(app)
      .post(`/api/auth/invitations/${TOKEN}/ok`)
      .set('Referer', `http://localhost:5173/invite/${TOKEN}`);
    expect(res.status).toBe(201);
    expect(res.body.referer).toBe(`http://localhost:5173/invite/${TOKEN}`);
    expectMasked(lines, `${MASKED}ok`);
    expect(JSON.parse(lines[0] ?? '{}').req.headers.referer).toBe('http://localhost:5173/invite/[redacted]');
  });
});

describe('maskTokens', () => {
  it('leaves other paths alone', () => {
    expect(maskTokens('/api/auth/health')).toBe('/api/auth/health');
    expect(maskTokens('/api/auth/invitations')).toBe('/api/auth/invitations');
  });
});

describe('session tokens in logs and stdout', () => {
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

  it('writes no token, refresh hash or cookie and auth header value during login, /session and /me', async () => {
    const EMAIL = 'boss@team.test';
    const PASSWORD = 'correct horse battery';
    const users = createUsersRepository(mongoClient.connection.useDb(uniqueDbName(), { useCache: false }));
    await users.ensureIndexes();
    await users.insert({ email: EMAIL, displayName: 'Boss', role: 'Owner', passwordHash: await hashPassword(PASSWORD) });
    const sessions = createSessionStore(redis.client, 2592000);
    const tokens = createSessionTokens({ jwtAccessSecret: 'test-access-secret-of-32-characters!', jwtAccessTtlSeconds: 900 });
    const login = await startLoginService({
      users,
      loginLimit: createLoginLimit(createFailureCounter(redis.client, `test:${randomUUID()}:`, LOGIN_WINDOW_SECONDS)),
      sessions,
      tokens,
    });
    const { logger, lines } = capture();
    const app = createApp({
      config: { internalApiKey: 'k' },
      logger,
      health: { allUp: async () => true },
      readiness: { isReady: () => true },
      invitations: unusedInvitations,
      acceptLimit: noLimit,
      login,
      session: createSessionService(createSessionCheck(tokens, sessions), users),
    });

    const stdout: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (stdout.push(String(chunk)), true));
    const secrets: string[] = [];
    try {
      const web = await request(app).post('/api/auth/login').set('X-Client', 'web').send({ email: EMAIL, password: PASSWORD });
      const body = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      expect([web.status, body.status]).toEqual([200, 200]);
      const setCookies = ([] as string[]).concat(web.headers['set-cookie'] ?? []);
      const cookieValue = (name: string) => decodeURIComponent(setCookies.find((c) => c.startsWith(`${name}=`))?.split(';')[0]?.slice(name.length + 1) ?? '');
      const webRefresh = cookieValue('refreshToken');
      const cookie = `accessToken=${cookieValue('accessToken')}`;
      const authorization = `Bearer ${body.body.accessToken}`;

      expect((await request(app).get('/api/auth/session').set('Cookie', cookie)).status).toBe(200);
      expect((await request(app).get('/api/auth/me').set('Authorization', authorization)).status).toBe(200);

      const hashes = await Promise.all(
        [webRefresh, body.body.refreshToken as string].map((t) => redis.client.hGet(sessionKey(t.split('.')[0] ?? ''), SESSION_FIELD.REFRESH_HASH)),
      );
      secrets.push(web.body.accessToken, body.body.accessToken, webRefresh, body.body.refreshToken, ...hashes.map(String), ...setCookies, cookie, authorization);
    } finally {
      spy.mockRestore();
    }

    expect(lines.length).toBeGreaterThanOrEqual(4);
    for (const secret of secrets) expect(secret.length).toBeGreaterThan(20);
    for (const line of [...lines, ...stdout]) for (const secret of secrets) expect(line).not.toContain(secret);
  }, START_TIMEOUT_MS);

  it('writes no token, refresh hash or cookie and auth header value during refresh, reuse, a failed publish and logout', async () => {
    const EMAIL = 'boss@team.test';
    const PASSWORD = 'correct horse battery';
    const users = createUsersRepository(mongoClient.connection.useDb(uniqueDbName(), { useCache: false }));
    await users.ensureIndexes();
    await users.insert({ email: EMAIL, displayName: 'Boss', role: 'Owner', passwordHash: await hashPassword(PASSWORD) });
    const sessions = createSessionStore(redis.client, 2592000);
    const tokens = createSessionTokens({ jwtAccessSecret: 'test-access-secret-of-32-characters!', jwtAccessTtlSeconds: 900 });
    const { logger, lines } = capture();
    // Publish goes through the real client until the failed-publish step switches it off.
    let publishFails = false;
    const publisher = {
      publish: (channel: string, message: string) => (publishFails ? Promise.reject(new Error('publish down')) : redis.client.publish(channel, message)),
    };
    const revoker = createSessionRevoker({ sessions, publisher, logger });
    const app = createApp({
      config: { internalApiKey: 'k' },
      logger,
      health: { allUp: async () => true },
      readiness: { isReady: () => true },
      invitations: unusedInvitations,
      acceptLimit: noLimit,
      login: await startLoginService({
        users,
        loginLimit: createLoginLimit(createFailureCounter(redis.client, `test:${randomUUID()}:`, LOGIN_WINDOW_SECONDS)),
        sessions,
        tokens,
      }),
      refresh: createRefreshService({
        users,
        sessions,
        counter: createFailureCounter(redis.client, `test:${randomUUID()}:`, REFRESH_WINDOW_SECONDS),
        revoker,
        tokens,
      }),
      logout: createLogoutService({ tokens, revoker }),
    });

    const stdout: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => (stdout.push(String(chunk)), true));
    const secrets: string[] = [];
    try {
      const webLogin = await request(app).post('/api/auth/login').set('X-Client', 'web').send({ email: EMAIL, password: PASSWORD });
      const bodyLogin = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
      const setCookies = (res: request.Response) => ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const cookieValue = (res: request.Response, name: string) =>
        decodeURIComponent(setCookies(res).find((c) => c.startsWith(`${name}=`))?.split(';')[0]?.slice(name.length + 1) ?? '');
      const oldWebRefresh = cookieValue(webLogin, 'refreshToken');
      const oldBodyRefresh = bodyLogin.body.refreshToken as string;

      // Web refresh with the cookie, then a body refresh.
      const webCookie = `refreshToken=${oldWebRefresh}`;
      const web = await request(app).post('/api/auth/refresh').set('X-Client', 'web').set('Cookie', webCookie);
      const body = await request(app).post('/api/auth/refresh').send({ refreshToken: oldBodyRefresh });
      expect([web.status, body.status]).toEqual([200, 200]);
      const newWebRefresh = cookieValue(web, 'refreshToken');
      const newWebAccess = cookieValue(web, 'accessToken');

      // Reuse: the old body token again revokes that session and publishes.
      const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: oldBodyRefresh });
      expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSE');

      // Logout with publish failing: 204 and one warn line naming the channel.
      publishFails = true;
      const authorization = `Bearer ${newWebAccess}`;
      const logout = await request(app).post('/api/auth/logout').set('Authorization', authorization);
      expect(logout.status).toBe(204);
      expect(lines.map((l) => JSON.parse(l)).filter((l) => l.msg === 'event publish failed' && l.channel === SESSIONS_REVOKED_CHANNEL)).toHaveLength(1);

      const refreshTokens = [oldWebRefresh, oldBodyRefresh, newWebRefresh, body.body.refreshToken as string];
      secrets.push(
        webLogin.body.accessToken,
        bodyLogin.body.accessToken,
        web.body.accessToken,
        body.body.accessToken,
        ...refreshTokens,
        ...refreshTokens.map(hashToken),
        ...[webLogin, web, logout].flatMap(setCookies).filter((c) => !c.startsWith('accessToken=;') && !c.startsWith('refreshToken=;')),
        webCookie,
        authorization,
      );
    } finally {
      spy.mockRestore();
    }

    expect(lines.length).toBeGreaterThanOrEqual(6);
    for (const secret of secrets) expect(secret.length).toBeGreaterThan(20);
    for (const line of [...lines, ...stdout]) for (const secret of secrets) expect(line).not.toContain(secret);
  }, START_TIMEOUT_MS);
});
