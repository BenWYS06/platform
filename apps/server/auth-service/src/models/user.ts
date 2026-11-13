// Job: the Mongoose model of `users` in database `platform` (auth-service is the only writer).
// Only repositories import this file.
import { type Connection, type Model, Schema } from 'mongoose';

export const ROLES = ['Owner', 'Admin', 'Member'] as const;
export const USER_STATUSES = ['active', 'blocked'] as const;

export interface UserFields {
  email: string;
  displayName: string;
  role: (typeof ROLES)[number];
  status: (typeof USER_STATUSES)[number];
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserFields>(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true },
    role: { type: String, required: true, enum: ROLES },
    status: { type: String, required: true, enum: USER_STATUSES, default: 'active' },
    passwordHash: { type: String, required: true },
  },
  { collection: 'users', timestamps: true, versionKey: false, strict: 'throw' },
);
userSchema.index({ email: 1 }, { unique: true, name: 'email_unique' });

export const userModel = (connection: Connection): Model<UserFields> =>
  connection.models.User ?? connection.model<UserFields>('User', userSchema);
