import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ERROR_STATUS } from '../src/errors.js';

// Every code this service returns exists in contracts/error-codes.json with the same status.
describe('error codes', () => {
  it('match contracts/error-codes.json', () => {
    const url = new URL('../../../contracts/error-codes.json', import.meta.url);
    const contract = JSON.parse(readFileSync(url, 'utf8')) as { code: string; status: number }[];
    const byCode = new Map(contract.map((e) => [e.code, e.status]));

    for (const [code, status] of Object.entries(ERROR_STATUS)) {
      expect(byCode.get(code), code).toBe(status);
    }
  });
});
