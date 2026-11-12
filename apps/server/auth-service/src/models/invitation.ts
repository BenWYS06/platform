// Job: the Mongoose model of `invitations` in database `platform` (auth-service is the only
// writer). Only the sha256 of a token is stored. Only repositories import this file.
import { type Connection, type Model, Schema } from 'mongoose';
import { ROLES } from './user.js';

export const INVITATION_STATUSES = ['pending', 'accepted', 'revoked'] as const;

export interface InvitationFields {
  email: string;
  role: (typeof ROLES)[number];
  invitedBy: string;
  tokenHash: string;
  expiresAt: Date;
  status: (typeof INVITATION_STATUSES)[number];
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  createdAt: Date;
}

const invitationSchema = new Schema<InvitationFields>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, required: true, enum: ROLES },
    invitedBy: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    status: { type: String, required: true, enum: INVITATION_STATUSES, default: 'pending' },
    acceptedAt: { type: Date, default: null },
    acceptedUserId: { type: String, default: null },
  },
  { collection: 'invitations', timestamps: { createdAt: true, updatedAt: false }, versionKey: false, strict: 'throw' },
);
invitationSchema.index({ tokenHash: 1 }, { unique: true, name: 'tokenHash_unique' });
// One pending invitation per email at a time.
invitationSchema.index(
  { email: 1 },
  { unique: true, name: 'email_pending_unique', partialFilterExpression: { status: 'pending' } },
);

export const invitationModel = (connection: Connection): Model<InvitationFields> =>
  connection.models.Invitation ?? connection.model<InvitationFields>('Invitation', invitationSchema);
