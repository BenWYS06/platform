// Job: lint rules for the web client. Run: npm run lint
import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

const onlyInApi = 'Only src/api/ talks to the server or the browser storage.';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    files: ['**/*.ts', '**/*.vue'],
    rules: {
      // TypeScript checks names; the core rule does not know browser globals.
      'no-undef': 'off',
      'vue/no-v-html': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: onlyInApi },
        { name: 'localStorage', message: onlyInApi },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'fetch', message: onlyInApi },
        { object: 'globalThis', property: 'fetch', message: onlyInApi },
        { object: 'window', property: 'localStorage', message: onlyInApi },
        { object: 'globalThis', property: 'localStorage', message: onlyInApi },
      ],
      'no-restricted-imports': ['error', { paths: [{ name: 'axios', message: onlyInApi }] }],
    },
  },
  {
    files: ['src/api/**'],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
