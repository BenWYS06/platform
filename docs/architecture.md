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

- `GET /api/<service>/health`, public: checks the stores the service uses (auth: MongoDB,
  Redis; chat and ai: MongoDB, RabbitMQ). 200 `{"status":"UP"}` or 503 `{"status":"DOWN"}`
  with no detail (D-010b), the one written exception to the error body. A hanging store
  answers 503 within about 3 s. A service starts with its stores down and recovers without
  a restart. chat and ai serve it through Spring Actuator, health the only endpoint
  (D-010a); auth through Express.
- `GET /internal/ping` on the service port: `X-Internal-Key` compared in constant time with
  `INTERNAL_API_KEY`; 401 `UNAUTHENTICATED` otherwise. Caddy answers 404 from outside.
- `APP_ENV` (`local`, `dev`, `prod`, default `local`). The production guard stops startup
  in `prod` on a missing, short (< 32) or default internal key or a missing store setting;
  messages name the variable, never the value. Startup failures exit with code 1.
- Errors: unknown route 404 `NOT_FOUND`, bad input 400 `VALIDATION_FAILED`, anything else
  500 `INTERNAL`; never a stack trace. JSON logs with a request id (`X-Request-Id` kept if
  safe, otherwise generated); no headers or bodies logged, secret headers redacted.
- One MongoDB database, `platform`, for all services. Each collection has one writer
  service; the others only read it (D-008).
- Java services get the error handler, guard, request id and security chain from
  `packages/platform-common-java` (auto-configuration); auth-service has its own in TypeScript.

## Observability

Decided in D-010. Health has this shape since plan 011; tracing comes with step 3.0,
error tracking with step 3.6. Each part is off while its env value is empty.

```
GET /api/<service>/health  -> 200 {"status":"UP"} | 503 {"status":"DOWN"}  (no detail)
                              chat, ai: Spring Actuator, health only; auth: Express

service --OTLP--> OTEL_EXPORTER_OTLP_ENDPOINT -> Jaeger (dev compose profile, UI 16686)
                                                 or the company's own collector
chat --RabbitMQ headers / Redis payloads: traceparent--> ai   (one trace per chat request)

JSON log line: request id and trace id side by side
errors -> Sentry-compatible DSN (Sentry or GlitchTip); off by default
```

## auth-service

- MongoDB through Mongoose (D-009): models in `src/models`, wrapped by repositories;
  routes never import Mongoose. Indexes come from the schemas (`syncIndexes` at startup).
- First owner (1.1a): while no user exists, each boot replaces the pending owner invitation
  and writes `<WEB_ORIGIN>/invite/<token>` once to stdout. `POST
  /api/auth/invitations/<token>/accept-password` (public, the token is the proof) checks
  the token shape (404 with no lookup), the body, then the invitation (404 unknown, 410
  expired or revoked, 409 used) and the email (409 `MEMBER_ALREADY_EXISTS`). One atomic
  update claims the invitation; the user gets the invitation's email and role and an
  argon2id hash. If creating the user fails, the invitation goes back to pending. 201
  `{ user }`. After the token shape, a failure limit applies: 20 token-check failures (404,
  410, 409 `INVITATION_ALREADY_ACCEPTED`, malformed tokens) per client IP in a 15-minute
  fixed window in Redis, then 429 `RATE_LIMITED` with `Retry-After` equal to
  `params.retryAfterSeconds`; successes never count; Redis down answers 503. The client IP is
  `CLIENT_IP_HEADER` when set and valid, otherwise `req.ip` under `TRUST_PROXY`
  (`docs/environments.md`). Only the sha256 of a token is stored; logs show the token as `[redacted]`.
- Login (1.1b): `POST /api/auth/login` (public) takes `{ email, password }`; the email is
  trimmed and lower-cased (at most 254 characters). Fixed order: email locked (5 failures)
  or client IP over its limit (20 failures), 429; find the user; check the password, against
  a dummy argon2id hash made once at startup for an unknown email, so both answer the same
  401 `INVALID_CREDENTIALS`; a blocked user with the right password gets 403
  `ACCOUNT_BLOCKED`. Success creates a session and answers tokens (1.2a, below). Failure
  counters live in Redis in a 15-minute fixed window, keyed by the sha256 of the email and by
  the client IP; a success (or a blocked answer) clears the email counter only. Redis down
  answers 503.
- Sessions and tokens (1.2a): a login creates a Redis hash `sess:{sid}` (sid 16 random bytes,
  `claimsVersion` 1, only the sha256 of the refresh token) and adds the sid to
  `user:{userId}:sessions`, both with the refresh TTL, in one transaction. It answers an
  access token (JWT HS256, 15 minutes, claims `sub sid role perms depts cv`) and a refresh
  token `<sid>.<secret>`. With `X-Client: web` both go in httpOnly, Secure, SameSite=Lax
  cookies on `/api/auth`; other clients get the refresh token in the body. Every protected
  route runs four checks with one Redis read: the token verifies, the session exists for
  `sub`, it is not revoked (`SESSION_REVOKED`), and `cv` is at least `claimsVersion`
  (`TOKEN_CLAIMS_STALE`); any other failure is 401 `UNAUTHENTICATED`, Redis down is 503.
  `GET /api/auth/me` takes the token only from `Authorization: Bearer`; `GET
  /api/auth/session` only from the `accessToken` cookie, so a web reload restores the login
  without rotating. Key and field names: `contracts/messaging.json`.
- Refresh and logout (1.2b): `POST /api/auth/refresh` takes the refresh token from the
  cookie or the body. A malformed token is refused before any Redis call; then the session's
  `userId` is read (none: 401), a per-session counter allows 10 refreshes a minute, and the
  user is read from MongoDB (down: 503, nothing rotated). One Lua script then decides: the
  current hash rotates (old hash kept as `prevRefreshHash`, TTLs of the hash and of
  `user:{userId}:sessions` reset, sid added back to the set); the previous hash is reuse:
  the script revokes with `refresh_reuse` and refresh answers 401 `REFRESH_TOKEN_REUSE`; a
  revoked session answers its reason only for a matching hash; anything else is 401
  `REFRESH_TOKEN_INVALID` and revokes nothing. A blocked user's session is revoked (403).
  The new access token carries the script's `claimsVersion`. No grace window: two tabs
  refreshing at once log out (1.6). Refresh has its own burst limit, 100 per second per IP.
  `POST /api/auth/logout` checks only the Bearer token's signature (expiry ignored), revokes
  the token's `sid` when it belongs to `sub`, clears both cookies and answers 204.
- Revoke helpers (`modules/auth/session/sessionRevoker.service.ts`): revoke one session, revoke all of a user,
  mark a user's claims stale. Each Redis write is a Lua script that first checks the hash
  exists, so no write recreates a session without a TTL. After the Redis change the revoker
  publishes on Redis pub/sub: `auth:sessions-revoked` `{ userId, sid?, reason }` (only when
  something changed) and `auth:claims-changed` `{ userId }`. Payloads hold no token or hash;
  a failed publish logs one warn line and never fails the action. No service listens yet
  (1.4).
- Identity design for Phase 1 (users, first owner, sessions, roles, invitations): [auth-design.md](auth-design.md).

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
- `src/api/` is the only code that calls the server (axios in `src/api/` only, lint
  enforces it): relative `/api`, 5 s timeout. A
  result is the JSON body, the contract error `code`, or `NETWORK` when there is no usable
  answer. Screens map a code to the message `errors.<CODE>` (`errors.UNKNOWN` for a code
  they do not know); the server's own `message` is never shown.
- Dev: Vite serves the app and forwards `/api` to Caddy on `localhost:8080`. Serving the
  built app through Caddy comes with deploy.
- Styling: Tailwind CSS v4; the design tokens in `src/styles/tokens.css` are its theme and
  the default color palette is removed. Dark mode follows the system.
- Health screen at `/`: auth, chat and ai, checked in parallel.

## Rules that cross services

- Error responses use `{ code, message?, params? }`; codes live in `contracts/error-codes.json`,
  the body shape in `contracts/schemas/error-body.schema.json`. The Java `ErrorBody` has no
  `params` yet (added when a Java route first needs it, no later than 1.4).
- Capabilities, RabbitMQ names and events live in `contracts/` too; each issue adds the names it first uses.
- Clients use a relative `/api` base URL, never a service port.
