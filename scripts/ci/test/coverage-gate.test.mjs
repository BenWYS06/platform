// Job: coverage-gate.sh fails below the threshold, passes at or above it, prints the raise
// hint at 2+ points above, and fails on a missing report or an unknown part.
// Each test builds a small repo (thresholds file and reports) in a temp folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gate = join(here, '..', 'coverage-gate.sh').replaceAll('\\', '/');
const THRESHOLDS = '# goals: backend 90, web 70\nauth-service=80\nchat-service=60\n';

function run(part, root) {
  const r = spawnSync('bash', [gate, part, root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

function sample(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'cov-gate-')).replaceAll('\\', '/');
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const all = { 'scripts/ci/coverage-thresholds.txt': THRESHOLDS, ...files };
  for (const [path, content] of Object.entries(all)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const AUTH = 'apps/server/auth-service/coverage/coverage-summary.json';
const summary = (covered, total) =>
  JSON.stringify({ total: { lines: { total, covered, skipped: 0, pct: (100 * covered) / total } } });

test('fails when line coverage is below the threshold', (t) => {
  const r = run('auth-service', sample(t, { [AUTH]: summary(79, 100) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /auth-service FAILED: line coverage 79\.00% is below the threshold 80%/);
});

test('passes when line coverage equals the threshold', (t) => {
  const r = run('auth-service', sample(t, { [AUTH]: summary(80, 100) }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /auth-service OK: line coverage 80\.00% \(threshold 80%\)/);
  assert.doesNotMatch(r.out, /raise the threshold/);
});

test('passes and prints the raise hint at 2+ points above', (t) => {
  const r = run('auth-service', sample(t, { [AUTH]: summary(925, 1000) }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /coverage went up, raise the threshold to auth-service=91/);
});

test('reads LINE columns from a JaCoCo csv', (t) => {
  const csv =
    'GROUP,PACKAGE,CLASS,INSTRUCTION_MISSED,INSTRUCTION_COVERED,BRANCH_MISSED,BRANCH_COVERED,LINE_MISSED,LINE_COVERED,COMPLEXITY_MISSED,COMPLEXITY_COVERED,METHOD_MISSED,METHOD_COVERED\n' +
    'chat,a,A,0,0,0,0,5,10,0,0,0,0\nchat,a,B,0,0,0,0,1,4,0,0,0,0\n';
  const r = run('chat-service', sample(t, { 'apps/server/chat-service/target/site/jacoco/jacoco.csv': csv }));
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /chat-service OK: line coverage 70\.00% \(threshold 60%\)/);
  assert.match(r.out, /raise the threshold to chat-service=69/);
});

test('fails when the report is missing', (t) => {
  const r = run('auth-service', sample(t, {}));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /auth-service FAILED: no report at/);
});

test('fails on an unknown part', (t) => {
  const r = run('billing-service', sample(t, {}));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /unknown part 'billing-service'/);
});

test('fails when the part has no threshold line', (t) => {
  const r = run('web', sample(t, { 'apps/web/coverage/coverage-summary.json': summary(90, 100) }));
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /no 'web=NN' line/);
});
