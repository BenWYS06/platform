// Job: which files Vitest runs. Tests sit next to source (src/**) or cover the whole app (test/).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
});
