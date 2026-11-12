import { Writable } from 'node:stream';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { createHealth, type StoreCheck } from '../src/services/health.js';
import { expectError } from './helpers/error-body.js';

const logger = createLogger(new Writable({ write: (_c, _e, done) => done() }));
const up = (name: string): StoreCheck => ({ name, check: async () => {} });
const fails = (name: string): StoreCheck => ({
  name,
  check: async () => {
    throw new Error('connect ECONNREFUSED 127.0.0.1:27017');
  },
});
const hangs = (name: string): StoreCheck => ({ name, check: () => new Promise(() => {}) });

describe('createHealth', () => {
  it('is up when every store answers', async () => {
    expect(await createHealth([up('mongodb'), up('redis')], logger).allUp()).toBe(true);
  });

  it('is down when MongoDB fails', async () => {
    expect(await createHealth([fails('mongodb'), up('redis')], logger).allUp()).toBe(false);
  });

  it('is down within the timeout when Redis hangs', async () => {
    const start = Date.now();
    expect(await createHealth([up('mongodb'), hangs('redis')], logger, 200).allUp()).toBe(false);
    expect(Date.now() - start).toBeLessThan(2000);
  });
});

describe('GET /api/auth/health', () => {
  const app = (allUp: boolean) => createApp({ config: { internalApiKey: 'k' }, logger, health: { allUp: async () => allUp }, readiness: { isReady: () => true } });

  it('returns UP when stores answer', async () => {
    const res = await request(app(true)).get('/api/auth/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'UP' });
  });

  it('returns SERVICE_UNAVAILABLE without detail when a store is down', async () => {
    const res = await request(app(false)).get('/api/auth/health');
    expectError(res, 'SERVICE_UNAVAILABLE');
    expect(res.text).toBe('{"code":"SERVICE_UNAVAILABLE"}');
  });
});
