// The startup loop: indexes first, data routes 503 until they exist, retry while MongoDB is down.
import { Writable } from 'node:stream';
import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { errorHandler } from '../src/middleware/errors.js';
import { createInvitationsRepository } from '../src/repositories/invitations.js';
import { createMongo, type Mongo } from '../src/repositories/stores.js';
import { createUsersRepository } from '../src/repositories/users.js';
import { createHealth } from '../src/services/health.js';
import { createInvitationsService, type InvitationsService } from '../src/services/invitations.js';
import { createStartupLoop, type StartupLoop } from '../src/services/startup.js';
import { expectError } from './helpers/error-body.js';
import { noLimit, unusedInvitations } from './helpers/invitations.js';
import { freePort, START_TIMEOUT_MS, startMongo, uniqueDbName } from './helpers/mongo.js';

const logger = createLogger(new Writable({ write: (_c, _e, done) => done() }));
const DATA_ROUTE = '/api/auth/invitations/abc/accept-password';
const UNKNOWN_TOKEN_ROUTE = `/api/auth/invitations/${'A'.repeat(43)}/accept-password`;

const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const step of cleanup.splice(0).reverse()) await step();
});

function appFor(startup: StartupLoop, allUp: () => Promise<boolean> = async () => true, invitations: InvitationsService = unusedInvitations) {
  return createApp({ config: { internalApiKey: 'k' }, logger, health: { allUp }, readiness: startup, invitations, acceptLimit: noLimit });
}

// The same steps as src/server.ts: connect, then the indexes.
function indexSteps(mongo: Mongo) {
  const users = createUsersRepository(mongo.connection);
  const invitations = createInvitationsRepository(mongo.connection);
  return {
    async ensureIndexes() {
      await mongo.connect();
      await users.ensureIndexes();
      await invitations.ensureIndexes();
    },
  };
}

describe('startup loop with fake steps', () => {
  it('answers no data request before index creation finishes', async () => {
    let finishIndexes: () => void = () => {};
    const order: string[] = [];
    const startup = createStartupLoop(
      {
        ensureIndexes: () => new Promise<void>((resolve) => (finishIndexes = resolve)).then(() => void order.push('indexes')),
        afterIndexes: async () => void order.push('boot'),
      },
      logger,
    );
    cleanup.push(() => startup.stop());
    const app = appFor(startup);
    startup.start();

    for (let i = 0; i < 5; i++) expectError(await request(app).post(DATA_ROUTE).send({}), 'SERVICE_UNAVAILABLE');
    expect((await request(app).get('/api/auth/health')).status).toBe(200);
    expect(order).toEqual([]);

    finishIndexes();
    await startup.done();
    expect(order).toEqual(['indexes', 'boot']);
    // Ready: the request reaches the invitations router (a malformed token: no service call).
    expectError(await request(app).post(DATA_ROUTE).send({}), 'INVITATION_INVALID');
  });

  it('retries a failed step and never runs the after-index step before the indexes', async () => {
    let calls = 0;
    const order: string[] = [];
    const startup = createStartupLoop(
      {
        ensureIndexes: async () => {
          calls += 1;
          if (calls < 3) throw new Error('mongo down');
          order.push('indexes');
        },
        afterIndexes: async () => void order.push('boot'),
      },
      logger,
      20,
    );
    cleanup.push(() => startup.stop());
    startup.start();
    await startup.done();
    expect(calls).toBe(3);
    expect(order).toEqual(['indexes', 'boot']);
  });
});

describe('startup loop with a real MongoDB', () => {
  it('creates the users and both invitation indexes', async () => {
    const mongo = await startMongo();
    cleanup.push(() => mongo.stop());
    const client = createMongo(mongo.uri, uniqueDbName());
    cleanup.push(() => client.close());
    const startup = createStartupLoop(indexSteps(client), logger);
    cleanup.push(() => startup.stop());

    startup.start();
    await startup.done();

    const invitationIndexes = await client.connection.collection('invitations').listIndexes().toArray();
    expect(invitationIndexes.find((i) => i.name === 'tokenHash_unique')).toMatchObject({ key: { tokenHash: 1 }, unique: true });
    expect(invitationIndexes.find((i) => i.name === 'email_pending_unique')).toMatchObject({
      key: { email: 1 },
      unique: true,
      partialFilterExpression: { status: 'pending' },
    });
    const userIndexes = await client.connection.collection('users').listIndexes().toArray();
    expect(userIndexes.find((i) => i.name === 'email_unique')).toMatchObject({ key: { email: 1 }, unique: true });
  }, START_TIMEOUT_MS);

  it('serves while MongoDB is down at start, then works once it is back, with no restart', async () => {
    const port = await freePort();
    const client = createMongo(`mongodb://127.0.0.1:${port}/?directConnection=true`, uniqueDbName(), 500);
    cleanup.push(() => client.close());
    const startup = createStartupLoop(indexSteps(client), logger, 200);
    cleanup.push(() => startup.stop());
    const health = createHealth([{ name: 'mongodb', check: client.ping }], logger, 1000);
    const service = createInvitationsService({
      users: createUsersRepository(client.connection),
      invitations: createInvitationsRepository(client.connection),
      logger,
    });
    const app = appFor(startup, () => health.allUp(), service);

    startup.start();
    // Health answers at once (503: a store is down); data routes answer 503 too.
    const down = await request(app).get('/api/auth/health');
    expect([down.status, down.text]).toEqual([503, '{"status":"DOWN"}']);
    expectError(await request(app).post(DATA_ROUTE).send({}), 'SERVICE_UNAVAILABLE');
    expect(startup.isReady()).toBe(false);

    const mongo = await startMongo(port);
    cleanup.push(() => mongo.stop());
    await startup.done();

    expect((await request(app).get('/api/auth/health')).status).toBe(200);
    // Accept reaches MongoDB: a well-formed unknown token is looked up and not found.
    const res = await request(app).post(UNKNOWN_TOKEN_ROUTE).send({ password: 'a long enough password', displayName: 'Boss' });
    expectError(res, 'INVITATION_INVALID');
  }, START_TIMEOUT_MS);

  it('answers a data route with 503 within about 3 s when MongoDB stops after startup', async () => {
    const mongo = await startMongo();
    let stopped = false;
    cleanup.push(() => (stopped ? undefined : mongo.stop()));
    // Default 2 s server selection, as in production.
    const client = createMongo(mongo.uri, uniqueDbName());
    cleanup.push(() => client.close());
    const startup = createStartupLoop(indexSteps(client), logger);
    cleanup.push(() => startup.stop());
    startup.start();
    await startup.done();

    // A data route as later tasks build it: a repository call, errors to the error handler.
    const users = createUsersRepository(client.connection);
    const app = express();
    app.get('/data', async (_req, res) => {
      res.json({ found: (await users.findByEmail('boss@team.test')) !== null });
    });
    app.use(errorHandler);
    expect((await request(app).get('/data')).body).toEqual({ found: false });

    await mongo.stop();
    stopped = true;
    const started = Date.now();
    const res = await request(app).get('/data');
    const elapsed = Date.now() - started;
    expectError(res, 'SERVICE_UNAVAILABLE');
    expect(elapsed).toBeLessThan(3500);
  }, START_TIMEOUT_MS);

  it('answers a repository call with 503 at once when MongoDB was never reached (no 10 s buffer)', async () => {
    const port = await freePort();
    const client = createMongo(`mongodb://127.0.0.1:${port}/?directConnection=true`, uniqueDbName(), 500);
    cleanup.push(() => client.close());
    await expect(client.connect()).rejects.toThrow();

    const users = createUsersRepository(client.connection);
    const app = express();
    app.get('/data', async (_req, res) => {
      res.json({ found: (await users.findByEmail('boss@team.test')) !== null });
    });
    app.use(errorHandler);

    const started = Date.now();
    const res = await request(app).get('/data');
    expectError(res, 'SERVICE_UNAVAILABLE');
    expect(Date.now() - started).toBeLessThan(1000);
  }, START_TIMEOUT_MS);
});
