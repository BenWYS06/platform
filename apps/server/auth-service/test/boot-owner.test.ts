// Integration: the first-owner boot step against a real MongoDB (spec 009 Done when 6, 7, 8).
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLogger } from '../src/logger.js';
import { DuplicateError } from '../src/repositories/errors.js';
import { createInvitationsRepository, type Invitation } from '../src/repositories/invitations.js';
import { createMongo, type Mongo } from '../src/repositories/stores.js';
import { createUsersRepository } from '../src/repositories/users.js';
import { createBootOwnerStep, hashToken, OWNER_INVITATION_TTL_MS } from '../src/services/bootOwner.js';
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

const WEB_ORIGIN = 'http://localhost:5173';
const LINK = /^http:\/\/localhost:5173\/invite\/([A-Za-z0-9_-]{43})$/;
const NOW = new Date('2026-11-13T10:00:00Z');

async function setup({ bootstrapOwnerEmail }: { bootstrapOwnerEmail: string | undefined } = { bootstrapOwnerEmail: 'boss@team.test' }) {
  const db = client.connection.useDb(uniqueDbName(), { useCache: false });
  const users = createUsersRepository(db);
  const invitations = createInvitationsRepository(db);
  await users.ensureIndexes();
  await invitations.ensureIndexes();
  const lines: string[] = [];
  const logs: string[] = [];
  const logger = createLogger(new Writable({ write: (c, _e, done) => (logs.push(String(c)), done()) }));
  const boot = () =>
    createBootOwnerStep({
      users,
      invitations,
      config: { bootstrapOwnerEmail, webOrigin: WEB_ORIGIN },
      logger,
      writeLine: (line) => lines.push(line),
      now: () => NOW,
    })();
  const all = () => db.collection('invitations').find({}).sort({ createdAt: 1 }).toArray();
  return { users, boot, lines, logs, all };
}

const tokenOf = (line: string | undefined): string => LINK.exec(line ?? '')?.[1] ?? '';

describe('first-owner boot step', () => {
  it('stores one pending owner invitation, writes one link line and keeps the token out of the logs', async () => {
    const { boot, lines, logs, all } = await setup();
    await boot();

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(LINK);
    const token = tokenOf(lines[0]);
    const docs = await all();
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({
      email: 'boss@team.test',
      role: 'Owner',
      invitedBy: 'system',
      status: 'pending',
      tokenHash: hashToken(token),
      expiresAt: new Date(NOW.getTime() + OWNER_INVITATION_TTL_MS),
    });
    expect(docs[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain(token);
      expect(line).not.toContain(docs[0]?.tokenHash);
    }
  });

  it('revokes the old invitation on a second boot and writes a new link', async () => {
    const { boot, lines, all } = await setup();
    await boot();
    await boot();

    expect(lines).toHaveLength(2);
    const [first, second] = lines.map(tokenOf);
    expect(first).not.toBe(second);
    const docs = await all();
    expect(docs.map((d) => [d.tokenHash, d.status])).toEqual([
      [hashToken(first ?? ''), 'revoked'],
      [hashToken(second ?? ''), 'pending'],
    ]);
  });

  it('writes and prints nothing once a user exists', async () => {
    const { users, boot, lines, logs, all } = await setup();
    await users.insert({ email: 'boss@team.test', displayName: 'Boss', role: 'Owner', passwordHash: '$argon2id$fake' });
    await boot();

    expect(lines).toEqual([]);
    expect(await all()).toEqual([]);
    expect(logs.filter((l) => JSON.parse(l).level >= 40)).toEqual([]);
  });

  it('writes nothing and warns once when the email is unset', async () => {
    const { boot, lines, logs, all } = await setup({ bootstrapOwnerEmail: undefined });
    await boot();

    expect(lines).toEqual([]);
    expect(await all()).toEqual([]);
    const warnings = logs.map((l) => JSON.parse(l)).filter((l) => l.level === 40);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].msg).toContain('BOOTSTRAP_OWNER_EMAIL');
  });
});

describe('first-owner boot step on a duplicate', () => {
  const silent = createLogger(new Writable({ write: (_c, _e, done) => done() }));

  function withDuplicates(failures: number) {
    let inserts = 0;
    let revokes = 0;
    const lines: string[] = [];
    const boot = createBootOwnerStep({
      users: { any: async () => false },
      invitations: {
        revokePendingOwners: async () => (revokes++, 0),
        insert: async () => {
          if (++inserts <= failures) throw new DuplicateError('invitations');
          return {} as Invitation;
        },
      },
      config: { bootstrapOwnerEmail: 'boss@team.test', webOrigin: WEB_ORIGIN },
      logger: silent,
      writeLine: (line) => lines.push(line),
    });
    return { boot, lines, counts: () => ({ inserts, revokes }) };
  }

  it('revokes and inserts again, and writes one link', async () => {
    const { boot, lines, counts } = withDuplicates(2);
    await boot();
    expect(counts()).toEqual({ inserts: 3, revokes: 3 });
    expect(lines).toHaveLength(1);
  });

  it('gives up after 3 attempts and writes nothing', async () => {
    const { boot, lines, counts } = withDuplicates(3);
    await expect(boot()).rejects.toBeInstanceOf(DuplicateError);
    expect(counts()).toEqual({ inserts: 3, revokes: 3 });
    expect(lines).toEqual([]);
  });
});
