// Integration: the users repository (Mongoose) against a real MongoDB.
import { describe, expect, it } from 'vitest';
import { DuplicateError } from '../../common/storeErrors.js';
import { useRepoMongo } from '../../../test/helpers/repos.js';

const freshRepos = useRepoMongo();

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
