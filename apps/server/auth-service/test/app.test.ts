import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { ApiError } from '../src/errors.js';
import { errorHandler } from '../src/middleware/errors.js';
import { createLogger } from '../src/logger.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';

const KEY = 'test-internal-key';

function setup() {
  const lines: string[] = [];
  const sink = new Writable({
    write(chunk, _enc, done) {
      lines.push(...chunk.toString().split('\n').filter(Boolean));
      done();
    },
  });
  const logger = createLogger(sink);
  return { app: createApp({ config: { internalApiKey: KEY }, logger, health: { allUp: async () => true }, readiness: { isReady: () => true }, invitations: unusedInvitations, acceptLimit: noLimit }), lines, logger };
}

describe('errors', () => {
  it('answers an unknown route with NOT_FOUND', async () => {
    const res = await request(setup().app).get('/nope');
    expectError(res, 'NOT_FOUND');
  });

  it('answers malformed JSON with VALIDATION_FAILED', async () => {
    const res = await request(setup().app).post('/internal/ping').set('X-Internal-Key', KEY).set('Content-Type', 'application/json').send('{bad');
    expectError(res, 'VALIDATION_FAILED');
  });

  it('answers an unexpected error with INTERNAL and no detail', async () => {
    const { logger } = setup();
    const app = express();
    app.use((req, _res, next) => {
      req.log = logger;
      next();
    });
    app.get('/boom', () => {
      throw new Error('secret detail mongodb://user:pass@db');
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expectError(res, 'INTERNAL');
    expect(res.text).toBe('{"code":"INTERNAL"}');
  });

  it('sends the params of an ApiError in the error body', async () => {
    const app = express();
    app.get('/gone', () => {
      throw new ApiError('INVITATION_EXPIRED', { retryAfterSeconds: 60, field: 'token', fields: ['a', 'b'] });
    });
    app.use(errorHandler);

    const res = await request(app).get('/gone');
    expectError(res, 'INVITATION_EXPIRED', { retryAfterSeconds: 60, field: 'token', fields: ['a', 'b'] });
  });

  it('sends no params field when an ApiError has none', async () => {
    const app = express();
    app.get('/taken', () => {
      throw new ApiError('MEMBER_ALREADY_EXISTS');
    });
    app.use(errorHandler);

    const res = await request(app).get('/taken');
    expect(res.text).toBe('{"code":"MEMBER_ALREADY_EXISTS"}');
    expectError(res, 'MEMBER_ALREADY_EXISTS');
  });
});

describe('GET /internal/ping', () => {
  it('rejects a request without the key', async () => {
    const res = await request(setup().app).get('/internal/ping');
    expectError(res, 'UNAUTHENTICATED');
  });

  it('rejects a wrong key, a wrong-length key and an empty key', async () => {
    const { app } = setup();
    for (const key of ['test-internal-kez', 'x', '']) {
      const res = await request(app).get('/internal/ping').set('X-Internal-Key', key);
      expectError(res, 'UNAUTHENTICATED');
    }
  });

  it('rejects the key sent twice', async () => {
    // Node joins a header sent twice into "a, b"; this is what the middleware sees.
    const res = await request(setup().app).get('/internal/ping').set('X-Internal-Key', `${KEY}, ${KEY}`);
    expectError(res, 'UNAUTHENTICATED');
  });

  it('accepts the right key', async () => {
    const res = await request(setup().app).get('/internal/ping').set('X-Internal-Key', KEY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'OK' });
  });
});

describe('request id and logs', () => {
  it('keeps a safe request id and replaces an unsafe one', async () => {
    const { app } = setup();
    expect((await request(app).get('/nope').set('X-Request-Id', 'abc-123')).headers['x-request-id']).toBe('abc-123');
    expect((await request(app).get('/nope').set('X-Request-Id', 'bad id!')).headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('logs JSON with the request id and hides secret headers', async () => {
    const { app, lines } = setup();
    await request(app)
      .get('/internal/ping')
      .set('X-Request-Id', 'req-42')
      .set('Authorization', 'Bearer secret-token-value')
      .set('Cookie', 'sid=secret-cookie-value')
      .set('X-Internal-Key', KEY);

    const entries = lines.map((l) => JSON.parse(l));
    const done = entries.find((e) => e.msg === 'request completed');
    expect(done.req.id).toBe('req-42');
    expect(done.res.statusCode).toBe(200);
    const all = lines.join('\n');
    for (const secret of ['secret-token-value', 'secret-cookie-value', KEY]) {
      expect(all).not.toContain(secret);
    }
  });
});
