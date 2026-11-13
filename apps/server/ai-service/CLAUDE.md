# ai-service

Job: what Claude needs when working in `apps/server/ai-service`. Rules: `.claude/rules/spring.md`.

Spring Boot 3.5, Java 21, a module of the root Maven build (`pom.xml` at the repo root).
Port 8082 (`AI_SERVICE_PORT`); Caddy forwards `/api/ai/*` here with the prefix kept.

## Commands

Run from the repo root (one `./mvnw` for all Java parts):

| Task | Command |
|---|---|
| Build and all tests (Docker running) | `./mvnw -pl apps/server/ai-service -am verify` |
| Run locally (infra up first) | `./mvnw -pl apps/server/ai-service -am spring-boot:run` |
| Run the built jar | `java -XX:-UseThreadPriorities -jar apps/server/ai-service/target/ai-service-0.1.0-SNAPSHOT.jar` |

## Layout

- Errors, production guard, request id and internal key come from
  `packages/platform-common-java` (package `com.openbox.platform`); throw `ApiException`.
- Health: Spring Actuator, configured in `application.yml` (D-010a). `GET /api/ai/health`
  answers 200 `{"status":"UP"}` or 503 `{"status":"DOWN"}`; only the `mongo` and `rabbit`
  indicators run, and health is the only actuator endpoint. `health/StoreTimeoutConfig`
  bounds MongoDB server selection and connect and the RabbitMQ handshake at 2 s, so a
  hanging store answers 503 within 3 s. Indicators run one after another: two hanging
  stores take about 4 s. Clients send `Accept: application/json` (otherwise Actuator's own
  media type).
- `internal/`: `GET /internal/ping`, behind `X-Internal-Key`.
- API: `openapi.yaml`. Update it with every route change.

## Config

- Env first; locally the repo `.env` is also read (`spring.config.import`). Names in
  `.env.example`. MongoDB database `platform`.
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
  symbol" errors, run `./mvnw -pl apps/server/ai-service -am clean verify`.
