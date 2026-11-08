# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-08

## Now

- Issue 0.4 Service skeletons: auth, chat, ai: done. Plan 004 tasks 1 to 12 done; 0.4 ticked.
- Branch: `feature/service-skeletons`, PR open for the user to read and merge.
- Spec: [specs/004-service-skeletons.md](specs/004-service-skeletons.md)
- Plan: [plans/004-service-skeletons.md](plans/004-service-skeletons.md)

## Done

- auth-service (Express 5, TS 6.0, Node 24): config guard, pino logs, health (MongoDB,
  Redis), `/internal/ping`; 24 tests pass, build and lint clean.
- chat-service and ai-service (Spring Boot 3.5.16, Java 21): same skeleton in a `platform`
  package, health (MongoDB, RabbitMQ); 25 tests each incl. Testcontainers; `./mvnw verify` OK.
- `node infra/smoke.mjs` and `--services`: 23 checks pass, services stopped and running.
- Mongo stopped: every health 503 in about 2.2 s; Mongo started: 200 again, no restart.
- Docs: root and service CLAUDE.md, openapi.yaml x3, architecture, environments, D-005,
  express rules (pino), infra README, CHANGELOG, `.env.example`.

## Next step: issue 0.5 platform-common-java library (2 points)

1. The user reads the full 0.4 diff and merges the PR.
2. Branch `feature/platform-common-java` from an updated `main`.
3. 2 points: no spec needed by the rules, but the Maven consumption question (below) needs
   an answer first; then move each service's `platform` package into the library and delete
   the copies.

## Known gaps

- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`; IDE run
  configs must add it). Without it Tomcat's low-priority threads stall the JVM for seconds.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Contracts, service builds and smoke check are not in CI yet: issue 0.6.
- chat and ai `platform` packages are copies; issue 0.5 removes the duplication.

## Open questions for the user

- Spring Boot 3.5 is past open-source support and Initializr only offers 4.x. Stay on 3.5
  (rules say Boot 3) or move to Boot 4 in 0.5? Moving changes `.claude/rules/spring.md`.
- 0.5: how do chat and ai consume the library: `mvnw install` locally, a root aggregator
  pom, or a GitHub Packages repo?
- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.

## Settled

- Repo is public. Before every push: scan for the forbidden names (list kept outside the
  repo) and for `.env` files and keys; push only if the scan is empty.
- Contract names UPPER_SNAKE, codes carry their status (D-003). Local dev: services on the
  host behind Caddy, `/internal` blocked by segment (D-004). Service skeleton choices: D-005.
- One PR per issue: the last plan task marks plan, index and roadmap `done` and points the
  handoff to the next issue, on the feature branch, before the PR opens.
- 0.6: protect `main` once CI exists (public repo, GitHub Free).
