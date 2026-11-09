# platform-common-java

Job: what Claude needs when working in `libs/platform-common-java`. Rules: `.claude/rules/spring.md`.

Shared Java code for chat-service and ai-service. A module of the root Maven build; services
depend on `com.openbox:platform-common-java` and get everything through Spring Boot
auto-configuration (`PlatformAutoConfiguration`, listed in
`META-INF/spring/...AutoConfiguration.imports`). No component scanning.

## Commands

Run from the repo root:

| Task | Command |
|---|---|
| Library tests | `./mvnw -pl libs/platform-common-java verify` |
| Library and every service (Docker running) | `./mvnw verify` |

## What is here (package `com.openbox.platform`)

- `ErrorCode`, `ApiException`, `ErrorBody`, `ApiExceptionHandler`, `ErrorFallbackController`:
  every error is `{ code }` with the contract status; `ErrorCodeContractTest` checks the codes
  against `contracts/error-codes.json`.
- `AppProperties`, `ProductionGuard`: `APP_ENV`, `INTERNAL_API_KEY`, and per service the env
  variables required in `prod` (`app.required-in-prod."[NAME]": ${NAME:}`).
- `RequestIdFilter`: request id in MDC and response, one JSON log line per request.
- `InternalKeyFilter`: `/internal/**` needs the right `X-Internal-Key` (constant time).

## Rules

- No service logic here. A change here is a change to every Java service: run `./mvnw verify`
  at the root, not only the library tests.
- Tests use `TestApp` (test sources), a minimal app wired by the auto-configuration.
