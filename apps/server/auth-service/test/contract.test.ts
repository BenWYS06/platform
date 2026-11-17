import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_STATUS } from '../src/errors.js';
import { SESSION_FIELD, SESSION_KEY, USER_SESSIONS_KEY } from '../src/repositories/sessions.js';
import { CLAIMS_CHANGED_CHANNEL, SESSIONS_REVOKED_CHANNEL } from '../src/services/sessionRevoker.js';

// Every code this service returns exists in contracts/error-codes.json with the same status.
describe('error codes', () => {
  it('match contracts/error-codes.json', () => {
    const url = new URL('../../../../contracts/error-codes.json', import.meta.url);
    const contract = JSON.parse(readFileSync(url, 'utf8')) as { code: string; status: number }[];
    const byCode = new Map(contract.map((e) => [e.code, e.status]));

    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(byCode.get(code), code).toBe(status);
    }
  });
});

// The session key patterns and hash field names match contracts/messaging.json, both ways.
describe('session Redis names', () => {
  it('match contracts/messaging.json', () => {
    const url = new URL('../../../../contracts/messaging.json', import.meta.url);
    const contract = JSON.parse(readFileSync(url, 'utf8')) as { name: string; kind: string; value: string }[];
    const fromContract = Object.fromEntries(
      contract.filter((e) => e.kind === 'redisKey' || e.kind === 'redisField').map((e) => [e.name, e.value]),
    );
    const fromCode = {
      SESSION_KEY,
      USER_SESSIONS_KEY,
      ...Object.fromEntries(Object.entries(SESSION_FIELD).map(([k, v]) => ['SESSION_FIELD_' + k, v])),
    };

    expect(fromCode).toEqual(fromContract);
  });
});

// The event channel constants match contracts/messaging.json, both ways.
describe('event channels', () => {
  it('match contracts/messaging.json', () => {
    const url = new URL('../../../../contracts/messaging.json', import.meta.url);
    const contract = JSON.parse(readFileSync(url, 'utf8')) as { name: string; kind: string; value: string }[];
    const fromContract = Object.fromEntries(
      contract.filter((e) => e.kind === 'redisChannel').map((e) => [e.name, e.value]),
    );

    expect({ SESSIONS_REVOKED_CHANNEL, CLAIMS_CHANGED_CHANNEL }).toEqual(fromContract);
  });
});
