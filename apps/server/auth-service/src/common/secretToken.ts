// Job: invitation token helpers. A token is 32 random bytes in base64url (43 characters);
// only its sha256 is stored.
import { createHash, randomBytes } from 'node:crypto';

export const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

export const newToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');
