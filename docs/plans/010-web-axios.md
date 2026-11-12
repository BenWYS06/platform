# Plan 010: Use axios in the web api layer

Issue: #37, its "Done when" list. Short plan: 1 point, web client only, no contract change, no spec.
Branch: chore/web-axios
Status: in progress
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `chore/web-axios` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Change only `apps/web` files named here and the docs named here. Nothing else.
- axios pinned exactly to `1.21.0` (published 2026-10-27, 16 days old). `1.21.1` is under two
  weeks old. No other web dependency is added or removed.
- No test is removed. Every test that exists today still runs and checks the same behavior.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 010.` and the attribution line.
- Test approach (decided while reading axios 1.21.0): its fetch adapter wraps the URL in
  `new Request(url)`, which throws for the relative `/api` URL under Node, so stubbing the
  global `fetch` no longer works. Tests use an adapter mock instead: `http.ts` exports its
  axios instance, and the tests set a fake adapter on it (tests never import axios). axios
  runs the timeout inside the adapter, so the timeout test checks that the request carries
  `timeout: 5000` and that an axios timeout error gives `NETWORK`.

## Tasks

- [x] Task 1. axios dependency
  `npm install --save-exact axios@1.21.0` in `apps/web`. No code uses it yet.
  Check: `git diff --stat` -> only `apps/web/package.json` and `apps/web/package-lock.json`;
  `package.json` diff is one added line `"axios": "1.21.0"`; `npm run build`, `npm run lint`,
  `npm test` pass (5 test files, same test count as on main).

- [x] Task 2. http.ts on axios, tests adapted
  `src/api/http.ts` replaces the fetch code (AbortController, timer, `readJson`) with one
  axios instance: `baseURL: '/api'`, `timeout: 5000`, `validateStatus: () => true` (error
  bodies are read, not thrown), `Accept: application/json`, `responseType: 'json'` and
  `transitional.silentJSONParsing: false`, so axios parses the body and broken JSON throws.
  A body that is not `application/json` or is empty is no body. Any thrown error (timeout,
  no answer, broken JSON) gives `NETWORK`. `getJson` keeps its signature; `health.ts` does
  not change.
  Tests: `tests/api.test.ts`, `tests/health.test.ts` and `tests/app.test.ts` replace the
  `fetch` stubs with a fake adapter (one shared helper in `tests/`, used by all three files).
  Same test names, same expectations.
  Check: `npm run build`, `npm run lint`, `npm test` pass with the same test count as Task 1;
  `grep -rn "fetch" apps/web/src` -> no call to `fetch`.

- [ ] Task 3. Lint rule and docs
  `eslint.config.js`: add `no-restricted-imports` for `axios` (same "Only src/api/" message)
  to the `**/*.ts`, `**/*.vue` block, and turn it off in the `src/api/**` block.
  Docs say "axios in src/api only" in place of "fetch": `apps/web/CLAUDE.md` (src/api line),
  `.claude/rules/vue.md` (HTTP line), `docs/architecture.md` (web client `src/api/` line).
  Check: a throwaway `tests/axios-probe.test.ts` with `import axios from 'axios';` ->
  `npx eslint tests/axios-probe.test.ts` fails on `no-restricted-imports`; the probe is
  deleted and `npm run lint` passes; `git status` shows no probe file;
  `grep -n "fetch" apps/web/CLAUDE.md .claude/rules/vue.md docs/architecture.md` -> no hit
  that says the api layer uses fetch.

- [ ] Task 4. Close the issue
  Run the full web checks. Tick this plan and set `Status: done`; add its line to
  `docs/plans/README.md` as `done`; add `- [x] Use axios in the web api layer (1, #37)` to
  `docs/roadmap.md` under Phase 0 next to #22; point `docs/handoff.md` to issue 1.1a First
  owner (#34) (/session-summary). Scan, push, open the PR (`Closes #37`). Do not merge.
  Check: `git diff main --stat` lists only files named in this plan; none of the docs says
  "merged" or a PR number; `gh pr checks` -> all green, the `web` job passes.

## Done when coverage (issue #37)

| Done when | Task |
|---|---|
| axios at an exact version two weeks old; no other web dependency changes | 1 |
| `http.ts` uses axios (timeout 5000, `validateStatus`); behavior unchanged | 2 |
| Existing web tests pass, adapted, none removed; build, lint, test pass | 2, 4 |
| Lint bans importing axios outside `src/api`; a test file that does fails lint | 3 |
| `apps/web/CLAUDE.md`, `vue.md`, `architecture.md` say "axios in src/api only" | 3 |
| `web` CI job green on the PR | 4 |
