# Plan 004: Service skeletons: auth, chat, ai

Spec: docs/specs/004-service-skeletons.md
Branch: feature/service-skeletons
Rule: one task, one commit, one check. Stop after each task and show the check output.
Status: not started.

## Global Constraints

- Branch: `feature/service-skeletons` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 004.` and the attribution line.
- Claude never reads or writes `.env`. Nothing new is needed in `.env` for local runs
  (the internal key has a local default outside `prod`).
- Versions: Node 24 LTS, Spring Boot 3.5.x (latest patch), Java 21, Maven wrapper per
  service. Dependency versions pinned exactly in `package.json` / `pom.xml`.
- Java JSON logs use Spring Boot's built-in structured logging
  (`logging.structured.format.console`), no extra logging library.
- `mvnw` committed with the executable bit (`git update-index --chmod=+x`). Files are LF.
- Java error handler and production guard live in a `platform` package inside each service
  so issue 0.5 can move them as a whole.
- A task's diff (not tests) past about 200 lines: stop and ask.

## Tasks

- [x] Task 1. Spec, plan and index
  Commit spec 004, this plan and its line in `docs/plans/README.md` on
  `feature/service-skeletons`.
  Check: `git log --oneline -1` shows the docs commit on `feature/service-skeletons`;
  `git status` shows only `grep.exe.stackdump` untracked.

- [ ] Task 2. chat-service: Maven project, config and production guard (riskiest first)
  Generate a Spring Boot 3.5 project in `services/chat-service` (web, data-mongodb, amqp,
  validation, test, Testcontainers) with `./mvnw`. Add `@ConfigurationProperties` records for
  `APP_ENV`, `INTERNAL_API_KEY`, `MONGODB_URI` (db `openbox_chat`), port `CHAT_SERVICE_PORT`;
  the guard stops startup on a bad `APP_ENV`, and in `prod` on a missing, short or default key
  or a missing URI, naming the variable only. Add `APP_ENV`, `INTERNAL_API_KEY`, `MONGODB_URI`,
  `REDIS_URL` to `.env.example` (no real values).
  Check: `cd services/chat-service && ./mvnw verify` -> BUILD SUCCESS; guard unit tests cover
  bad `APP_ENV`, prod with no key, short key, default key, and local with no key (warning)
  (Done when 7 for chat); `git ls-files -s services/chat-service/mvnw` shows mode 100755.

- [ ] Task 3. chat-service: errors, internal ping, request id and JSON logs
  `platform` package: exception handler giving `{ code }` for 404, 405, 400 and 500 (no
  whitelabel, no message on 500); request-id filter (accept a safe client id or generate one,
  put it in MDC and the response); structured JSON console logs. `GET /internal/ping` with
  `X-Internal-Key` checked by `MessageDigest.isEqual`. Tests: `@WebMvcTest` for 404, 500 (no
  detail), ping 401 missing / wrong / wrong-length key, ping 200; a test that reads
  `../../contracts/error-codes.json` and checks each code and status the service uses.
  Check: `./mvnw verify` -> BUILD SUCCESS with those tests listed (Done when 5, 6 for chat).

- [ ] Task 4. chat-service: health with MongoDB and RabbitMQ pings
  `GET /api/chat/health`: Mongo `ping` and a RabbitMQ connection check, each with a timeout,
  total under 3 s; 200 `{"status":"UP"}` or 503 `{"code":"SERVICE_UNAVAILABLE"}` with no
  detail. Service starts with stores down. Slice tests with the pings faked (up, Mongo down,
  RabbitMQ timeout); one Testcontainers test starting the app with real MongoDB and RabbitMQ
  -> 200. Add `services/chat-service/CLAUDE.md` and `openapi.yaml` (health, internal ping).
  Check: `./mvnw verify` (Docker running) -> BUILD SUCCESS, Testcontainers test passes
  (Done when 2 for chat).

- [ ] Task 5. ai-service: project, config, guard, errors, internal ping, logs
  Same as Tasks 2 and 3 for `services/ai-service` (db `openbox_ai`, port `AI_SERVICE_PORT`,
  base path `/api/ai`), with the same `platform` package and tests.
  Check: `cd services/ai-service && ./mvnw verify` -> BUILD SUCCESS with guard, error, ping
  and contract tests; `mvnw` mode 100755 (Done when 5, 6, 7 for ai).

- [ ] Task 6. ai-service: health with MongoDB and RabbitMQ pings
  Same as Task 4 for ai-service, including `CLAUDE.md`, `openapi.yaml` and the
  Testcontainers test.
  Check: `./mvnw verify` -> BUILD SUCCESS, Testcontainers test passes (Done when 2 for ai).

- [ ] Task 7. auth-service: project, config and production guard
  `services/auth-service`: `package.json` (Node 24, ES modules, scripts build/test/lint/dev),
  `tsconfig.json` strict, ESLint, Vitest. `src/config.ts` is the only `process.env` reader:
  zod-validated `APP_ENV`, `INTERNAL_API_KEY`, `MONGODB_URI` (db `openbox_auth`), `REDIS_URL`,
  `AUTH_SERVICE_PORT`, with the same guard rules as Java. Port in use -> exit with a message
  naming the port.
  Check: `cd services/auth-service && npm ci && npm run build && npm run lint && npm test`
  -> all pass; config tests cover the same five guard cases as Task 2 (Done when 7 for auth);
  `grep -rn "process.env" src` lists only `src/config.ts`.

- [ ] Task 8. auth-service: app, errors, internal ping, request id and pino logs
  `src/app.ts` builds the app (no listen) for supertest; pino + pino-http with request id
  (safe client id or generated) and redaction of `authorization`, `cookie`, `x-internal-key`;
  one error middleware giving `{ code }`; 404 for unknown routes; `GET /internal/ping` with a
  hashed `timingSafeEqual` compare. Tests: 404, 500 no detail, ping 401 missing / wrong /
  wrong-length key, ping 200, log output has the request id and no header values, contract
  codes and statuses match `contracts/error-codes.json`.
  Check: `npm run build && npm run lint && npm test` -> all pass (Done when 5, 6, 8 for auth).

- [ ] Task 9. auth-service: health with MongoDB and Redis pings
  `GET /api/auth/health`: Mongo `ping` and Redis `PING`, each with a timeout, total under 3 s;
  200 / 503 as in the spec. Starts with stores down and recovers without a restart. Tests
  with the pings faked (up, Mongo down, Redis hangs -> 503 in time). Add
  `services/auth-service/CLAUDE.md` and `openapi.yaml`.
  Check: `npm run build && npm run lint && npm test` -> all pass (Done when 1).

- [ ] Task 10. Smoke check and end-to-end run
  `infra/smoke.mjs`: health per service passes on 200 UP or 503 SERVICE_UNAVAILABLE and
  prints which; `--services` requires 200; `/api/<service>/internal/ping` through Caddy with
  a key -> 404.
  Check, with the compose stack up:
  - services stopped: `node infra/smoke.mjs` -> all pass, health lines say 503 (Done when 9);
  - all three running: `node infra/smoke.mjs --services` -> all pass (Done when 3, 9);
  - `curl -i localhost:3001/internal/ping` -> 401, with `-H "X-Internal-Key: <local default>"`
    -> 200; same on 8081, 8082; `curl -i localhost:8080/api/auth/internal/ping` -> 404
    (Done when 5);
  - `curl -i localhost:{3001,8081,8082}/nope` -> 404 `{"code":"NOT_FOUND"}` (Done when 6);
  - `docker compose -f infra/compose.yml stop mongo` -> each health 503 within 3 s;
    `start mongo` -> 200 again, no restart (Done when 4);
  - a request with `Authorization` and `X-Internal-Key` to chat and ai: their log lines are
    JSON with a request id and show neither value (Done when 8).

- [ ] Task 11. Docs
  Root `CLAUDE.md` (folder map status, real commands for the three services),
  `docs/architecture.md` (services exist, health and internal routes, `APP_ENV`),
  `docs/environments.md` (new variables, health URLs), `docs/decisions.md` D-005 (pino;
  separate Maven projects; health pings stores and answers 503), `.claude/rules/express.md`
  (log library is pino), a line under `Unreleased` in `CHANGELOG.md`.
  Check: `git diff main --stat` lists `.env.example`, root and the three service `CLAUDE.md`
  files, the three `openapi.yaml`, architecture.md, environments.md, decisions.md,
  express.md and CHANGELOG.md (Done when 10).

- [ ] Task 12. Close the issue
  Run the full checks: `cd contracts && npm test`, the three service builds and tests,
  `node infra/smoke.mjs --services` with services running. Tick this plan and set
  `Status: done`; set its line in docs/plans/README.md to `done`; tick 0.4 in
  docs/roadmap.md; point docs/handoff.md to issue 0.5 (/session-summary). Scan, push, open
  the PR.
  Check: `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md;
  none of them says "merged" or a PR number; handoff "Next step" names issue 0.5.

## Done when coverage

| Spec Done when | Task |
|---|---|
| 1. auth build, lint, test pass | 7, 8, 9, 12 |
| 2. chat and ai `./mvnw verify` pass | 4, 6, 12 |
| 3. health 200 through Caddy, `smoke --services` passes | 10, 12 |
| 4. Mongo stopped -> 503 within 3 s, back to 200 | 10 |
| 5. internal ping 401 / 200 on the port, 404 through Caddy | 3, 5, 8, 10 |
| 6. unknown route -> 404 `NOT_FOUND` | 3, 5, 8, 10 |
| 7. `APP_ENV=prod` without key exits non-zero naming it | 2, 5, 7 |
| 8. JSON logs with request id, header values hidden | 8, 10 |
| 9. `smoke.mjs` passes with services stopped and running | 10 |
| 10. Docs updated in the same PR | 2, 4, 6, 9, 11 |
