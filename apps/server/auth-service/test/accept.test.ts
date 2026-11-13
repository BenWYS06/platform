// Integration: POST /api/auth/invitations/:token/accept-password against a real MongoDB
// (spec 009 Done when 3, 5, 7, 9, 10, 11, 12, 16, 17).
import { Writable } from 'node:stream';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/logger.js';
import { createInvitationsRepository } from '../src/repositories/invitations.js';
import { createMongo, type Mongo } from '../src/repositories/stores.js';
import { createUsersRepository, type UsersRepository } from '../src/repositories/users.js';
import { createBootOwnerStep } from '../src/services/bootOwner.js';
import { createInvitationsService, type InvitationsService } from '../src/services/invitations.js';
import { verifyPassword } from '../src/services/password.js';
import { hashToken, newToken } from '../src/services/tokens.js';
import { expectError } from './helpers/error-body.js';
import { noLimit } from './helpers/invitations.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './helpers/mongo.js';

let mongo: TestMongo;
let client: Mongo;

beforeAll(async () => {
  mongo = await startMongo();
  client = createMongo(mongo.uri, 'unused');
  await client.connect();
}, START_TIMEOUT_MS);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
}, START_TIMEOUT_MS);

const PASSWORD = '  correct horse battery ';
const GOOD = { password: PASSWORD, displayName: '  Boss  ' };
const path = (token: string) => `/api/auth/invitations/${token}/accept-password`;

function captureLogger() {
  const logs: string[] = [];
  const logger = createLogger(
    new Writable({
      write: (c, _e, done) => {
        logs.push(...String(c).split('\n').filter(Boolean));
        done();
      },
    }),
  );
  return { logs, logger };
}

// A fresh database; `wrapUsers` lets a test break user creation.
async function setup(wrapUsers: (users: UsersRepository) => UsersRepository = (u) => u) {
  const db = client.connection.useDb(uniqueDbName(), { useCache: false });
  const users = createUsersRepository(db);
  const invitations = createInvitationsRepository(db);
  await users.ensureIndexes();
  await invitations.ensureIndexes();
  const { logs, logger } = captureLogger();
  const service = createInvitationsService({ users: wrapUsers(users), invitations, logger });
  const app = createApp({
    config: { internalApiKey: 'k' },
    logger,
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: service,
    acceptLimit: noLimit,
  });

  async function invite(fields: { status?: 'revoked'; expiresAt?: Date; email?: string } = {}) {
    const token = newToken();
    await invitations.insert({
      email: fields.email ?? 'Boss@Team.test',
      role: 'Owner',
      invitedBy: 'system',
      tokenHash: hashToken(token),
      expiresAt: fields.expiresAt ?? new Date(Date.now() + 60_000),
    });
    if (fields.status) {
      await db.collection('invitations').updateOne({ tokenHash: hashToken(token) }, { $set: { status: fields.status } });
    }
    return token;
  }
  const invitationOf = (token: string) => db.collection('invitations').findOne({ tokenHash: hashToken(token) });
  return { db, users, invitations, app, logs, logger, invite, invitationOf };
}

describe('accept with password', () => {
  it('creates the owner once; the same link again answers 409', async () => {
    const { db, app, invite, invitationOf } = await setup();
    const token = await invite();

    const res = await request(app).post(path(token)).send(GOOD);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      user: { id: expect.any(String), email: 'boss@team.test', displayName: 'Boss', role: 'Owner' },
    });

    const stored = await db.collection('users').findOne({});
    expect(stored).toMatchObject({ email: 'boss@team.test', displayName: 'Boss', role: 'Owner', status: 'active' });
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    // The password is used exactly as typed, spaces included.
    expect(await verifyPassword(String(stored?.passwordHash), PASSWORD)).toBe(true);
    expect(await verifyPassword(String(stored?.passwordHash), PASSWORD.trim())).toBe(false);
    expect(await invitationOf(token)).toMatchObject({
      status: 'accepted',
      acceptedAt: expect.any(Date),
      acceptedUserId: res.body.user.id,
    });

    expectError(await request(app).post(path(token)).send(GOOD), 'INVITATION_ALREADY_ACCEPTED');
    expect(await db.collection('users').countDocuments()).toBe(1);
  });

  it('gives one 201, nine 409 and one user for 10 parallel accepts of one token', async () => {
    const { db, app, invite } = await setup();
    const token = await invite();

    const answers = await Promise.all(Array.from({ length: 10 }, () => request(app).post(path(token)).send(GOOD)));
    expect(answers.filter((r) => r.status === 201)).toHaveLength(1);
    const conflicts = answers.filter((r) => r.status !== 201);
    expect(conflicts).toHaveLength(9);
    for (const r of conflicts) expectError(r, 'INVITATION_ALREADY_ACCEPTED');
    expect(await db.collection('users').countDocuments()).toBe(1);
  });

  it('answers 409 INVITATION_ALREADY_ACCEPTED when another accept of the same link wins between the lookup and the email check', async () => {
    // Forces the race of the parallel test: the winner runs after this request read the
    // invitation as pending, just before it checks the email.
    let beforeEmailCheck = async () => {};
    const { db, app, invite, users, invitations, logger } = await setup((u) => ({
      ...u,
      findByEmail: async (email) => {
        const run = beforeEmailCheck;
        beforeEmailCheck = async () => {};
        await run();
        return u.findByEmail(email);
      },
    }));
    const token = await invite();
    const winner = createInvitationsService({ users, invitations, logger });
    beforeEmailCheck = async () => {
      await winner.acceptWithPassword({ token, password: PASSWORD, displayName: 'Winner' });
    };

    expectError(await request(app).post(path(token)).send(GOOD), 'INVITATION_ALREADY_ACCEPTED');
    expect(await db.collection('users').countDocuments()).toBe(1);
  });

  it('answers 410 for an expired link and 404 for an unknown token', async () => {
    const { app, invite } = await setup();
    const expired = await invite({ expiresAt: new Date(Date.now() - 1000) });
    expectError(await request(app).post(path(expired)).send(GOOD), 'INVITATION_EXPIRED');
    expectError(await request(app).post(path(newToken())).send(GOOD), 'INVITATION_INVALID');
  });

  it('answers 410 for a revoked link', async () => {
    const { app, invite } = await setup();
    expectError(await request(app).post(path(await invite({ status: 'revoked' }))).send(GOOD), 'INVITATION_REVOKED');
  });

  it('answers 410 INVITATION_REVOKED for the old boot link after a second boot', async () => {
    const { users, invitations, app, logger } = await setup();
    const lines: string[] = [];
    const boot = createBootOwnerStep({
      users,
      invitations,
      config: { bootstrapOwnerEmail: 'boss@team.test', webOrigin: 'http://localhost:5173' },
      logger,
      writeLine: (line) => lines.push(line),
    });
    await boot();
    await boot();
    const [oldLink = '', newLink = ''] = lines.map((l) => l.split('/invite/')[1] ?? '');

    expectError(await request(app).post(path(oldLink)).send(GOOD), 'INVITATION_REVOKED');
    expect((await request(app).post(path(newLink)).send(GOOD)).status).toBe(201);
  });

  it('answers 409 MEMBER_ALREADY_EXISTS when the email is already a user and keeps the invitation pending', async () => {
    const { users, app, invite, invitationOf } = await setup();
    await users.insert({ email: 'boss@team.test', displayName: 'Old', role: 'Owner', passwordHash: '$argon2id$fake' });
    const token = await invite();

    expectError(await request(app).post(path(token)).send(GOOD), 'MEMBER_ALREADY_EXISTS');
    expect(await invitationOf(token)).toMatchObject({ status: 'pending', acceptedAt: null });
  });

  it('puts the invitation back to pending when user creation fails after the claim; the link works afterwards', async () => {
    let failNext = true;
    const { db, app, invite, invitationOf } = await setup((users) => ({
      ...users,
      insert: async (user) => {
        if (failNext) {
          failNext = false;
          throw new Error('write failed');
        }
        return users.insert(user);
      },
    }));
    const token = await invite();

    expectError(await request(app).post(path(token)).send(GOOD), 'INTERNAL');
    expect(await invitationOf(token)).toMatchObject({ status: 'pending', acceptedAt: null, acceptedUserId: null });
    expect(await db.collection('users').countDocuments()).toBe(0);

    expect((await request(app).post(path(token)).send(GOOD)).status).toBe(201);
  });
});

describe('accept input checks', () => {
  // No database behind it: the spy records every service call.
  const calls: string[] = [];
  const spy: InvitationsService = {
    acceptWithPassword: async (input) => {
      calls.push(input.token);
      return { id: 'u1', email: 'boss@team.test', displayName: input.displayName, role: 'Owner' };
    },
  };
  const app = createApp({
    config: { internalApiKey: 'k' },
    logger: captureLogger().logger,
    health: { allUp: async () => true },
    readiness: { isReady: () => true },
    invitations: spy,
    acceptLimit: noLimit,
  });
  const token = 'A'.repeat(43);

  it('answers 404 for a malformed token with no service call', async () => {
    for (const bad of ['A'.repeat(42), 'A'.repeat(44), `${'A'.repeat(42)}+`, `${'A'.repeat(42)}=`]) {
      expectError(await request(app).post(path(encodeURIComponent(bad))).send(GOOD), 'INVITATION_INVALID');
    }
    expect(calls).toEqual([]);
  });

  it.each([
    ['a password of 11 characters', { password: 'a'.repeat(11), displayName: 'Boss' }],
    ['a password of 129 characters', { password: 'a'.repeat(129), displayName: 'Boss' }],
    ['an empty displayName', { password: PASSWORD, displayName: '' }],
    ['a blank displayName', { password: PASSWORD, displayName: '   ' }],
    ['a displayName of 65 characters', { password: PASSWORD, displayName: 'b'.repeat(65) }],
    ['a missing password', { displayName: 'Boss' }],
    ['a missing displayName', { password: PASSWORD }],
    ['an unknown field', { ...GOOD, email: 'other@team.test' }],
    ['no body', undefined],
  ])('answers 400 VALIDATION_FAILED for %s', async (_name, body) => {
    const before = calls.length;
    expectError(await request(app).post(path(token)).send(body), 'VALIDATION_FAILED');
    expect(calls.length).toBe(before);
  });

  it('accepts 12 and 128 characters and a displayName of 64, counting characters, not UTF-16 units', async () => {
    for (const body of [
      { password: 'a'.repeat(12), displayName: 'b'.repeat(64) },
      { password: 'a'.repeat(128), displayName: 'B' },
      { password: '\u{1F511}'.repeat(128), displayName: '名'.repeat(64) },
    ]) {
      expect((await request(app).post(path(token)).send(body)).status).toBe(201);
    }
  });
});

describe('accept logs', () => {
  it('mask the token for a success, a 404 and a forced error', async () => {
    let failNext = false;
    const { app, logs, invite } = await setup((users) => ({
      ...users,
      insert: async (user) => {
        if (failNext) throw new Error('forced');
        return users.insert(user);
      },
    }));
    const ok = await invite();
    const broken = await invite({ email: 'second@team.test' });
    const unknown = newToken();

    expect((await request(app).post(path(ok)).send(GOOD)).status).toBe(201);
    expectError(await request(app).post(path(unknown)).send(GOOD), 'INVITATION_INVALID');
    failNext = true;
    expectError(await request(app).post(path(broken)).send(GOOD), 'INTERNAL');

    const urls = logs.map((l) => JSON.parse(l).req?.url).filter(Boolean);
    expect(urls.length).toBeGreaterThanOrEqual(3);
    for (const url of urls) expect(url).toBe('/api/auth/invitations/[redacted]/accept-password');
    for (const line of logs) for (const t of [ok, broken, unknown]) expect(line).not.toContain(t);
  });
});
