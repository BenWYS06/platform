// Job: CI check (a). Every env variable the code reads is named in .env.example, and every
// URL host in source and config is in allowed-hosts.txt (no production hostname in source).
// Usage: node scripts/ci/check-env.mjs [repo root]   (default: current folder)
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles, isTestFile, report } from './files.mjs';

const root = process.argv[2] ?? process.cwd();
const SCANNED = ['apps', 'packages', 'infra'];
const NAME = '[A-Z][A-Z0-9_]*';

// --- env variable names ---

function exampleNames() {
  const path = join(root, '.env.example');
  if (!existsSync(path)) return new Set();
  // Commented-out lines (`# NAME=default`) count: they name an optional variable.
  const names = readFileSync(path, 'utf8').matchAll(new RegExp(`^#?\\s*(${NAME})=`, 'gm'));
  return new Set([...names].map((m) => m[1]));
}

function namesRead(path, text) {
  const patterns = [];
  if (/\.[cm]?[jt]sx?$/.test(path)) {
    patterns.push(new RegExp(`process\\.env\\.(${NAME})`, 'g'));
    patterns.push(new RegExp(`process\\.env\\[['"](${NAME})['"]\\]`, 'g'));
    // auth-service reads env through one schema in src/config.ts: its keys are the names.
    if (basename(path) === 'config.ts') patterns.push(new RegExp(`^  (${NAME}):`, 'gm'));
  }
  if (/\.ya?ml$/.test(path)) patterns.push(new RegExp(`\\$\\{(${NAME})`, 'g'));
  if (/\.(java|kt)$/.test(path)) patterns.push(new RegExp(`System\\.getenv\\("(${NAME})"\\)`, 'g'));
  return patterns.flatMap((re) => [...text.matchAll(re)].map((m) => m[1]));
}

// --- hosts ---

const HOST_FILE = /\.([cm]?[jt]sx?|vue|java|kt|kts|gradle|ya?ml|json|xml|properties|toml|conf)$|(^|\/)(Caddyfile|Dockerfile)$/;
const NOT_SCANNED = /(^|\/)(fixtures)\/|\.md$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/;

function allowedHosts() {
  const path = join(dirname(fileURLToPath(import.meta.url)), 'allowed-hosts.txt');
  return new Set(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim().toLowerCase())
      .filter(Boolean),
  );
}

function hostsIn(text) {
  const hosts = [];
  for (const m of text.matchAll(/\b[a-z][a-z0-9+.-]*:\/\/([^\s/"'`<>?#)\]]+)/gi)) {
    const authority = m[1].slice(m[1].lastIndexOf('@') + 1);
    for (const part of authority.split(',')) {
      const host = part.replace(/:\d*$/, '').toLowerCase();
      // `${VAR}` or similar placeholders are not hosts.
      if (host && !/[${}%]/.test(host)) hosts.push(host);
    }
  }
  return hosts;
}

// --- run ---

const problems = [];
const known = exampleNames();
const allowed = allowedHosts();

for (const path of listFiles(root, SCANNED)) {
  const text = readFileSync(join(root, path), 'utf8');
  if (!isTestFile(path)) {
    for (const name of new Set(namesRead(path, text))) {
      if (!known.has(name)) problems.push(`${path}: reads ${name}, which is not in .env.example`);
    }
  }
  if (HOST_FILE.test(path) && !NOT_SCANNED.test(path)) {
    for (const host of new Set(hostsIn(text))) {
      if (!allowed.has(host)) problems.push(`${path}: host ${host} is not in scripts/ci/allowed-hosts.txt`);
    }
  }
}

report('check-env', problems, 'env names in .env.example; only allowed hosts in source');
