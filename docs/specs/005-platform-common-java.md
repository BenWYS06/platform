# Spec 005: platform-common-java library

Issue: 0.5 platform-common-java library (#6). Sprint 1. Estimate 2.

## Why

chat-service and ai-service each carry a copy of the same `platform` package (errors,
production guard, request id, internal key). Copies drift: a fix in one service is missed in
the other. Phase 1 adds identity to every route, and `spring.md` says identity comes from a
shared JWT filter through the Spring Security context. Both need one shared library first,
and new routes must be closed by default before any of them exists.

## What we build

1. One Maven build at the repo root
   - `pom.xml` at the root: packaging `pom`, parent `spring-boot-starter-parent` 3.5.16,
     modules `libs/platform-common-java`, `services/chat-service`, `services/ai-service`.
   - One `./mvnw` (and `mvnw.cmd`) at the root; the wrappers in the two services are removed.
   - Shared plugin config in the root pom, including `-XX:-UseThreadPriorities` for
     `spring-boot:run`.
2. `libs/platform-common-java` (package `com.openbox.platform`)
   - Moved from the services, unchanged in behavior: error codes, `ApiException`, error
     body, exception handler, `/error` fallback, request-id filter with the JSON request log,
     internal key check, production guard.
   - Spring Boot auto-configuration: a service gets all of it by adding the dependency.
   - Production guard: each service lists the env variables it needs in `prod`
     (chat and ai: `MONGODB_URI`, `RABBITMQ_PASSWORD`); the guard names the missing one.
   - Tests moved with the code, plus the contract test against `contracts/error-codes.json`.
3. Spring Security in the library
   - One stateless filter chain: no session, no cookie, CSRF, form login, basic auth and
     logout off; no generated default user or password.
   - Public: `GET /api/<service>/health` and `/error`.
   - `/internal/**`: allowed only with the right `X-Internal-Key` (constant-time compare).
   - Any other `/api/<service>/**` route: JWT stub that never authenticates, so 401
     `{"code":"UNAUTHENTICATED"}`. Issues 1.2 and 1.4 replace the stub with real checks.
   - Paths outside `/api` and `/internal` stay open so unknown routes still answer 404.
   - 401, 403 and requests rejected by the firewall answer contract JSON:
     `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`.
4. Services
   - chat-service and ai-service delete their `platform` package and depend on the library.
   - They keep their own health, internal ping controller and integration test; one new
     test each: an `/api/<service>/` route other than health answers 401.
5. Docs
   - Root `CLAUDE.md` (commands, folder map), each service `CLAUDE.md`, a short
     `libs/platform-common-java/CLAUDE.md`, `.claude/rules/spring.md` (build command),
     `docs/architecture.md`, `docs/decisions.md` (D-006), `CHANGELOG.md`.

## Out of scope

- Real token verification, the user in the security context: issues 1.2 and 1.4.
- Roles, capabilities, 403 rules per route: issue 1.3.
- auth-service: Node, keeps its own code.
- Running the build in CI: issue 0.6.
- Spring Boot 4: not planned (owner decision); see Decisions.

## Edge cases

- `GET /api/chat/health` with a garbage `Authorization` header: still 200; the header is
  ignored on public routes.
- `/api/chat/anything` with any `Bearer` token: 401, because the stub accepts nothing.
- `/api/chat/nope` (no such route): 401, not 404. Auth is checked before the route, so
  closed routes do not reveal whether they exist.
- `/nope` outside `/api`: 404 `NOT_FOUND`, as in 0.4.
- Path tricks Spring Security's firewall rejects (`;jsessionid=`, encoded `/`, `//`): 400
  `VALIDATION_FAILED` JSON, never an HTML page.
- A library change that breaks a service: the root `./mvnw verify` fails in that service.
- One service alone: `./mvnw -pl services/chat-service -am verify` builds the library first.
- Windows and Linux: root `./mvnw` in Git Bash and Linux, `mvnw.cmd` in PowerShell.

## Must not happen

- An `/api/<service>/` route other than health answers without authentication.
- A token is trusted without verification.
- "Using generated security password" in a log, a `JSESSIONID` cookie, or a
  `WWW-Authenticate: Basic` header.
- A Spring default error page or JSON instead of `{ code }`.
- A copy of a moved class left in a service.
- A service built against an old, separately installed library jar.
- Any 0.4 behavior changed other than unknown `/api/<service>/` routes becoming 401.

## Decisions

- Services use the library through a root aggregator pom with one `./mvnw`. Owner
- Stay on Spring Boot 3.5, no migration planned. Risk: no free security fixes from Spring
  for 3.5. Owner
- JWT stub denies by default. Owner
- Spring Security in the library now. Owner
- A short spec for this 2-point issue. Owner
- Package `com.openbox.platform`, artifact `com.openbox:platform-common-java`, version from
  the root pom. Claude
- Wired through Spring Boot auto-configuration, not component scanning. Claude
- Unknown `/api/<service>/` routes answer 401 rather than 404. Claude
- The root pom replaces the "separate Maven projects" part of D-005 with a new entry D-006. Claude

## Done when

1. `./mvnw verify` at the repo root passes: library tests and both services, Docker running.
2. `./mvnw -pl services/chat-service -am verify` passes and builds only the library and
   chat-service.
3. `git grep -l "class ProductionGuard"` lists only a file under `libs/`, and neither service
   has a `platform` package or its own `mvnw`.
4. With infra and both services running: `node infra/smoke.mjs --services` passes;
   `curl -i localhost:8081/api/chat/anything -H "Authorization: Bearer x"` gives 401
   `{"code":"UNAUTHENTICATED"}` with no `Set-Cookie` and no `WWW-Authenticate`; same on 8082.
5. `curl -i localhost:8081/internal/ping` is 401 without the key and 200 with it;
   `localhost:8081/nope` is 404 `NOT_FOUND`; `localhost:8081/api/chat/health` is 200
   (same on 8082).
6. The startup log of each service has no "Using generated security password".
7. Starting a service with `APP_ENV=prod` and no `INTERNAL_API_KEY` exits 1 naming the
   variable (library test, and once by hand).
8. The docs listed under "What we build" item 5 are updated in the same PR.
