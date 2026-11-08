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
