// Job: access token and session id helpers (spec 012 A1, A2, A3). The access token is an HS256
// JWT; verify pins HS256, so `alg: none` and RS256 tokens are refused. A refresh token is
// `<sid>.<32 random bytes base64url>`; only hashToken(refreshToken) is stored.
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import type { Role } from '../modules/users/index.js';

export interface AccessClaims {
  sub: string;
  sid: string;
  role: Role;
  perms: string[];
  depts: string[];
  cv: number;
}

export interface VerifiedClaims extends AccessClaims {
  iat: number;
  exp: number;
}

export interface SessionTokens {
  signAccess(claims: AccessClaims): string;
  // The claims, or undefined for any token that is not valid (bad signature, wrong alg, expired, bad shape).
  verifyAccess(token: string): VerifiedClaims | undefined;
  // The same check with expiry ignored; logout only (plan 012b D9).
  verifyAccessSignature(token: string): VerifiedClaims | undefined;
}

const ALGORITHM = 'HS256';

export function createSessionTokens({ jwtAccessSecret, jwtAccessTtlSeconds }: Pick<Config, 'jwtAccessSecret' | 'jwtAccessTtlSeconds'>): SessionTokens {
  function verify(token: string, ignoreExpiration: boolean): VerifiedClaims | undefined {
    let payload: unknown;
    try {
      payload = jwt.verify(token, jwtAccessSecret, { algorithms: [ALGORITHM], ignoreExpiration });
    } catch {
      return undefined;
    }
    return isClaims(payload) ? payload : undefined;
  }

  return {
    signAccess: ({ sub, sid, role, perms, depts, cv }) =>
      jwt.sign({ sub, sid, role, perms, depts, cv }, jwtAccessSecret, { algorithm: ALGORITHM, expiresIn: jwtAccessTtlSeconds }),

    verifyAccess: (token) => verify(token, false),
    verifyAccessSignature: (token) => verify(token, true),
  };
}

// 16 random bytes in base64url: 22 characters.
export const newSid = (): string => randomBytes(16).toString('base64url');

export const newRefreshToken = (sid: string): string => `${sid}.${randomBytes(32).toString('base64url')}`;

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

function isClaims(p: unknown): p is VerifiedClaims {
  if (typeof p !== 'object' || p === null) return false;
  const c = p as Record<string, unknown>;
  return (
    typeof c.sub === 'string' &&
    typeof c.sid === 'string' &&
    typeof c.role === 'string' &&
    isStringList(c.perms) &&
    isStringList(c.depts) &&
    Number.isInteger(c.cv) &&
    typeof c.iat === 'number' &&
    typeof c.exp === 'number'
  );
}
