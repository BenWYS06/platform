import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkContract } from '../lib/check.mjs';
import { loadReal, writeTemp, writeTempJson } from './helpers.mjs';

test('error-codes.json is valid', () => {
  assert.deepEqual(checkContract('error-codes'), []);
});

test('error-codes.json holds the seed codes', () => {
  const codes = loadReal('error-codes').map((e) => e.code);
  for (const code of [
    'VALIDATION_FAILED',
    'UNAUTHENTICATED',
    'FORBIDDEN',
    'NOT_FOUND',
    'CONFLICT',
    'RATE_LIMITED',
    'INTERNAL',
  ]) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
});

test('rejects a status outside 400 to 599', () => {
  const data = loadReal('error-codes');
  data[0].status = 200;
  const problems = checkContract('error-codes', writeTempJson('error-codes', data));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /error-codes\.json: entry 0 \(code "VALIDATION_FAILED"\), field "status" must be >= 400/);
});

test('rejects a status that is not an integer', () => {
  const data = loadReal('error-codes');
  data[0].status = '400';
  const problems = checkContract('error-codes', writeTempJson('error-codes', data));
  assert.match(problems.join('\n'), /field "status" must be integer/);
});

test('rejects a missing field', () => {
  const data = loadReal('error-codes');
  delete data[1].description;
  const problems = checkContract('error-codes', writeTempJson('error-codes', data));
  assert.match(problems.join('\n'), /entry 1 \(code "UNAUTHENTICATED"\) must have required property 'description'/);
});

test('rejects an unknown field', () => {
  const data = loadReal('error-codes');
  data[2].http = 403;
  const problems = checkContract('error-codes', writeTempJson('error-codes', data));
  assert.match(problems.join('\n'), /entry 2 \(code "FORBIDDEN"\) has unknown field "http"/);
});

test('rejects a file that starts with a UTF-8 BOM, with a readable message', () => {
  const text = '﻿' + JSON.stringify(loadReal('error-codes'));
  const problems = checkContract('error-codes', writeTemp('error-codes', text));
  assert.deepEqual(problems, ['error-codes.json: starts with a UTF-8 BOM; save it as UTF-8 without BOM']);
});

test('rejects a file that is not valid JSON, with a readable message', () => {
  const problems = checkContract('error-codes', writeTemp('error-codes', '[{"code": "X",]'));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^error-codes\.json: not valid JSON \(/);
  assert.doesNotMatch(problems[0], /\n\s+at /, 'no stack trace');
});

test('rejects a file that is not a list', () => {
  const problems = checkContract('error-codes', writeTempJson('error-codes', { code: 'X' }));
  assert.deepEqual(problems, ['error-codes.json: top level must be array']);
});
