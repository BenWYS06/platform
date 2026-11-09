# Plan 005: platform-common-java library

Spec: docs/specs/005-platform-common-java.md
Branch: feature/platform-common-java
Rule: one task, one commit, one check. Stop after each task and show the check output.
Status: not started.

## Global Constraints

- Branch: `feature/platform-common-java` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 005.` and the attribution line.
- Claude never reads or writes `.env`.
- Spring Boot stays 3.5.16 (owner decision). Java runs on Windows with
  `-XX:-UseThreadPriorities`.
- Moved code keeps its behavior; only the package changes, plus what the spec lists.
- `mvnw` committed with the executable bit. Files are LF (`mvnw.cmd` CRLF).
- A task's diff (not tests, not moves) past about 200 lines: stop and ask.

## Tasks

- [x] Task 1. Spec, plan and index
  Commit spec 005, this plan and its line in `docs/plans/README.md` on
  `feature/platform-common-java`.
  Check: `git log --oneline -1` shows the docs commit on `feature/platform-common-java`;
  `git status` shows only `grep.exe.stackdump` untracked.

- [ ] Task 2. Root aggregator pom and one wrapper
  Root `pom.xml` (packaging `pom`, parent Boot 3.5.16, modules chat and ai for now, shared
  `spring-boot-maven-plugin` config with `-XX:-UseThreadPriorities`); root `mvnw`,
  `mvnw.cmd`, `.mvn/wrapper`; services take the root pom as parent and lose their wrappers.
  Update the build and run commands in root `CLAUDE.md`, both service `CLAUDE.md` files and
  `.claude/rules/spring.md`.
  Check: `./mvnw verify` at the root -> BUILD SUCCESS, reactor lists chat-service and
  ai-service, 25 tests each; `./mvnw -pl services/chat-service verify` -> only chat-service
  builds; `git ls-files services | grep mvnw` -> empty; `git ls-files -s mvnw` -> 100755
  (Done when 2 in part, 3 in part).

- [ ] Task 3. Library module with the moved platform code
  Create `libs/platform-common-java` (module in the root pom): the `platform` classes from
  chat-service in `com.openbox.platform`, Spring Boot auto-configuration
  (`AutoConfiguration.imports`), the guard reading a per-service map of variables required in
  `prod`; move the platform tests (guard, web, contract) and adapt them to a test app. Add
  `libs/platform-common-java/CLAUDE.md`. Services do not use it yet.
  Check: `./mvnw -pl libs/platform-common-java verify` -> BUILD SUCCESS; guard tests cover bad
  `APP_ENV`, prod without key, short key, default key, a missing required variable named in
  the message, and local default with warning (Done when 7, library test).

- [ ] Task 4. Services use the library
  chat-service and ai-service depend on `platform-common-java`, delete their `platform`
  package and its tests, import from `com.openbox.platform`, and list their prod variables
  (`MONGODB_URI`, `RABBITMQ_PASSWORD`) in `application.yml`.
  Check: `./mvnw verify` at the root -> BUILD SUCCESS for library, chat and ai;
  `./mvnw -pl services/chat-service -am verify` -> builds library then chat only;
  `git grep -l "class ProductionGuard"` -> only `libs/...`; no `platform` folder under
  `services/*/src` (Done when 1, 2, 3).

- [ ] Task 5. Spring Security filter chain with deny-by-default JWT stub
  In the library: one stateless `SecurityFilterChain` (no session, CSRF, form, basic, logout;
  no `UserDetailsService` auto-config); public `GET /api/*/health` and `/error`;
  `/internal/**` behind the internal key filter; other `/api/**` through a JWT stub filter
  that never authenticates; other paths open. Entry point, access-denied handler and
  firewall rejection answer `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED` JSON. Tests
  in the library (401 with and without `Bearer`, health public with a garbage header, ping
  401/200, `/nope` 404, `;jsessionid=` 400 JSON, no `Set-Cookie`, no `WWW-Authenticate`) and
  one test per service (`/api/<service>/anything` -> 401).
  Check: `./mvnw verify` at the root -> BUILD SUCCESS with the new tests listed
  (Done when 1).

- [ ] Task 6. Docs and end-to-end run
  Update `docs/architecture.md` (library, security chain, 401 for closed routes),
  `docs/decisions.md` D-006 (root aggregator replaces the standalone part of D-005; Spring
  Security deny by default; stay on Boot 3.5 with the risk), `CHANGELOG.md`. Then run
  everything for real.
  Check, with the compose stack up and chat and ai started from the root
  (`./mvnw -pl services/chat-service spring-boot:run`, same for ai) and auth running:
  - `node infra/smoke.mjs --services` -> all pass (Done when 4);
  - `curl -i localhost:8081/api/chat/anything -H "Authorization: Bearer x"` -> 401
    `{"code":"UNAUTHENTICATED"}`, no `Set-Cookie`, no `WWW-Authenticate`; same on 8082
    (Done when 4);
  - `/internal/ping` 401 without key, 200 with it; `/nope` 404; `/api/<service>/health` 200,
    on 8081 and 8082 (Done when 5);
  - `grep -c "generated security password"` on both startup logs -> 0 (Done when 6);
  - start chat with `APP_ENV=prod` and no `INTERNAL_API_KEY` -> exits 1 naming it
    (Done when 7);
  - `git diff main --stat` lists root and service `CLAUDE.md`, the library `CLAUDE.md`,
    `spring.md`, architecture.md, decisions.md, CHANGELOG.md (Done when 8).

- [ ] Task 7. Close the issue
  Run the full checks: `cd contracts && npm test`, root `./mvnw verify`, auth-service build
  and tests, `node infra/smoke.mjs --services` with services running. Tick this plan and set
  `Status: done`; set its line in docs/plans/README.md to `done`; tick 0.5 in
  docs/roadmap.md; point docs/handoff.md to issue 0.6 (/session-summary). Scan, push, open
  the PR with `Closes #6`.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names issue 0.6.

## Done when coverage

| Spec Done when | Task |
|---|---|
| 1. Root `./mvnw verify` passes | 4, 5, 7 |
| 2. `-pl services/chat-service -am verify` builds library and chat only | 2, 4 |
| 3. `ProductionGuard` only under `libs/`; no service `platform` package or `mvnw` | 2, 4 |
| 4. Smoke `--services` passes; closed route 401, no cookie, no `WWW-Authenticate` | 6 |
| 5. Ping 401/200, `/nope` 404, health 200 on 8081 and 8082 | 6 |
| 6. No generated security password in startup logs | 6 |
| 7. `APP_ENV=prod` without key exits 1 naming it | 3, 6 |
| 8. Docs updated in the same PR | 2, 3, 6 |
