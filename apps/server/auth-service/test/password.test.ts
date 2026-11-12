import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/services/password.js';

// Also the install check for the argon2 native package on Windows and Linux (plan 009a, Task 1).
describe('password hashing', () => {
  it('hashes with argon2id at the OWASP minimum and verifies the right password', async () => {
    const stored = await hashPassword('correct horse battery');
    console.log(`argon2 hash prefix: ${stored.slice(0, stored.lastIndexOf('$', stored.lastIndexOf('$') - 1))}`);
    expect(stored.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    expect(await verifyPassword(stored, 'correct horse battery')).toBe(true);
  });

  it('rejects a wrong password, a changed letter case and spaces around it', async () => {
    const stored = await hashPassword('correct horse battery');
    expect(await verifyPassword(stored, 'wrong horse battery')).toBe(false);
    expect(await verifyPassword(stored, 'Correct horse battery')).toBe(false);
    expect(await verifyPassword(stored, ' correct horse battery ')).toBe(false);
  });

  it('gives a new salt each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same password here'), hashPassword('same password here')]);
    expect(a).not.toBe(b);
  });

  it('answers false for a hash it cannot read', async () => {
    expect(await verifyPassword('not-a-hash', 'correct horse battery')).toBe(false);
  });
});
