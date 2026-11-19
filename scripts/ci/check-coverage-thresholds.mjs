// Job: CI check (e). scripts/ci/coverage-thresholds.txt exists, and every part the CI
// workflow gates (coverage-gate.sh <part>) has a "part=NN" line in it.
// Usage: node scripts/ci/check-coverage-thresholds.mjs [repo root]   (default: current folder)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { report } from './files.mjs';

const root = process.argv[2] ?? process.cwd();
const thresholdsFile = join(root, 'scripts', 'ci', 'coverage-thresholds.txt');
const workflow = readFileSync(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');

// Only "run:" lines; a comment that names the script is not a gate.
const gated = [...workflow.matchAll(/^\s*(?:-\s+)?run:.*coverage-gate\.sh\s+([a-z0-9-]+)/gm)].map((m) => m[1]);
const problems = [];
if (gated.length === 0) problems.push('.github/workflows/ci.yml: no coverage-gate.sh step');

if (!existsSync(thresholdsFile)) {
  problems.push('scripts/ci/coverage-thresholds.txt: missing');
} else {
  const lines = readFileSync(thresholdsFile, 'utf8').split(/\r?\n/);
  for (const part of gated) {
    if (!lines.some((l) => new RegExp(`^${part}=\\d+$`).test(l.trim()))) {
      problems.push(`scripts/ci/coverage-thresholds.txt: no "${part}=NN" line`);
    }
  }
}

report('check-coverage-thresholds', problems, `${gated.length} gated part(s), each with a threshold`);
