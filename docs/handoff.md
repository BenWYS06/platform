# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-19

## Now

- Change: test gate replaces Work mode (D-013), on `chore/test-gate`, no issue number
  yet. Five commits (inspect, coverage tooling, scripts, CI, rules and docs); not pushed.
- Issue #52 (auth-service by feature, plan 013) was merged as PR #53.

## Done

- Coverage: `@vitest/coverage-v8` in auth-service and web (`npm run test:cov`), JaCoCo in
  the root pom (`./mvnw verify` writes `target/site/jacoco/jacoco.csv`).
- `scripts/test-all.sh [part...]`: lint, build, tests with coverage, then the gate; switches
  to an uppercase drive for Vitest. `scripts/ci/coverage-gate.sh <part>` with
  `scripts/ci/coverage-thresholds.txt` (auth-service 91, web 94, platform-common-java 85,
  chat-service 59, ai-service 59). Tests in `scripts/ci/test/`.
- CI: each test job runs `test-all.sh --no-gate <part>`, then a coverage gate step per part;
  repo-checks also checks that every gated part has a threshold.
- Rules: `.claude/rules/test-gate.md`; Work mode removed from `CLAUDE.md`; `testing.md`,
  `git-and-docs.md`, `CONTRIBUTING.md` and the write-plan skill use the test-first task
  shape and the QA task.

## Next step: open the test gate PR, then 1.3

1. When the user says so: scan, push `chore/test-gate`, open the PR. Read `gh pr checks`
   once; fix all red checks in one commit and push again. The user merges.
2. Then 1.3 Capabilities, roles, workspace settings (no issue number yet): branch from an
   up-to-date `main`, `/write-spec` (contract and security change). Plans now use the
   test-first task shape and end with a QA task (`bash scripts/test-all.sh <parts>`).
3. Later issue: the same feature layout for Java (chat, ai) and web.

## Known gaps

- No grace window on refresh: two tabs refreshing at once log out (fixed in 1.6).
- Events are published, but no service listens yet (1.4).
- Burst limits use a memory store: per process, reset on restart (fine for one instance).
- The login burst test relies on 6 fast requests within 1 second; a CI stall over 1 s would
  make it flaky (user chose to keep it as is).
- Flaky under a full local auth run (all 29 files in parallel), with or without coverage, on
  2026-11-19: "answers 30 successful logins from one IP all with 200" (30 argon2 logins
  pass the 5 s timeout) and "answers the 101st refresh within a second ... 429". Each passes
  alone. Not fixed; needs the user's decision (issue to write).
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
- Vitest on Windows fails every suite when Node starts from a lowercase `d:`;
  `test-all.sh` switches to `D:/`; a narrow run by hand needs `cd D:/openbox/...`.
- chat-service and ai-service line coverage is 60% (9 of 15 lines); each has only
  Testcontainers tests so far. Goal backend 90.
- Docker must run for auth-service, chat-service and ai-service tests.
- A running auth-service locks the argon2 native file; stop it before `npm ci`.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Spring Boot 3.5 gets no free security fixes (owner decision, D-006).
- `CONTRIBUTING.md` loop step 2 still says "3+ points: spec" (rule is now 5+; tiny fix).

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.
