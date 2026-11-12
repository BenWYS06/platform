// Job: invitations repository over the Mongoose `Invitation` model. Only the sha256 of a
// token is stored; one pending invitation per email. Callers never see Mongoose types.
import type { Connection } from 'mongoose';
import { type InvitationFields, invitationModel } from '../models/invitation.js';
import { mapStoreErrors } from './errors.js';
import { normalizeEmail } from './users.js';

export type InvitationStatus = InvitationFields['status'];

export interface Invitation extends InvitationFields {
  id: string;
}

export type NewInvitation = Pick<Invitation, 'email' | 'role' | 'invitedBy' | 'tokenHash' | 'expiresAt'>;

export interface InvitationsRepository {
  ensureIndexes(): Promise<void>;
  // Throws DuplicateError on a known token hash or a second pending invitation for the email.
  insert(invitation: NewInvitation): Promise<Invitation>;
}

const toInvitation = ({ _id, ...fields }: InvitationFields & { _id: { toString(): string } }): Invitation => ({
  id: _id.toString(),
  ...fields,
});

export function createInvitationsRepository(connection: Connection): InvitationsRepository {
  const Invitations = invitationModel(connection);
  return {
    async ensureIndexes() {
      await mapStoreErrors('invitations', () => Invitations.syncIndexes());
    },
    async insert(invitation) {
      const created = await mapStoreErrors('invitations', () =>
        Invitations.create({ ...invitation, email: normalizeEmail(invitation.email) }),
      );
      return toInvitation(created.toObject());
    },
  };
}
