// Job: the first-owner boot step (spec 009 A4, A24, A25). While no user exists and
// BOOTSTRAP_OWNER_EMAIL is set: revoke pending owner invitations, insert a new one and write
// its link once to stdout. Runs in the startup loop, after the indexes exist.
import { createHash, randomBytes } from 'node:crypto';
import type { Logger } from 'pino';
import { DuplicateError } from '../repositories/errors.js';
import type { InvitationsRepository } from '../repositories/invitations.js';
import type { UsersRepository } from '../repositories/users.js';

export const OWNER_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export interface BootOwnerDeps {
  users: Pick<UsersRepository, 'any'>;
  invitations: Pick<InvitationsRepository, 'insert' | 'revokePendingOwners'>;
  config: { bootstrapOwnerEmail: string | undefined; webOrigin: string };
  logger: Logger;
  // The one place a token leaves the service: a plain stdout write, never the logger (A5, A25).
  writeLine?: (line: string) => void;
  now?: () => Date;
}

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function createBootOwnerStep(deps: BootOwnerDeps): () => Promise<void> {
  const { users, invitations, config, logger } = deps;
  const writeLine = deps.writeLine ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const now = deps.now ?? (() => new Date());

  return async function bootOwner() {
    if (await users.any()) return;
    const email = config.bootstrapOwnerEmail;
    if (!email) {
      logger.warn('BOOTSTRAP_OWNER_EMAIL is not set and no user exists; no first-owner link written');
      return;
    }
    for (let attempt = 1; ; attempt++) {
      const token = randomBytes(32).toString('base64url');
      await invitations.revokePendingOwners();
      try {
        await invitations.insert({
          email,
          role: 'Owner',
          invitedBy: 'system',
          tokenHash: hashToken(token),
          expiresAt: new Date(now().getTime() + OWNER_INVITATION_TTL_MS),
        });
      } catch (e) {
        // Another instance inserted between revoke and insert: revoke and insert again.
        if (e instanceof DuplicateError && attempt < MAX_ATTEMPTS) continue;
        throw e;
      }
      writeLine(`${config.webOrigin}/invite/${token}`);
      logger.info('first-owner invitation created; link written to stdout');
      return;
    }
  };
}
