// Job: lint rules for auth-service. Run: npm run lint
// Import rules (D-012, .claude/rules/express.md): each folder group below gets one complete
// no-restricted-imports setting, because a later setting replaces an earlier one per file.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const MONGO = ['mongoose', 'mongodb'].map((name) => ({
  name,
  message: 'Only *.model.ts, *.repository.ts, infra/stores.ts and common/storeErrors.ts use MongoDB (A31).',
}));
const MODEL = { regex: '\\.model\\.js$', message: 'Only a repository, a model or the module index imports a model.' };
const MODULE_INSIDE = (from) => ({
  regex: `^${from}modules/(?![^/]+/index\\.js$)`,
  message: 'Import a module only through its index.ts.',
});
const NO_MODULE = (from) => ({
  regex: `^${from}(modules|middleware)/|^${from}(app|server)\\.js$`,
  message: 'common/ and infra/ import no module, no middleware, no app or server.',
});

const restrict = ({ mongo = false, model = true, patterns = [] }) => [
  'error',
  { paths: mongo ? [] : MONGO, patterns: [...(model ? [MODEL] : []), ...patterns] },
];

// A file `depth` folders below src/modules (1: modules/auth/x.ts, 2: modules/auth/session/x.ts).
function moduleRules(depth) {
  const dir = `src/modules/${'*/'.repeat(depth)}`;
  const toModules = '\\.\\./'.repeat(depth);
  const toSrc = '\\.\\./'.repeat(depth + 1);
  const otherModule = {
    regex: `^${toModules}[^./][^/]*/(?!index\\.js$)`,
    message: 'Import another module only through its index.ts.',
  };
  const allowed = '(common|infra)/|middleware/clientIp\\.js$|config\\.js$';
  const escape = (extra) => ({
    regex: `^${toSrc}(?!${allowed}${extra})`,
    message:
      'A module imports only config.ts, common/, infra/, middleware/clientIp.ts and other module index files; tests also app.ts, logger.ts and test/helpers.',
  });
  const source = [otherModule, escape('')];
  const test = [otherModule, escape('|app\\.js$|logger\\.js$|\\.\\./test/helpers/')];
  return [
    { files: [`${dir}*.ts`], rules: { 'no-restricted-imports': restrict({ patterns: source }) } },
    { files: [`${dir}index.ts`], rules: { 'no-restricted-imports': restrict({ model: false, patterns: source }) } },
    {
      files: [`${dir}*.repository.ts`, `${dir}*.model.ts`],
      rules: { 'no-restricted-imports': restrict({ mongo: true, model: false, patterns: source }) },
    },
    { files: [`${dir}*.test.ts`], rules: { 'no-restricted-imports': restrict({ patterns: test }) } },
  ];
}

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
  // app.ts, server.ts, config.ts, logger.ts: modules only through their index.
  { files: ['src/*.ts'], rules: { 'no-restricted-imports': restrict({ patterns: [MODULE_INSIDE('\\./')] }) } },
  { files: ['src/middleware/*.ts'], rules: { 'no-restricted-imports': restrict({ patterns: [MODULE_INSIDE('\\.\\./')] }) } },
  {
    files: ['src/common/*.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [NO_MODULE('\\.\\./'), { regex: '^\\.\\./infra/', message: 'common/ does not import infra/.' }],
      }),
    },
  },
  {
    // The one exception: the RedisClient type.
    files: ['src/common/failureCounter.ts'],
    rules: {
      'no-restricted-imports': restrict({
        patterns: [
          NO_MODULE('\\.\\./'),
          { regex: '^\\.\\./infra/', allowTypeImports: true, message: 'failureCounter imports only types from infra/.' },
        ],
      }),
    },
  },
  {
    files: ['src/common/storeErrors.ts'],
    rules: {
      'no-restricted-imports': restrict({
        mongo: true,
        patterns: [NO_MODULE('\\.\\./'), { regex: '^\\.\\./infra/', message: 'common/ does not import infra/.' }],
      }),
    },
  },
  { files: ['src/infra/*.ts'], rules: { 'no-restricted-imports': restrict({ patterns: [NO_MODULE('\\.\\./')] }) } },
  { files: ['src/infra/stores.ts'], rules: { 'no-restricted-imports': restrict({ mongo: true, patterns: [NO_MODULE('\\.\\./')] }) } },
  ...moduleRules(1),
  ...moduleRules(2),
  ...moduleRules(3),
);
