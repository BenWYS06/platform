// Job: which files Vitest runs. Tests sit next to source (src/**) or cover the whole app (test/).
// Coverage (npm run test:cov): line percent of src/ in coverage/coverage-summary.json,
// read by scripts/ci/coverage-gate.sh.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    // Many test files start their own MongoDB/Redis containers; more workers overload Docker and cause random timeouts.
    maxWorkers: 4,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
