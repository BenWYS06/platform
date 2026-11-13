// Job: users repository over the Mongoose `User` model. Emails are stored trimmed and in lower
// case; a unique index keeps one user per email. Callers never see Mongoose types.
import type { Connection } from 'mongoose';
import { type UserFields, userModel } from '../models/user.js';
import { mapStoreErrors } from './errors.js';

export type Role = UserFields['role'];
export type UserStatus = UserFields['status'];

export interface User extends UserFields {
  id: string;
}

export type NewUser = Pick<User, 'email' | 'displayName' | 'role' | 'passwordHash'>;

export interface UsersRepository {
  ensureIndexes(): Promise<void>;
  // Throws DuplicateError when a user with this email (any letter case) exists.
  insert(user: NewUser): Promise<User>;
  findByEmail(email: string): Promise<User | null>;
  // True when at least one user exists.
  any(): Promise<boolean>;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const toUser = ({ _id, ...fields }: UserFields & { _id: { toString(): string } }): User => ({ id: _id.toString(), ...fields });

export function createUsersRepository(connection: Connection): UsersRepository {
  const Users = userModel(connection);
  return {
    async ensureIndexes() {
      await mapStoreErrors('users', () => Users.syncIndexes());
    },
    async insert(user) {
      const created = await mapStoreErrors('users', () => Users.create({ ...user, email: normalizeEmail(user.email) }));
      return toUser(created.toObject());
    },
    async findByEmail(email) {
      const doc = await mapStoreErrors('users', () => Users.findOne({ email: normalizeEmail(email) }).lean().exec());
      return doc ? toUser(doc) : null;
    },
    async any() {
      return (await mapStoreErrors('users', () => Users.exists({}).exec())) !== null;
    },
  };
}
