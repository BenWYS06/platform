// Job: test-all.sh works from the folder Node starts it in. On Windows its root must start
// with an uppercase drive even from a lowercase d:\ (Vitest fails every suite otherwise),
// and an unknown part stops it before anything runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const script = join(repoRoot, 'scripts', 'test-all.sh').replaceAll('\\', '/');

function run(args, cwd) {
  const r = spawnSync('bash', [script, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

test('root starts with an uppercase drive when started from a lowercase one', { skip: process.platform !== 'win32' }, () => {
  const lower = repoRoot[0].toLowerCase() + repoRoot.slice(1);
  const r = run(['--root'], lower);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out.trim(), /^[A-Z]:\//);
});

test('stops on an unknown part', () => {
  const r = run(['billing-service'], repoRoot);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /unknown part 'billing-service'/);
});
