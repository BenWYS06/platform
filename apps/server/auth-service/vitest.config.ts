// Job: which files Vitest runs. Tests sit next to source (src/**) or cover the whole app (test/).
// Coverage (npm run test:cov): line percent of src/ in coverage/coverage-summary.json,
// read by scripts/ci/coverage-gate.sh.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
