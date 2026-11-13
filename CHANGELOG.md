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
