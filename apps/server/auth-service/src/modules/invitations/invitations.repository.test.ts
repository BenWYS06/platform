// Integration: the invitations repository (Mongoose) against a real MongoDB.
import { describe, expect, it } from 'vitest';
import { DuplicateError } from '../../common/storeErrors.js';
import { useRepoMongo } from '../../../test/helpers/repos.js';

const freshRepos = useRepoMongo();

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
