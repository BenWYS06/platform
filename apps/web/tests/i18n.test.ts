import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { messages, pickLocale } from '../src/i18n';

// Every key path in a nested message object, e.g. "errors.NOT_FOUND".
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const contractCodes: string[] = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../contracts/error-codes.json'), 'utf8'),
).map((e: { code: string }) => e.code);

describe('i18n', () => {
  it('has the same keys in en and vi', () => {
    expect(keys(messages.vi).sort()).toEqual(keys(messages.en).sort());
  });

  it('has a message for every contract error code in both languages', () => {
    expect(contractCodes.length).toBeGreaterThan(0);
    for (const locale of ['en', 'vi'] as const) {
      const errors: Record<string, string> = messages[locale].errors;
      for (const code of [...contractCodes, 'UNKNOWN', 'NETWORK']) {
        expect(errors[code], `${locale} errors.${code}`).toBeTruthy();
      }
    }
  });

  it('picks vi for a Vietnamese browser and en for anything else', () => {
    expect(pickLocale('vi-VN')).toBe('vi');
    expect(pickLocale('vi')).toBe('vi');
    expect(pickLocale('fr')).toBe('en');
    expect(pickLocale('en-US')).toBe('en');
    expect(pickLocale(undefined)).toBe('en');
  });
});
