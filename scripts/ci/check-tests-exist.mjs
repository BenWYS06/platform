// Job: CI check (c). Every service folder in apps/server/ has at least one test file.
// Usage: node scripts/ci/check-tests-exist.mjs [repo root]   (default: current folder)
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, report } from './files.mjs';

const root = process.argv[2] ?? process.cwd();
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|Tests?\.(java|kt)$/;

const servicesDir = join(root, 'apps', 'server');
const services = existsSync(servicesDir)
  ? readdirSync(servicesDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];

const problems = [];
for (const name of services) {
  const tests = listFiles(root, [`apps/server/${name}`]).filter((p) => TEST_FILE.test(p));
  if (tests.length === 0) problems.push(`apps/server/${name}: no test files`);
}

report('check-tests-exist', problems, `${services.length} service(s), each with tests`);
