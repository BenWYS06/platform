# ai-service

Job: what Claude needs when working in `services/ai-service`. Rules: `.claude/rules/spring.md`.

Spring Boot 3.5, Java 21, a module of the root Maven build (`pom.xml` at the repo root).
Port 8082 (`AI_SERVICE_PORT`); Caddy forwards `/api/ai/*` here with the prefix kept.

## Commands

Run from the repo root (one `./mvnw` for all Java parts):

| Task | Command |
|---|---|
| Build and all tests (Docker running) | `./mvnw -pl services/ai-service -am verify` |
| Run locally (infra up first) | `./mvnw -pl services/ai-service -am spring-boot:run` |
| Run the built jar | `java -XX:-UseThreadPriorities -jar services/ai-service/target/ai-service-0.1.0-SNAPSHOT.jar` |

## Layout

- `platform/`: config record, production guard, error codes and handler, request id and
  internal key filters. Moves to `libs/platform-common-java` in issue 0.5; keep it free of
  AI logic.
- `health/`: `GET /api/ai/health`, pings MongoDB and RabbitMQ (2.5 s timeout; driver
  connect and server selection bounded at 2 s in `StoreTimeoutConfig`).
- `internal/`: `GET /internal/ping`, behind `X-Internal-Key`.
- API: `openapi.yaml`. Update it with every route change.

## Config

- Env first; locally the repo `.env` is also read (`spring.config.import`). Names in
  `.env.example`. MongoDB database `openbox_ai`.
- `APP_ENV=prod` refuses a missing, short or default `INTERNAL_API_KEY`, and a missing
  `MONGODB_URI` or `RABBITMQ_PASSWORD`. A failed start exits with code 1.

## Gotchas

- Windows: always run with `-XX:-UseThreadPriorities` (set for `spring-boot:run`; add it to
  IDE run configs). Without it, Tomcat's lowest-priority threads get starved on a busy
  machine and stall the whole JVM for seconds (health answered in 10 to 30 s).

- Tests set `app.env` and `app.internal-api-key` themselves so a local `.env` cannot change
  them.
- If the root `mvnw` loses its executable bit: `git update-index --chmod=+x mvnw`.
- The VS Code Java extension also writes to `target/`; if a build shows odd "cannot find
  symbol" errors, run `./mvnw -pl services/ai-service -am clean verify`.
