// Job: accept an invitation with a password (spec 009 A6, A23). Check order after the route's
// token-shape and body checks: lookup and status, email already a user, atomic claim, create.
// A failed create puts the invitation back to pending.
import type { Logger } from 'pino';
import { ApiError } from '../errors.js';
import { DuplicateError } from '../repositories/errors.js';
import type { InvitationsRepository } from '../repositories/invitations.js';
import type { Role, UsersRepository } from '../repositories/users.js';
import { hashPassword } from './password.js';
import { hashToken } from './tokens.js';

export interface AcceptInput {
  token: string;
  password: string;
  displayName: string;
}

export interface AcceptedUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface InvitationsService {
  acceptWithPassword(input: AcceptInput): Promise<AcceptedUser>;
}

export interface InvitationsServiceDeps {
  users: Pick<UsersRepository, 'findByEmail' | 'insert'>;
  invitations: Pick<InvitationsRepository, 'findByTokenHash' | 'claim' | 'release' | 'setAcceptedUser'>;
  logger: Logger;
  now?: () => Date;
}

export function createInvitationsService(deps: InvitationsServiceDeps): InvitationsService {
  const { users, invitations, logger } = deps;
  const now = deps.now ?? (() => new Date());

  return {
    async acceptWithPassword({ token, password, displayName }) {
      const at = now();
      const invitation = await invitations.findByTokenHash(hashToken(token));
      if (!invitation) throw new ApiError('INVITATION_INVALID');
      if (invitation.status === 'revoked') throw new ApiError('INVITATION_REVOKED');
      if (invitation.status === 'accepted') throw new ApiError('INVITATION_ALREADY_ACCEPTED');
      if (invitation.expiresAt <= at) throw new ApiError('INVITATION_EXPIRED');
      if (await users.findByEmail(invitation.email)) throw new ApiError('MEMBER_ALREADY_EXISTS');

      const passwordHash = await hashPassword(password);
      // Another request claimed it between the lookup and here.
      if (!(await invitations.claim(invitation.id, at))) throw new ApiError('INVITATION_ALREADY_ACCEPTED');

      let user;
      try {
        user = await users.insert({ email: invitation.email, displayName, role: invitation.role, passwordHash });
      } catch (e) {
        await invitations.release(invitation.id).catch((releaseError: unknown) => {
          logger.error({ error: releaseError instanceof Error ? releaseError.name : 'unknown' }, 'invitation could not be released');
        });
        if (e instanceof DuplicateError) throw new ApiError('MEMBER_ALREADY_EXISTS');
        throw e;
      }
      // The user exists now; a missing back-link must not turn the answer into an error.
      await invitations.setAcceptedUser(invitation.id, user.id).catch(() => {
        logger.warn({ userId: user.id }, 'invitation accepted but acceptedUserId not stored');
      });
      logger.info({ userId: user.id, role: user.role }, 'invitation accepted');
      return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
    },
  };
}
