// Job: one real MongoDB per test file for the repository tests (Testcontainers).
// Call useRepoMongo() at the top of the file; each freshRepos() gets a new database.
import { afterAll, beforeAll } from 'vitest';
import { createMongo, type Mongo } from '../../src/infra/stores.js';
import { createInvitationsRepository } from '../../src/modules/invitations/index.js';
import { createUsersRepository } from '../../src/modules/users/index.js';
import { START_TIMEOUT_MS, startMongo, type TestMongo, uniqueDbName } from './mongo.js';

export function useRepoMongo() {
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

  return async function freshRepos() {
    // A new database per test, on the one connection.
    const db = client.connection.useDb(uniqueDbName(), { useCache: false });
    const users = createUsersRepository(db);
    const invitations = createInvitationsRepository(db);
    await users.ensureIndexes();
    await invitations.ensureIndexes();
    return { db, users, invitations };
  };
}
