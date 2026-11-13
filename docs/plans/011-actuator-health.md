# Plan 011: Health with Spring Actuator

Issue: #40, its "Done when" list. Short plan: health only, decided in D-010a to D-010c,
no spec.
Branch: chore/actuator-health
Status: in progress
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `chore/actuator-health` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 011.` and the attribution line.
- `spring-boot-starter-actuator` comes from the Spring Boot BOM (Boot 3.5, D-006); no
  other new package.
- Health body in every service (D-010b): 200 `{"status":"UP"}`, 503 `{"status":"DOWN"}`,
  nothing else; never a store, host, port or exception name.
- Caddy still answers 503 `{"code":"SERVICE_UNAVAILABLE"}` when a service is not running at
  all; clients and the smoke script accept both 503 bodies.
- If Actuator cannot keep health within about 3 seconds while a store hangs (D-010c): stop
  and tell the owner. Do not fall back to a plain controller without asking.
- A task diff over about 200 lines (not tests): stop and ask.

## Tasks

- [x] Task 1. auth-service health body, smoke script and web
  auth-service `GET /api/auth/health` answers 503 `{"status":"DOWN"}` instead of the error
  body; 200 stays `{"status":"UP"}`; tests updated; `openapi.yaml` updated.
  `infra/docker-compose/smoke.mjs` accepts 503 `{"status":"DOWN"}` (service up, a store down)
  and Caddy's 503 `{"code":"SERVICE_UNAVAILABLE"}` (service not running).
  `apps/web/src/api/health.ts` reads 503 `{"status":"DOWN"}` as down with code
  `SERVICE_UNAVAILABLE`, with a test.
  Check: `cd apps/server/auth-service && npm run build && npm run lint && npm test` -> all
  pass, the health tests compare the exact bodies `{"status":"UP"}` and `{"status":"DOWN"}`;
  `cd apps/web && npm run lint && npm run build && npm test` -> all pass; infra up, auth
  running, `node infra/docker-compose/smoke.mjs` -> the auth health line passes with
  `200 UP`; MongoDB stopped -> the same line shows `503 DOWN`.

- [x] Task 2. chat-service: Actuator
  Add `spring-boot-starter-actuator`. `application.yml`: exposure `include: health`,
  `show-details: never`, `show-components: never`, base path and mapping so health stays
  at `GET /api/chat/health`; every other endpoint off. Remove `HealthController`,
  `HealthService` and their tests. `management.health.defaults.enabled=false`, and only
  the `mongo` and `rabbit` health indicators enabled, so no other indicator (disk space,
  Redis in issue 1.4) joins by itself. Driver timeouts stay bounded
  (`StoreTimeoutConfig`). Tests: 200 UP with stores up; 503 DOWN with MongoDB stopped and
  200 again after it is back, no restart; a hanging store (a socket that accepts and never
  answers) gives 503 within about 3 s; the exposed web endpoints are exactly `[health]`;
  `/api/chat/env`, `/api/chat/beans` and `/api/chat/metrics` never answer 200 without a
  token. `openapi.yaml` updated. The security chain keeps health public (D-006).
  Check: `./mvnw -B -pl apps/server/chat-service -am verify` -> BUILD SUCCESS, the new
  health tests run and pass, the hanging-store test shows a time under 3 s;
  `git grep -n "HealthController\|HealthService" -- apps/server/chat-service` -> no output;
  `./mvnw -B spotless:check` -> BUILD SUCCESS.

- [ ] Task 3. ai-service: Actuator
  The same as Task 2 for ai-service (`GET /api/ai/health`, only the `mongo` and `rabbit`
  indicators; exposed web endpoints exactly `[health]`; `/api/ai/env`, `/api/ai/beans` and
  `/api/ai/metrics` never answer 200 without a token).
  `infra/docker-compose/smoke.mjs` checks that `/actuator/env`, `/actuator/beans` and
  `/actuator/metrics` answer 404 through Caddy.
  Check: `./mvnw -B -pl apps/server/ai-service -am verify` -> BUILD SUCCESS, the new health
  tests pass, the hanging-store test shows a time under 3 s;
  `git grep -n "HealthController\|HealthService" -- apps/server/ai-service` -> no output;
  all three services running, `node infra/docker-compose/smoke.mjs --services` -> all three
  health lines `200 UP`, the actuator lines 404.

- [ ] Task 4. Docs
  `docs/architecture.md` (service skeleton health line), the `CLAUDE.md` of auth-, chat-
  and ai-service, and the rules text for the health exception (`CLAUDE.md` rule on errors,
  `.claude/rules/security.md`, `.claude/rules/express.md`, `.claude/rules/spring.md`).
  Spec 004 gets a "Superseded by D-010" note at the top.
  Check: `git grep -n "SERVICE_UNAVAILABLE" -- docs/architecture.md "apps/server/*/CLAUDE.md"`
  -> no health line; `grep -n "D-010" CLAUDE.md .claude/rules/security.md
  docs/specs/004-service-skeletons.md` -> prints a line for each.

- [ ] Task 5. Close the issue
  Run the full checks (contracts, auth-service, web, `./mvnw verify`, repo checks,
  gitleaks). Tick this plan and set `Status: done`; set its line in docs/plans/README.md to
  `done`; tick the line in docs/roadmap.md; point docs/handoff.md to the next issue
  (/session-summary). Scan, push, open the PR (`Closes #40`).
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; `gh pr checks` -> all seven green.

## Done when coverage (issue #40)

| Done when | Task |
|---|---|
| Every service answers health 200 `{"status":"UP"}` or 503 `{"status":"DOWN"}` (D-010b) | 1, 2, 3 |
| chat and ai serve health through Actuator; no other actuator endpoint (D-010a) | 2, 3 |
| A hanging store does not hang health beyond about 3 s; recovery without restart (D-010c) | 2, 3 |
| Smoke script and web accept the new body | 1, 3 |
| Docs and rules name the health exception; spec 004 marked superseded | 4 |
