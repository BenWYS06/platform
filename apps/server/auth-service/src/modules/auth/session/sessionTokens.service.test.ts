import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { createSessionTokens, newRefreshToken, newSid, type AccessClaims } from './sessionTokens.service.js';
import { hashToken } from '../../../common/secretToken.js';

const SECRET = 's'.repeat(32);
const TTL = 900;
const tokens = createSessionTokens({ jwtAccessSecret: SECRET, jwtAccessTtlSeconds: TTL });
const CLAIMS: AccessClaims = { sub: 'user-1', sid: newSid(), role: 'Member', perms: [], depts: [], cv: 1 };

describe('session tokens', () => {
  it('signs an access token that verifies with every claim and the TTL', () => {
    const claims = tokens.verifyAccess(tokens.signAccess(CLAIMS));
    expect(claims).toMatchObject(CLAIMS);
    expect(Object.keys(claims!).sort()).toEqual(['cv', 'depts', 'exp', 'iat', 'perms', 'role', 'sid', 'sub']);
    expect(claims!.exp - claims!.iat).toBe(TTL);
  });

  it('refuses alg none, RS256, another secret and an expired token', () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body = { ...CLAIMS, iat: now, exp: now + TTL };
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(body)}.`;
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const rs256 = jwt.sign(body, privateKey, { algorithm: 'RS256' });
    const otherSecret = jwt.sign(body, 'o'.repeat(32), { algorithm: 'HS256' });
    const expired = jwt.sign({ ...CLAIMS, iat: now - 2 * TTL, exp: now - TTL }, SECRET, { algorithm: 'HS256' });

    for (const token of [none, rs256, otherSecret, expired]) {
      expect(tokens.verifyAccess(token)).toBeUndefined();
    }
  });

  it('makes a 22-character sid and a refresh token whose hash is not the token', () => {
    const sid = newSid();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const refresh = newRefreshToken(sid);
    expect(refresh).toMatch(new RegExp(`^${sid}\\.[A-Za-z0-9_-]{43}$`));
    const hash = hashToken(refresh);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(refresh);
  });
});
