# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-19

## Now

- Issue: #52 auth-service organised by feature (D-012): done on
  `chore/auth-service-structure`, PR next (the user says when to push)
- Plan: [plans/013-auth-service-structure.md](plans/013-auth-service-structure.md), done

## Done

- Plan 013 Tasks 1 to 11: auth-service `src/` moved by feature (`common/`, `infra/`,
  `middleware/`, `modules/users|invitations|auth|auth/session|health|internal|bootstrap`)
  with `git mv`, imports and paths only, an `index.ts` per module; tests next to their
  file, whole-app tests in `test/`; lint enforces the module and layer import rules;
  `scripts/ci/check-structure.mjs` (with tests) in CI; `check-file-size.mjs` follows the
  new names; rules in `.claude/rules/express.md` and the auth `CLAUDE.md`; old plans' paths.
- Owner allowed local runs for this plan: build, lint, all 193 auth tests (same count as
  `main`), contracts and the repo checks pass.
- Plan 012b (1.2b) was merged as PR #51.

## Next step: open the #52 PR, then 1.3

1. When the user says so: scan, push `chore/auth-service-structure`, open the PR with
   `Closes #52`. Read `gh pr checks` once; fix all red checks in one commit and push again.
2. The user reads the diff (`git diff -M --stat main` shows renames) and merges.
3. Then 1.3 Capabilities, roles, workspace settings (no issue number yet): branch from an
   up-to-date `main`, `/write-spec` (contract and security change). New code goes in
   `src/modules/<feature>/` (express.md rules 1 to 5).
4. Later issue: the same feature layout for Java (chat, ai) and web.

## Known gaps

- No grace window on refresh: two tabs refreshing at once log out (fixed in 1.6).
- Events are published, but no service listens yet (1.4).
- Burst limits use a memory store: per process, reset on restart (fine for one instance).
- The login burst test relies on 6 fast requests within 1 second; a CI stall over 1 s would
  make it flaky (user chose to keep it as is).
- The route path test sees routers mounted with `app.use`; a router nested inside another
  router would not be listed (none exists).
- Revoke scripts name session keys outside `KEYS`: fine on one Redis node, not Redis Cluster.
- Actuator runs health indicators one after another: with MongoDB and RabbitMQ both
  hanging, chat and ai health take about 4 s. Its failed-check log line can name store hosts
  (logs only, never the response).
- `.env` is read by Docker compose and by Spring differently: quotes, trailing spaces and
  `# comments` stay in the value for Spring. Keep values bare. RabbitMQ takes
  `RABBITMQ_USER` and `RABBITMQ_PASSWORD` only when its volume is new.
- No web page for `/invite/<token>` yet (roadmap 1.6); accept the boot link with curl.
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs.
- Vitest on Windows fails every suite when the shell path starts with lowercase `d:`; run
  it from `D:/openbox/...`. CI (Linux) is not hit.
- A running auth-service locks the argon2 native file; stop it before `npm ci`.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Spring Boot 3.5 gets no free security fixes (owner decision, D-006).
- `CONTRIBUTING.md` loop step 2 still says "3+ points: spec" (rule is now 5+; tiny fix).

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.
