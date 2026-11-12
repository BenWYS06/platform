// Job: hash and check passwords with argon2id (spec 009, A19). Never log the input or the hash.
import { Algorithm, hash, verify } from '@node-rs/argon2';

// OWASP minimum for argon2id: 19 MiB memory, 2 iterations, 1 lane.
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

// False for a wrong password or a hash that cannot be read; never throws on bad input.
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
