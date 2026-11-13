// Job: check an error answer against contracts/schemas/error-body.schema.json.
// Every test that expects an error answer calls expectError.
import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import type { Response } from 'supertest';
import { expect } from 'vitest';
import { ERROR_STATUS, type ErrorCode, type ErrorParams } from '../../src/errors.js';

const schemaUrl = new URL('../../../../../contracts/schemas/error-body.schema.json', import.meta.url);
const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync(schemaUrl, 'utf8')));

// The answer has the contract status of `code`, a body that fits the schema, and that code
// (and these params, when given).
export function expectError(res: Response, code: ErrorCode, params?: ErrorParams): void {
  expect(res.status, `status of ${code}`).toBe(ERROR_STATUS[code]);
  expect(validate(res.body), JSON.stringify(validate.errors)).toBe(true);
  expect(res.body).toEqual(params ? { code, params } : { code });
}
