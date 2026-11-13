import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const PROD = {
  APP_ENV: 'prod',
  INTERNAL_API_KEY: 'k'.repeat(32),
  MONGODB_URI: 'mongodb://db/?replicaSet=rs0',
  REDIS_URL: 'redis://cache:6379',
  BOOTSTRAP_OWNER_EMAIL: 'boss@team.test',
  WEB_ORIGIN: 'https://example.com',
};

// Starts the real server entry with only these env variables; config fails before any store call.
function start(env: Record<string, string | undefined>) {
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined)) as Record<string, string>;
  return spawnSync(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: root,
    // The child needs PATH and SystemRoot (Windows) to start; no other variable is passed on.
    // eslint-disable-next-line no-restricted-properties
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '', ...clean },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('startup with APP_ENV=prod', () => {
  for (const [name, value] of [
    ['BOOTSTRAP_OWNER_EMAIL', undefined],
    ['BOOTSTRAP_OWNER_EMAIL', 'owner@example.com'],
    ['WEB_ORIGIN', undefined],
    ['WEB_ORIGIN', 'http://localhost:5173'],
  ] as const) {
    it(`exits with code 1 and names ${name} when it is ${value ?? 'missing'}`, () => {
      const run = start({ ...PROD, [name]: value });
      expect(run.status).toBe(1);
      expect(run.stdout).toContain(name);
    }, 30_000);
  }
});
