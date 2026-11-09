// Job: CI check (b). File-size limits from .claude/rules/clean-code.md: a screen or
// component at most 400 lines, a service or controller at most 500.
// Usage: node scripts/ci/check-file-size.mjs [repo root]   (default: current folder)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listFiles, isTestFile, report } from './files.mjs';

const root = process.argv[2] ?? process.cwd();

function limitFor(path) {
  if (/\.vue$/.test(path) || /Screen\.kt$/.test(path)) return 400;
  if (/(Service|Controller)\.(java|kt|ts)$/.test(path)) return 500;
  // Express: route and service modules live in src/routes/ and src/services/.
  if (/^services\/[^/]+\/src\/(routes|services)\/.+\.ts$/.test(path)) return 500;
  return undefined;
}

const problems = [];
for (const path of listFiles(root, ['services', 'libs', 'clients'])) {
  const limit = limitFor(path);
  if (limit === undefined || isTestFile(path)) continue;
  const text = readFileSync(join(root, path), 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  if (lines > limit) problems.push(`${path}: ${lines} lines, limit ${limit}`);
}

report('check-file-size', problems, 'all screens, components, services and controllers within limits');
