// Integration: users and invitations repositories (Mongoose) against a real MongoDB.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuplicateError } from '../src/repositories/errors.js';
import { createInvitationsRepository } from '../src/repositories/invitations.js';
import { createMongo, type Mongo } from '../src/repositories/stores.js';
import { createUsersRepository } from '../src/repositories/users.js';
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

async function freshRepos() {
  // A new database per test, on the one connection.
  const db = client.connection.useDb(uniqueDbName(), { useCache: false });
  const users = createUsersRepository(db);
  const invitations = createInvitationsRepository(db);
  await users.ensureIndexes();
  await invitations.ensureIndexes();
  return { db, users, invitations };
}

const owner = { displayName: 'Boss', role: 'Owner' as const, passwordHash: '$argon2id$fake' };

describe('users repository', () => {
  it('stores the email trimmed and in lower case, active, with timestamps', async () => {
    const { users } = await freshRepos();
    const user = await users.insert({ ...owner, email: '  Boss@Team.TEST ' });
    expect(user.email).toBe('boss@team.test');
    expect(user.status).toBe('active');
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(await users.findByEmail('BOSS@team.test')).toEqual(user);
  });

  it('refuses the same email in other letter case as a duplicate', async () => {
    const { users } = await freshRepos();
    await users.insert({ ...owner, email: 'boss@team.test' });
    await expect(users.insert({ ...owner, email: 'BOSS@Team.Test' })).rejects.toBeInstanceOf(DuplicateError);
  });
});

describe('invitations repository', () => {
  const invite = (tokenHash: string) => ({
    email: 'boss@team.test',
    role: 'Owner' as const,
    invitedBy: 'system',
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  });

  it('refuses a second pending invitation for the same email', async () => {
    const { invitations } = await freshRepos();
    await invitations.insert(invite('hash-1'));
    await expect(invitations.insert({ ...invite('hash-2'), email: 'Boss@Team.test' })).rejects.toBeInstanceOf(DuplicateError);
  });

  it('allows a new pending invitation once the old one is not pending', async () => {
    const { db, invitations } = await freshRepos();
    await invitations.insert(invite('hash-1'));
    await db.collection('invitations').updateOne({ tokenHash: 'hash-1' }, { $set: { status: 'revoked' } });
    await expect(invitations.insert(invite('hash-2'))).resolves.toMatchObject({ status: 'pending' });
  });

  it('refuses a known token hash', async () => {
    const { db, invitations } = await freshRepos();
    await invitations.insert(invite('hash-1'));
    await db.collection('invitations').updateOne({ tokenHash: 'hash-1' }, { $set: { status: 'revoked' } });
    await expect(invitations.insert(invite('hash-1'))).rejects.toBeInstanceOf(DuplicateError);
  });
});
