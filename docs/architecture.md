# Architecture

Job: how the system fits together. Update in the same PR that changes it.

Status: Caddy, contracts, the three service skeletons and platform-common-java exist (issues
0.2 to 0.5); the rest comes from the later Phase 0 issues.

## Parts

| Part | Stack | Issue |
|---|---|---|
| Caddy | reverse proxy, one entry point | 0.3 |
| auth-service | Express + TypeScript | 0.4 |
| chat-service | Spring Boot, Java 21 | 0.4 |
| ai-service | Spring Boot, Java 21 | 0.4 |
| packages/platform-common-java | shared errors, config guards, JWT filter | 0.5 |
| contracts/ | shared error codes, capabilities, messaging, events | 0.2 |
| web | Vue 3, Vite, Tailwind v4 | 0.7a |
| android | Kotlin, Compose, Hilt (planned, issue #25) | 0.7b |

## Data stack

MongoDB (replica set), Redis, RabbitMQ, Qdrant. Runs locally with `infra/docker-compose/compose.yml` (issue 0.3).

## Routing

```
client -> Caddy :8080 -> /api/auth/*     -> auth-service  :3001
                      -> /api/chat/*     -> chat-service  :8081
                      -> /api/ai/*       -> ai-service    :8082
                      -> /api/connector  -> (TBD, issue 5.2)
                      -> /ws             -> (TBD, issue 2.2)
                         any /internal segment -> 404, never forwarded
```

- Config: `infra/docker-compose/Caddyfile`. Caddy keeps the `/api/<service>` prefix; locally it forwards to
  services on the host via `host.docker.internal` (ports from `.env`, defaults above).
- `/internal` is blocked in any case, encoded or not, and when followed by any non-word
  character (`internal;x`, `internal%09`), before routing. Services still check `X-Internal-Key`.
- Caddy answers its own errors as contract JSON: service down -> 503 `SERVICE_UNAVAILABLE`,
  unknown path or `/internal` -> 404 `NOT_FOUND`, anything else -> 500 `INTERNAL`.

## Service skeleton (every service)

- `GET /api/<service>/health`, public: pings the stores the service uses (auth: MongoDB,
  Redis; chat and ai: MongoDB, RabbitMQ) in parallel, at most 2.5 s. 200 `{"status":"UP"}`
  or 503 `{"code":"SERVICE_UNAVAILABLE"}` with no detail. A service starts with its stores
  down and recovers without a restart.
- `GET /internal/ping` on the service port: `X-Internal-Key` compared in constant time with
  `INTERNAL_API_KEY`; 401 `UNAUTHENTICATED` otherwise. Caddy answers 404 from outside.
- `APP_ENV` (`local`, `dev`, `prod`, default `local`). The production guard stops startup
  in `prod` on a missing, short (< 32) or default internal key or a missing store setting;
  messages name the variable, never the value. Startup failures exit with code 1.
- Errors: unknown route 404 `NOT_FOUND`, bad input 400 `VALIDATION_FAILED`, anything else
  500 `INTERNAL`; never a stack trace. JSON logs with a request id (`X-Request-Id` kept if
  safe, otherwise generated); no headers or bodies logged, secret headers redacted.
- One MongoDB database per service: `openbox_auth`, `openbox_chat`, `openbox_ai`.
- Java services get the error handler, guard, request id and security chain from
  `packages/platform-common-java` (auto-configuration); auth-service has its own in TypeScript.

## Java security chain (platform-common-java)

- Stateless Spring Security: no session, cookie, CSRF, form or basic login, no default user.
- `GET /api/<service>/health` and `/error`: public. `/internal/**`: right `X-Internal-Key`.
- Every other `/api/<service>/**` route is closed: a JWT stub accepts no token yet, so it
  answers 401 `UNAUTHENTICATED`, also for routes that do not exist. Issues 1.2 and 1.4 add
  real token verification; identity is then read from the security context.
- Refusals are contract JSON: 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, firewall 400
  `VALIDATION_FAILED`; never a `WWW-Authenticate` header.
- Build: one Maven reactor at the repo root (`pom.xml`, `./mvnw`): library, then services.

## Web client (apps/web)

- Vue 3, Vite, vue-router, Pinia, vue-i18n (`en`, `vi`; the browser language picks).
- `src/api/` is the only code that calls the server: relative `/api`, 5 s timeout. A
  result is the JSON body, the contract error `code`, or `NETWORK` when there is no usable
  answer. Screens map a code to the message `errors.<CODE>` (`errors.UNKNOWN` for a code
  they do not know); the server's own `message` is never shown.
- Dev: Vite serves the app and forwards `/api` to Caddy on `localhost:8080`. Serving the
  built app through Caddy comes with deploy.
- Styling: Tailwind CSS v4; the design tokens in `src/styles/tokens.css` are its theme and
  the default color palette is removed. Dark mode follows the system.
- Health screen at `/`: auth, chat and ai, checked in parallel.

## Rules that cross services

- Error responses use `{ code, message? }`; codes live in `contracts/error-codes.json`.
- Capabilities, RabbitMQ names and events live in `contracts/` too; each issue adds the names it first uses.
- Clients use a relative `/api` base URL, never a service port.
