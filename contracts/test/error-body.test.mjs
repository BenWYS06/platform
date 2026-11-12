import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTRACTS_DIR, checkErrorBody } from '../lib/check.mjs';
import { loadReal } from './helpers.mjs';

test('error-codes.json holds the 1.1a invitation codes with their statuses', () => {
  const byCode = new Map(loadReal('error-codes').map((e) => [e.code, e.status]));
  for (const [code, status] of [
    ['INVITATION_INVALID', 404],
    ['INVITATION_EXPIRED', 410],
    ['INVITATION_REVOKED', 410],
    ['INVITATION_ALREADY_ACCEPTED', 409],
    ['MEMBER_ALREADY_EXISTS', 409],
  ]) {
    assert.equal(byCode.get(code), status, code);
  }
});

test('the README example is a real entry of error-codes.json', () => {
  const readme = readFileSync(join(CONTRACTS_DIR, 'README.md'), 'utf8');
  const block = readme.match(/```json\n([\s\S]*?)\n\s*```/);
  assert.ok(block, 'README has a json example');
  const example = JSON.parse(block[1]);
  assert.ok(
    loadReal('error-codes').some((e) => JSON.stringify(e) === JSON.stringify(example)),
    `README example ${example.code} is not an entry of error-codes.json`,
  );
});

test('error body: accepts a code alone and a code with a message', () => {
  assert.deepEqual(checkErrorBody({ code: 'NOT_FOUND' }), []);
  assert.deepEqual(checkErrorBody({ code: 'NOT_FOUND', message: 'No such room.' }), []);
});

test('error body: accepts params of string, number and list of strings', () => {
  assert.deepEqual(checkErrorBody({ code: 'RATE_LIMITED', params: { retryAfterSeconds: 120 } }), []);
  assert.deepEqual(checkErrorBody({ code: 'VALIDATION_FAILED', params: { field: 'password' } }), []);
  assert.deepEqual(checkErrorBody({ code: 'VALIDATION_FAILED', params: { fields: ['password', 'displayName'] } }), []);
  assert.deepEqual(checkErrorBody({ code: 'VALIDATION_FAILED', params: {} }), []);
});

test('error body: rejects a nested object in params', () => {
  const problems = checkErrorBody({ code: 'VALIDATION_FAILED', params: { field: { name: 'password' } } });
  assert.ok(problems.length > 0);
  assert.match(problems.join('\n'), /error body \/params\/field /);
});

test('error body: rejects a list of numbers in params', () => {
  assert.notDeepEqual(checkErrorBody({ code: 'VALIDATION_FAILED', params: { ids: [1, 2] } }), []);
});

test('error body: rejects a missing code, a lower-case code and an unknown field', () => {
  assert.match(checkErrorBody({ message: 'x' }).join('\n'), /must have required property 'code'/);
  assert.match(checkErrorBody({ code: 'notFound' }).join('\n'), /\/code must match pattern/);
  assert.deepEqual(checkErrorBody({ code: 'NOT_FOUND', detail: 'x' }), ['error body has unknown field "detail"']);
});
