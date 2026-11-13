# Decisions

Job: a log of decisions that are hard to reverse, with the reason. Newest at the bottom. Never edit an old entry; add a new one that replaces it.

Format:

```
## D-NNN Title (YYYY-MM-DD)
Decision: what we chose.
Why: the reason.
Instead of: what we did not choose.
```

## D-001 Hooks parse JSON with node, not jq (2026-11-08)
Decision: Claude Code hook scripts read their stdin JSON with `node`.
Why: hooks must run on Windows Git Bash, where `jq` is often missing; node is needed for the project anyway.
Instead of: `jq`.

## D-002 One base URL through Caddy (2026-11-08)
Decision: every client calls one address; Caddy routes `/api/<service>` and `/ws`, and blocks `/internal`.
Why: clients never need to know service ports, and internal endpoints are never reachable from outside.
Instead of: one URL per service.

## D-003 Contract names are UPPER_SNAKE; error codes carry their HTTP status (2026-11-08)
Decision: every name in `contracts/` (error codes, capabilities, messaging and event names) is UPPER_SNAKE; RabbitMQ names keep the real broker name in a separate lower-dotted `value`. Each error code fixes its HTTP status in `error-codes.json`.
Why: UPPER_SNAKE maps straight to Java enums and TS constants; a fixed status means every service answers the same code with the same status, and clients can rely on it.
Instead of: dotted lower names (`auth.invalid_credentials`), and letting each service pick the status.

## D-004 Local dev: services on the host behind Caddy; /internal blocked by segment (2026-11-08)
Decision: locally, only the data stores and Caddy run in Docker (`infra/compose.yml`); services run on the host and Caddy forwards to `host.docker.internal`, keeping the `/api/<service>` prefix. Caddy blocks any path segment that starts with `internal` followed by a non-word character or the end, in any case, before routing. Every published port is bound to `127.0.0.1`.
Why: services restart fast from the IDE with a debugger; one gateway config is tested from day one; blocking by segment means a stripped prefix, `;params` or encoding tricks cannot open an internal route; nothing is reachable from the LAN while MongoDB, Redis and Qdrant have no auth locally.
Instead of: services in compose for local dev (later, issue 3.6), blocking only `/internal` at the root, ports on `0.0.0.0`.

## D-005 Service skeletons: pino, standalone Maven projects, health pings stores (2026-11-08)
Decision: auth-service logs with pino + pino-http. chat-service and ai-service are standalone Maven projects, each with its own wrapper. Every service's health route pings the stores it uses with a 2.5 s limit and answers 503 `SERVICE_UNAVAILABLE` when one is down; Spring Actuator is not used. `APP_ENV` names the environment in all services.
Why: pino is JSON by default, fast, and redacts headers by path. Standalone projects keep each service buildable alone and match the commands already in CLAUDE.md. A health that checks stores proves config and connections end to end, and a plain controller keeps the body in contract shape. One variable for the environment means one guard rule in all three languages.
Instead of: winston; a root parent pom with modules (issue 0.5 decides how the services consume the shared library); a liveness-only health or Actuator; `NODE_ENV` and Spring profiles.

## D-006 One Maven build at the root; Java APIs closed by default; stay on Boot 3.5 (2026-11-09)
Decision: a root `pom.xml` aggregates `packages/platform-common-java` and the Java services, with one `./mvnw`; this replaces the "standalone Maven projects" part of D-005. The library brings a stateless Spring Security chain: health and `/error` public, `/internal/**` behind the internal key, every other `/api/<service>/**` route authenticated through a JWT stub that accepts nothing until issues 1.2 and 1.4. Spring Boot stays on 3.5.
Why: one reactor builds the library before the services, so a service never runs against an old library jar. Closed by default means a route added before real tokens exist cannot be open by mistake, and unknown routes do not reveal whether they exist. Staying on 3.5 keeps Phase 0 small (owner decision); the cost is no free security fixes from Spring for 3.5.
Instead of: `mvn install` of the library before each service build, or GitHub Packages; a stub that trusts any token, or plain servlet filters without Spring Security; moving to Spring Boot 4 now.

## D-007 main is protected: PR and seven CI checks required, admins included (2026-11-09)
Decision: branch protection on `main` requires a pull request (0 approvals) and the CI jobs `contracts`, `auth-service`, `web`, `env-leak`, `repo-checks`, `java` and `secrets` to pass (`web` added with issue 0.7a); it applies to admins too; force push and deletion are blocked. The branch need not be up to date with `main` before merge. Renaming or adding a required job means updating this rule in the same PR.
Why: the repo is public with a single owner, so nothing but this rule stops a broken or leaky commit from landing on `main`. Zero approvals because GitHub does not let an author approve their own PR. Including admins makes the rule apply to the only person who merges.
Instead of: no protection and trusting the process; required reviews (impossible solo); requiring an up-to-date branch (extra rebases for little gain with one author).

## D-008 One MongoDB database; one writer service per collection (2026-11-11)
Decision: auth-, chat- and ai-service use one MongoDB database, `platform`; this replaces the "one database per service" choice in spec 004. Each collection has exactly one service that writes it; other services may read it but never write.
Why: one database is simpler to run, back up and inspect, and lets a service read another's data (for example users) without an extra internal call. One writer per collection keeps ownership clear: rules and indexes for a collection live in one service.
Instead of: one database per service (`openbox_auth`, `openbox_chat`, `openbox_ai`), or any service writing any collection.

## D-010 Spring Actuator for health; observability steps (2026-11-13)
Decision: the Spring services serve health through Spring Actuator, and observability comes in the steps below. This replaces the "no Actuator, plain health controller" parts of D-005 and spec 004.
- D-010a Actuator: chat and ai now; connector-service uses the same setup when it is created in step 5.2. `spring-boot-starter-actuator` exposes only the health endpoint (`management.endpoints.web.exposure.include=health`), with `show-details` and `show-components` set to `never`, on the same public path as today (`GET /api/<service>/health`). Every other actuator endpoint is off; a test proves the exposed web endpoints are exactly `[health]` and that `/api/<service>/env`, `/beans` and `/metrics` never answer 200 without a token; the smoke script checks `/actuator/*` through Caddy.
- D-010b Health contract for all four services, the Express auth-service too: 200 `{"status":"UP"}`, 503 `{"status":"DOWN"}`. Health is a written exception to the error-body rule `{ code, message?, params? }`. The body never names a store, host, port or exception. Pings: MongoDB for all, Redis for auth, RabbitMQ for chat and ai (as in spec 004). In the Spring services `management.health.defaults.enabled=false` and only the `mongo` and `rabbit` health indicators are enabled, so Redis never joins by itself in issue 1.4.
- D-010c The spec 004 guarantees stay: a store that hangs does not hang health beyond about 3 seconds (driver timeouts set, and a test with a hanging store; if Actuator cannot do it, stop and report to the owner); a service starts with its stores down, health answers 503, and 200 again without a restart.
- D-010d Tracing: OpenTelemetry. Spring: Micrometer Tracing with the OpenTelemetry bridge and the OTLP exporter. Express: `@opentelemetry/sdk-node` with auto-instrumentation. The trace context (W3C `traceparent`) travels in RabbitMQ message headers and Redis pub/sub payloads, so one chat request is one trace across services. Every JSON log line carries the trace id next to the request id. The message contracts in `contracts/` (fixtures for the RabbitMQ and Redis channels) get an optional `traceparent` field in step 3.0, and the tests on both sides check it; no contract change before then.
- D-010e Jaeger all-in-one runs in the dev compose profile only (OTLP on 4318, UI on 16686). An empty `OTEL_EXPORTER_OTLP_ENDPOINT` means tracing is off; a company may point it to its own collector. Nothing for Jaeger in the production compose.
- D-010f Error tracking: a Sentry-compatible DSN in env; empty means off; works with Sentry or a self-hosted GlitchTip. Lands with step 3.6 (first server deploy).
- D-010g Metrics (Prometheus, Grafana): not planned now; Actuator and Micrometer keep the door open. One line in Phase 6.
Why: there are three Spring services (chat, ai, later connector); Actuator is the standard health in Spring, and it makes later tracing and metrics easy. One health body in every service keeps clients and the smoke script simple. Each observability part is off when its env value is empty, so local dev and small installs need nothing extra.
Instead of: a plain health controller kept in every service (D-005, spec 004); a vendor-specific tracing agent; metrics now.
