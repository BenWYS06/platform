# Changelog

Job: user-visible changes, newest first. Format follows [Keep a Changelog](https://keepachangelog.com/);
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Repo harness: Claude Code settings, hooks, rules and skills; PR and issue templates;
  docs skeleton (issue 0.1).
- Contracts folder: shared error codes, capabilities, messaging and event names, with a
  check (`cd contracts && npm test`) (issue 0.2).
- Local infra: MongoDB replica set, Redis, RabbitMQ, Qdrant and a Caddy gateway on
  `localhost:8080` that blocks `/internal` and answers errors as contract JSON; smoke check
  `node infra/smoke.mjs` (issue 0.3).
- Service skeletons: auth-service (Express), chat-service and ai-service (Spring Boot), each
  with `/api/<service>/health`, `/internal/ping` behind `X-Internal-Key`, contract errors,
  JSON logs with a request id and a production guard; smoke check `--services` (issue 0.4).
- platform-common-java: shared Java errors, production guard, request id and a Spring Security
  chain that closes every chat and ai `/api` route except health (401 until real tokens);
  one Maven build at the repo root (`./mvnw verify`) (issue 0.5).
- First owner: while no user exists, auth-service prints a one-time invitation link at
  boot; `POST /api/auth/invitations/<token>/accept-password` creates the owner. Failed
  accepts are limited per client IP (429 with `Retry-After`); error bodies may carry
  `params` (issue 1.1a).
- Login: `POST /api/auth/login` with email and password answers the user profile. Unknown
  email and wrong password get the same 401; failed logins are limited per email and per
  client IP, every login and accept request to 5 per second (429 with `Retry-After`); a
  blocked account gets 403. Every auth-service answer carries security headers (issue 1.1b).
- Sessions: login creates a session and answers an access token and a refresh token (web:
  httpOnly cookies); `GET /api/auth/session` restores a web login from the cookie and
  `GET /api/auth/me` answers the calling user; revoked or stale sessions get 401 (issue 1.2a).
- Refresh and logout: `POST /api/auth/refresh` rotates the refresh token and answers a new
  access token; reusing an old refresh token logs that session out. `POST /api/auth/logout`
  ends the session and clears the cookies (issue 1.2b).

### Changed

- Health: every service answers 503 `{"status":"DOWN"}` instead of the error body when a
  store is down; chat-service and ai-service serve health through Spring Actuator, the only
  actuator endpoint. The web health screen and the smoke check accept both 503 bodies
  (issue #40).
