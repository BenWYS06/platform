# Spec 004: Service skeletons: auth, chat, ai

Issue: 0.4 Service skeletons: auth, chat, ai. Sprint 1. Estimate 5.

## Why

Every Phase 1 to 3 issue adds routes to auth-service, chat-service or ai-service, and none of
them exists yet. Without a skeleton, the first feature issue would also have to settle the
build, config, logging, error shape, store connections and tests, and three services would
settle them three different ways. Caddy already routes `/api/<service>` to ports 3001, 8081
and 8082 (D-004); today every one of those answers 503.

## What we build

1. `services/auth-service/` (Express + TypeScript)
   - Node 24 LTS, TypeScript `strict`, ES modules; scripts `build`, `test`, `lint`.
   - Layout from the Express rules: `routes/` -> `services/` -> `repositories/`, plus
     `config.ts` (the only place that reads `process.env`) and one error middleware.
   - Connects to MongoDB (database `openbox_auth`) and Redis.
   - Logs: JSON with pino + pino-http; request id per request; `Authorization`,
     `Cookie` and `X-Internal-Key` redacted.
2. `services/chat-service/` and `services/ai-service/` (Spring Boot 3, Java 21)
   - Each a standalone Maven project with its own `./mvnw` (and `mvnw.cmd`).
   - Package by feature; config through `@ConfigurationProperties` records.
   - Both connect to MongoDB (databases `openbox_chat`, `openbox_ai`) and RabbitMQ, using
     the RabbitMQ login from `RABBITMQ_USER` / `RABBITMQ_PASSWORD`.
   - Logs: SLF4J with JSON output and the request id; no `System.out`.
   - No Spring Actuator endpoints exposed; health is a plain controller. Superseded by D-010.
3. Health route in every service: `GET /api/<service>/health`, no auth
   - Pings each store the service uses, with a short timeout.
   - All answer: 200 `{"status":"UP"}`.
   - Any store fails or times out: 503 `{"code":"SERVICE_UNAVAILABLE"}`. The body never
     names the store, a host, a port or an exception.
4. Internal route in every service: `GET /internal/ping`
   - Checks `X-Internal-Key` against `INTERNAL_API_KEY` with a constant-time compare
     (Node: hash both and `timingSafeEqual`; Java: `MessageDigest.isEqual`).
   - Right key: 200 `{"status":"OK"}`. Missing or wrong key: 401 `{"code":"UNAUTHENTICATED"}`,
     no detail.
5. Errors in contract shape in every service
   - Unknown route: 404 `{"code":"NOT_FOUND"}`. Unexpected error: 500 `{"code":"INTERNAL"}`,
     no stack trace or message. Bad method or body on a known route: the matching contract
     code (400 `VALIDATION_FAILED`).
   - Java: a small handler inside each service, written so issue 0.5 can move it into
     `platform-common-java` and delete the copies. No Spring whitelabel or default error JSON.
6. Production guard in every service
   - `APP_ENV` is `local`, `dev` or `prod`; anything else stops startup.
   - In `prod`, startup stops if `INTERNAL_API_KEY` is missing, shorter than 32 characters,
     or equal to the local default; or if a store URI is missing. The message names the
     variable, never its value. Exit code non-zero.
   - Outside `prod`, a missing `INTERNAL_API_KEY` uses a fixed local default and logs a
     warning that names the variable.
   - Java: inline in each service, moved to `platform-common-java` in 0.5.
7. Tests
   - auth: Vitest + supertest against the app, store pings replaced by fakes; config guard
     as unit tests.
   - chat, ai: `@WebMvcTest` for health, internal ping and the error handler; unit tests for
     the guard; one Testcontainers test per service that starts the app with real MongoDB
     and RabbitMQ and gets 200 from health.
   - Each service has a test that reads `contracts/error-codes.json` and checks every code it
     returns exists with the status it uses.
8. Smoke check `infra/smoke.mjs`
   - Store and `/internal` checks unchanged and strict.
   - `/api/<service>/health` through Caddy passes on 200 `{"status":"UP"}` or 503
     `{"code":"SERVICE_UNAVAILABLE"}`, and prints which. With `--services`, 200 is required.
   - New: `/api/auth/internal/ping` (and chat, ai) through Caddy is 404, even with a key.
9. Docs and env
   - `.env.example`: `APP_ENV`, `INTERNAL_API_KEY` (empty), `MONGODB_URI`, `REDIS_URL`; no
     real values.
   - A short `CLAUDE.md` and an `openapi.yaml` (health and internal ping) in each service.
   - Root `CLAUDE.md`: folder map status and the real commands.
   - `docs/architecture.md`, `docs/environments.md`, `CHANGELOG.md`.
   - `.claude/rules/express.md`: the log library is pino.
   - `docs/decisions.md`: D-005 for pino, separate Maven projects, and health semantics.

## Out of scope

- `platform-common-java` and moving the Java error handler and guard into it: issue 0.5.
- JWT filter, login, users, tokens: issues 0.5 and 1.1 to 1.2.
- CI running these builds: issue 0.6.
- Web and Android clients: issue 0.7.
- Qdrant in ai-service, Redis in chat-service: the issues that first use them.
- RabbitMQ exchanges and queues: issue 3.1.
- Services in Docker images or compose, production config: issue 3.6.
- Rate limiting: issue 1.1 (login is the first route that needs it).

## Edge cases

- Stores down at startup: the service still starts; health answers 503; once the stores
  are up, health answers 200 without a restart.
- A store hangs instead of refusing: health still answers within about 3 seconds.
- Port already in use: the service exits with a message naming the port.
- `X-Internal-Key` of a different length than the real key, empty, or sent twice: 401, no
  exception, no timing difference from a wrong key of the right length.
- A request id sent by the client that is not a short safe string: ignored and replaced.
- `/internal/ping` reached through Caddy in any spelling: 404 from Caddy, never forwarded.
- Windows and Linux: `./mvnw` runs in Git Bash and on Linux (executable bit set in git);
  `mvnw.cmd` runs in PowerShell; `npm test` the same on both.
- Two Testcontainers tests running in parallel: each gets its own containers.

## Must not happen

- A secret, the RabbitMQ password, a store URI with credentials, a token or the internal key
  in a log line, a health body or an error body.
- A service starts with `APP_ENV=prod` and a missing, short or default `INTERNAL_API_KEY`.
- `/internal/ping` answers 200 without the right key, or answers from outside through Caddy.
- An error response that is not `{ code, message? }`, or uses a code missing from
  `contracts/error-codes.json` or with a different status.
- A stack trace, exception message, host or port in any response.
- `process.env` read outside `config.ts`, or `@Value` scattered in Java classes.
- auth tests or Java slice tests that need the compose stack running.

## Decisions

- Health pings stores: Mongo for all; Redis for auth; RabbitMQ for chat and ai. Owner
- Java errors and guard inline now, moved to `platform-common-java` in 0.5. Owner
- auth logs: pino + pino-http. Owner
- Smoke check accepts 200 or 503 per service; `--services` requires 200. Owner
- `INTERNAL_API_KEY` and `/internal/ping` added now. Owner
- Java services are separate Maven projects with their own wrapper. Owner
- Node 24 LTS; Spring Boot 3 (latest 3.5.x); Java 21. Claude
- One database per service: `openbox_auth`, `openbox_chat`, `openbox_ai`. Claude
- `APP_ENV` (`local`, `dev`, `prod`) names the environment in all three services, instead
  of `NODE_ENV` or Spring profiles. Claude
- Local default internal key outside `prod`; in `prod` at least 32 characters. Claude
- Health is a plain controller, no Actuator, so its body is fully ours. Claude
  Superseded by D-010.
- Internal route at the root (`/internal/ping`), not under `/api/<service>`, since only other
  services call it, directly on the port. Claude

## Done when

1. `cd services/auth-service && npm ci && npm run build && npm run lint && npm test` passes.
2. `cd services/chat-service && ./mvnw verify` and `cd services/ai-service && ./mvnw verify`
   pass (Docker running for Testcontainers).
3. With the compose stack up and all three services running,
   `curl -i localhost:8080/api/auth/health` (and `/chat`, `/ai`) returns 200
   `{"status":"UP"}`, and `node infra/smoke.mjs --services` passes.
4. With MongoDB stopped (`docker compose -f infra/compose.yml stop mongo`), each health
   returns 503 `{"code":"SERVICE_UNAVAILABLE"}` within 3 seconds, and 200 again after `start`.
5. `curl -i localhost:3001/internal/ping` returns 401 without the key and 200 with
   `X-Internal-Key`; same for 8081 and 8082. Through Caddy (`localhost:8080/api/auth/internal/ping`)
   it is 404.
6. `curl -i localhost:3001/nope` (and 8081, 8082) returns 404 `{"code":"NOT_FOUND"}`.
7. Starting any service with `APP_ENV=prod` and no `INTERNAL_API_KEY` exits non-zero with a
   message naming `INTERNAL_API_KEY` (covered by a test in each service).
8. Log lines are JSON with a request id; a request with `X-Internal-Key` and
   `Authorization` headers does not show their values in the log (covered by a test in auth,
   checked by hand in chat and ai).
9. `node infra/smoke.mjs` (no `--services`) passes with services stopped and with them running.
10. `.env.example`, root `CLAUDE.md`, each service's `CLAUDE.md` and `openapi.yaml`,
    `docs/architecture.md`, `docs/environments.md`, `docs/decisions.md` (D-005),
    `.claude/rules/express.md` and `CHANGELOG.md` are updated in the same PR.
