import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTRACTS, checkContract } from '../lib/check.mjs';
import { loadReal, writeTempJson } from './helpers.mjs';

// The committed files: one test per file, so the output lists each one as checked.
for (const [name, contract] of Object.entries(CONTRACTS)) {
  test(`${contract.file} is valid`, () => {
    assert.deepEqual(checkContract(name), []);
  });
}

test('rejects a duplicate error code and names both entries', () => {
  const data = loadReal('error-codes');
  data.push({ ...data[2], description: 'Copy.' });
  const problems = checkContract('error-codes', writeTempJson('error-codes', data));
  assert.deepEqual(problems, [`error-codes.json: entries 2 and ${data.length - 1} share code "FORBIDDEN"`]);
});

test('rejects a duplicate capability name', () => {
  const data = [
    { name: 'CHAT_SEND', description: 'Send messages.' },
    { name: 'CHAT_SEND', description: 'Again.' },
  ];
  const problems = checkContract('capabilities', writeTempJson('capabilities', data));
  assert.deepEqual(problems, ['capabilities.json: entries 0 and 1 share name "CHAT_SEND"']);
});

test('rejects two messaging names with the same broker value', () => {
  const data = [
    { name: 'AI_REQUESTS', kind: 'queue', value: 'ai.requests', description: 'AI jobs.' },
    { name: 'AI_JOBS', kind: 'queue', value: 'ai.requests', description: 'Same queue.' },
  ];
  const problems = checkContract('messaging', writeTempJson('messaging', data));
  assert.deepEqual(problems, ['messaging.json: entries 0 and 1 share value "ai.requests"']);
});

for (const [name, entry] of [
  ['error-codes', { code: 'notFound', status: 404, description: 'Lower case.' }],
  ['capabilities', { name: 'chat_send', description: 'Lower case.' }],
  ['messaging', { name: 'ai-requests', kind: 'queue', value: 'ai.requests', description: 'Dash.' }],
  ['events', { name: 'UserLoggedOut', version: 1, description: 'Camel case.' }],
]) {
  test(`rejects a name that is not UPPER_SNAKE in ${CONTRACTS[name].file}`, () => {
    const problems = checkContract(name, writeTempJson(name, [entry]));
    const key = CONTRACTS[name].key;
    assert.equal(problems.length, 1);
    assert.match(problems[0], new RegExp(`entry 0 \\(${key} "${entry[key]}"\\), field "${key}" must match pattern`));
  });
}

test('rejects a broker value that is not lower case with dots', () => {
  const data = [{ name: 'AI_REQUESTS', kind: 'queue', value: 'AI_Requests', description: 'Bad.' }];
  const problems = checkContract('messaging', writeTempJson('messaging', data));
  assert.match(problems.join('\n'), /field "value" must match pattern/);
});

test('rejects an unknown messaging kind', () => {
  const data = [{ name: 'AI_REQUESTS', kind: 'topic', value: 'ai.requests', description: 'Bad.' }];
  const problems = checkContract('messaging', writeTempJson('messaging', data));
  assert.match(problems.join('\n'), /field "kind" must be equal to one of the allowed values/);
});

test('rejects an event version below 1', () => {
  const data = [{ name: 'USER_LOGGED_OUT', version: 0, description: 'Bad.' }];
  const problems = checkContract('events', writeTempJson('events', data));
  assert.match(problems.join('\n'), /field "version" must be >= 1/);
});

test('accepts valid entries in the empty-list files', () => {
  assert.deepEqual(
    checkContract('capabilities', writeTempJson('capabilities', [{ name: 'CHAT_SEND', description: 'Send.' }])),
    [],
  );
  assert.deepEqual(
    checkContract(
      'messaging',
      writeTempJson('messaging', [{ name: 'AI_REQUESTS', kind: 'queue', value: 'ai.requests', description: 'Jobs.' }]),
    ),
    [],
  );
  assert.deepEqual(
    checkContract('events', writeTempJson('events', [{ name: 'USER_LOGGED_OUT', version: 1, description: 'Out.' }])),
    [],
  );
});
