// Invitation tokens never reach the logs: request, error and 404 lines (spec 009 Done when 17).
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';
import { createLogger } from '../src/logger.js';
import { errorHandler, notFound } from '../src/middleware/errors.js';
import { maskTokens, requestLogger } from '../src/middleware/requestLog.js';

const TOKEN = 'Zm9vYmFyLXRva2VuLXZhbHVlLXRoYXQtaXMtNDMtY2hh';
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
    const app = createApp({ config: { internalApiKey: 'k' }, logger, health: { allUp: async () => true }, readiness: { isReady: () => true }, invitations: unusedInvitations, acceptLimit: noLimit });
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
