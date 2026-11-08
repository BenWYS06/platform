// Job: lint rules for auth-service. Run: npm run lint
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // process.env is read only in src/config.ts.
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'env', message: 'Read env only in src/config.ts.' },
      ],
    },
  },
  { files: ['src/config.ts'], rules: { 'no-restricted-properties': 'off' } },
);
