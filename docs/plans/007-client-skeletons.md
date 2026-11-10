# Plan 007: Web skeleton

Spec: docs/specs/007-client-skeletons.md
Issue: #8 (0.7a)
Branch: feature/web-skeleton
Status: done
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `feature/web-skeleton` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 007.` and the attribution line.
- Dependencies pinned to exact versions, each at least two weeks old; `package-lock.json`
  committed. Node 24, as in auth-service.
- Rules from `.claude/rules/vue.md`: only `src/api/` calls `fetch`, relative `/api`, every
  string in `en` and `vi`, colors only from tokens, no `v-html`, nothing in `localStorage`.
- PR text says "Android: later, issue #25".

## Tasks

- [x] Task 1. Scaffold `clients/web`
  Vite + Vue 3 + TypeScript, vue-router (one route `/`), Pinia, Vitest with jsdom and Vue
  Test Utils, ESLint (flat config: `eslint-plugin-vue`, `typescript-eslint`; `vue/no-v-html`
  on; `fetch` and `localStorage` banned outside `src/api/`) and `vue-tsc`. Scripts `dev`,
  `build`, `lint`, `test`. One smoke test that mounts the app. Add `clients/web/CLAUDE.md`
  with the line "Style with Tailwind classes from the token theme. No arbitrary color
  values, no inline styles for color." Tailwind classes in .vue files stay readable; do not
  add a class-sorting plugin.
  Check: `cd clients/web && npm ci && npm run lint && npm run build && npm test` -> all
  green; a test file with `fetch(` outside `src/api/` -> lint fails (then removed).

- [x] Task 2. Design tokens (Tailwind v4 theme) and i18n
  Install `tailwindcss` and `@tailwindcss/vite` 4.3.3 (latest v4 at least two weeks old;
  works with Vite 8.3.5), plus `@tailwindcss/node` 4.3.3 for the theme test. Add
  `tailwindcss()` to the Vite plugins and `@import "tailwindcss";` to the main CSS.
  `src/styles/tokens.css` declares the tokens with `@theme`: `--color-*: initial;` first, so
  only our colors exist as classes, then our colors, spacing, radius and type scale. Dark
  mode follows the system: a `prefers-color-scheme: dark` block overrides the same color
  variables. vue-i18n with `en` and `vi`; locale `vi` for a `vi*` browser language, else
  `en`. Keys `errors.<CODE>` for every code in `contracts/error-codes.json`, plus
  `errors.UNKNOWN` and `errors.NETWORK`.
  Check: `npm test` -> tests pass for: Tailwind compiles `tokens.css` with a token class
  (for example `bg-surface`) into CSS and `bg-blue-500` into no CSS; `en` and `vi` have the
  same keys; every contract code has `errors.<CODE>` in both (read from
  `contracts/error-codes.json`); `vi-VN` -> `vi`, `fr` -> `en`. `npm run build` -> green.

- [x] Task 3. Api layer and dev proxy
  `src/api/http.ts`: `fetch` on the relative `/api`, 5 s timeout (AbortController), result
  is the JSON body or `{ code }`; a contract error body gives its `code`, anything else
  (no answer, timeout, HTML, empty body) gives `NETWORK`. `src/api/health.ts`:
  `GET /api/<service>/health`. `vite.config.ts` proxies `/api` to `http://localhost:8080`.
  Check: `npm test` -> api tests pass for 200 `{"status":"UP"}`, 503 `SERVICE_UNAVAILABLE`,
  unknown code (passed through), timeout (fake timers), HTML answer, network error.

- [x] Task 4. Health store and screen
  Pinia store `health`: three services checked in parallel, one round at a time, states
  Checking / Up / Down with a code. The screen uses Tailwind classes from the tokens only.
  `HealthView.vue` renders three rows with the message
  from `errors.<CODE>` (unknown code -> `errors.UNKNOWN`) and a "Check again" button,
  disabled while checking.
  Check: `npm test` -> component and store tests pass for Up, `SERVICE_UNAVAILABLE`, unknown
  code, network failure, button disabled while checking, double press makes one round;
  `grep -rnE "https?://" --include=*.ts --include=*.vue clients/web/src` -> nothing (or only
  an SVG namespace in `allowed-hosts.txt`); `grep -rnE -- "-\[(#|rgb)" clients/web/src` ->
  nothing (no arbitrary color values); `grep -rnwE -- "[a-z]+-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3}" clients/web/src`
  -> nothing (no default palette classes); `node scripts/ci/check-env.mjs` and `check-file-size.mjs` -> pass. Live run:
  infra and the three services up, `npm run dev`, `curl` each `/api/<service>/health`
  through the Vite port -> 200, page shows three Up rows (the user opens it to confirm);
  chat-service stopped -> chat Down, the others Up.
  Result: tests, greps and checks pass. Live: auth Up through Vite and Caddy; chat stopped
  -> 503 `SERVICE_UNAVAILABLE`. chat and ai stay Down here because the local RabbitMQ
  refuses the login from `.env` (local data, not code; the user fixes `.env` or resets
  infra), so "three Up" is still open.

- [x] Task 5. CI job `web` and docs
  Add job `web` to `ci.yml` (Node 24, `npm ci`, lint, build, test in `clients/web`).
  Docs: `CLAUDE.md` (folder map `clients/web/` exists, Web command), `CONTRIBUTING.md`
  (local command row, file map), `docs/architecture.md` (web part: Vite dev proxy, api
  layer, error mapping), `docs/environments.md` (web dev address and proxy). D-007 and the
  handoff "Settled" line say seven required jobs.
  Check: `MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W):/repo" -w /repo rhysd/actionlint:1.7.7`
  -> no output; the `web` job's commands locally -> green.

- [x] Task 6. Close the issue
  Run the full checks. Tick this plan and set `Status: done`; set its line in
  docs/plans/README.md to `done`; tick 0.7a in docs/roadmap.md; point docs/handoff.md to the
  next issue, #22 Spotless (/session-summary). On the user's go-ahead, add `web` to the
  required checks on `main` (`gh api`). Scan, push, open the PR (`Closes #8`, "Android:
  later, issue #25").
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names #22;
  `gh api repos/BenWYS06/platform/branches/main/protection` lists seven checks including
  `web`; `gh pr checks` -> all seven green.

## Done when coverage (spec 007)

| Done when | Task |
|---|---|
| 1. web `npm ci`, lint, build, test pass | 1, 6 |
| 2. tests: health rows, retry disabled, same keys, contract codes | 2, 3, 4 |
| 3. live: three Up rows; chat stopped -> chat Down | 4 |
| 4. no `http(s)://` in `*.ts`/`*.vue` of `clients/web/src`; check-env passes | 4 |
| 5. CI job `web` green on the PR and required on `main` (7 checks) | 5, 6 |
| 6. web docs in CLAUDE.md, CONTRIBUTING, architecture, environments, clients/web/CLAUDE.md | 1, 5 |
