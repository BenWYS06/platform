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
- `PlatformSecurityConfiguration`: one stateless Spring Security chain, closed by default.
  `GET /api/*/health` and `/error` public; `/internal/**` needs the right `X-Internal-Key`
  (`InternalKeyFilter`, constant time, role `INTERNAL`); every other `/api/**` route is
  authenticated, and `JwtStubFilter` accepts no token yet, so it answers 401. Other paths are
  open so unknown routes answer 404. No session, cookie, CSRF, form or basic login, and no
  default user (a rejecting `AuthenticationManager` stops the generated password).
- `ContractErrorHandlers`: 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, firewall rejection 400
  `VALIDATION_FAILED`, as JSON with no `WWW-Authenticate`.

## Rules

- `JwtStubFilter` must never accept a token without checking signature and expiry; issues
  1.2 and 1.4 replace it with real verification.
- No service logic here. A change here is a change to every Java service: run `./mvnw verify`
  at the root, not only the library tests.
- Tests use `TestApp` (test sources), a minimal app wired by the auto-configuration.
