// Job: each CI check script fails on a bad sample and passes on the real repo.
// Bad samples are small repos built in a temp folder per test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

function run(script, root) {
  const r = spawnSync(process.execPath, [join(here, '..', script), root], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

// Build a sample repo from { 'relative/path': 'content' } and remove it after the test.
function sample(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'ci-check-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const lines = (n) => 'x\n'.repeat(n);

// --- check-env ---

test('check-env passes on the real repo', () => {
  const r = run('check-env.mjs', repoRoot);
  assert.equal(r.code, 0, r.out);
});

test('check-env fails when code reads a variable missing from .env.example', (t) => {
  const root = sample(t, {
    '.env.example': 'APP_ENV=local\n# MONGODB_URI=mongodb://localhost:27017\n',
    'services/demo/src/main/resources/application.yml': 'a: ${APP_ENV:local}\nb: ${MONGODB_URI}\nc: ${SECRET_TOKEN}\n',
    'services/node-demo/src/server.ts': 'const k = process.env.API_KEY;\n',
  });
  const r = run('check-env.mjs', root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /reads SECRET_TOKEN/);
  assert.match(r.out, /reads API_KEY/);
  assert.doesNotMatch(r.out, /APP_ENV|MONGODB_URI/);
});

test('check-env fails on a host that is not allowed', (t) => {
  const root = sample(t, {
    '.env.example': '',
    'infra/Caddyfile': 'http://localhost:8080 {\n}\n',
    'services/demo/src/client.ts': "const url = 'https://api.openbox-prod.net/v1';\n",
    'services/demo/test/fixtures/sample.json': '{"url": "https://ignored.example.org"}\n',
    'services/demo/README.md': 'See https://ignored.example.org\n',
  });
  const r = run('check-env.mjs', root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /host api\.openbox-prod\.net/);
  assert.doesNotMatch(r.out, /localhost|ignored/);
});

// --- check-file-size ---

test('check-file-size passes on the real repo', () => {
  const r = run('check-file-size.mjs', repoRoot);
  assert.equal(r.code, 0, r.out);
});

test('check-file-size fails on a long screen, component, service and controller', (t) => {
  const root = sample(t, {
    'clients/web/src/ChatView.vue': lines(401),
    'clients/android/app/LoginScreen.kt': lines(401),
    'services/demo/src/main/java/RoomService.java': lines(501),
    'services/demo/src/main/java/RoomController.java': lines(501),
    'services/node-demo/src/routes/users.ts': lines(501),
    'services/demo/src/main/java/OkService.java': lines(500),
    'services/demo/src/test/java/BigServiceTest.java': lines(900),
  });
  const r = run('check-file-size.mjs', root);
  assert.equal(r.code, 1, r.out);
  for (const name of ['ChatView.vue', 'LoginScreen.kt', 'RoomService.java', 'RoomController.java', 'routes/users.ts']) {
    assert.match(r.out, new RegExp(name.replace('.', '\\.')));
  }
  assert.doesNotMatch(r.out, /OkService|BigServiceTest/);
});

// --- check-tests-exist ---

test('check-tests-exist passes on the real repo', () => {
  const r = run('check-tests-exist.mjs', repoRoot);
  assert.equal(r.code, 0, r.out);
});

test('check-tests-exist fails for a service with zero tests', (t) => {
  const root = sample(t, {
    'services/tested/src/test/java/AppTest.java': 'class AppTest {}\n',
    'services/node-tested/test/app.test.ts': '',
    'services/untested/src/main/java/App.java': 'class App {}\n',
  });
  const r = run('check-tests-exist.mjs', root);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /services\/untested: no test files/);
  assert.doesNotMatch(r.out, /services\/(tested|node-tested):/);
});
