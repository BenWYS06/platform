// Job: Vite build and dev server, and the Vitest setup for the web client.
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // Dev only: the app calls the relative /api; Vite forwards it to Caddy (infra/docker-compose/compose.yml).
    proxy: { '/api': 'http://localhost:8080' },
  },
  define: {
    // vue-i18n build flags: Composition API only, no devtools in production.
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    // npm run test:cov: line percent of src/ in coverage/coverage-summary.json (scripts/ci/coverage-gate.sh).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.d.ts'],
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: 'coverage',
    },
  },
});
