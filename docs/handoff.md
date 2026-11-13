# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-14

## Now

- Issue: #35 1.1b Login (Sprint 2, estimate 3)
- Spec: [specs/009-first-owner-login.md](specs/009-first-owner-login.md), part 1.1b
- Plan: none yet (009b, from `/write-plan`)

## Done

- Issue #40 Health with Spring Actuator: done, plan 011 tasks 1 to 5. Every service answers
  health 200 `{"status":"UP"}` or 503 `{"status":"DOWN"}` (D-010b); chat and ai serve it
  through Spring Actuator, health the only actuator endpoint (D-010a). A hanging store
  answers 503 in about 2 s; MongoDB stopped and back recovers without a restart (D-010c).
- Smoke script and web accept both 503 bodies (`{"status":"DOWN"}`, Caddy's
  `SERVICE_UNAVAILABLE`); smoke checks `/actuator/env`, `/beans`, `/metrics` answer 404.
- Task 5 checks: contracts 30/30, auth 93/93, web 24/24, `./mvnw verify` (common 30, chat
  13, ai 13), spotless, repo checks, env-leak and gitleaks clean; `smoke.mjs --services`
  26/26 with all three services up.

## Next step: 1.1b Login (#35)

Branch `feature/login` from an up-to-date `main` (with issue #40 in it), then
`/write-plan` from spec 009 part 1.1b (plan 009b). Read `docs/auth-design.md` first.

## Known gaps

- Actuator runs health indicators one after another: with MongoDB and RabbitMQ both
  hanging, chat and ai health take about 4 s (one hanging store: about 2 s).
- Actuator logs a failed health check with the driver exception, which can name store
  hosts. Logs only, never the response.
- `.env` is read by Docker compose and by Spring (`.properties`) differently: quotes,
  trailing spaces and `# comments` stay in the value for Spring. Keep values bare.
  RabbitMQ takes `RABBITMQ_USER` and `RABBITMQ_PASSWORD` only when its volume is new.
- No web page for `/invite/<token>` yet (roadmap 1.6); accept the boot link with curl.
- Java on Windows needs `-XX:-UseThreadPriorities` (set for `spring-boot:run`).
- `MONGODB_URI` set to an empty string fails in the MongoDB driver before the guard runs.
- Vitest on Windows fails every suite when the shell path starts with lowercase `d:`; run
  it from `D:/openbox/...`. CI (Linux) is not hit.
- A running auth-service locks the argon2 native file; stop it before `npm ci`.
- Permission rules match command text only: `cat .env` through Bash is not blocked.
- Spring Boot 3.5 gets no free security fixes (owner decision, D-006).
- `CONTRIBUTING.md` loop step 2 still says "3+ points: spec" (rule is now 5+; tiny fix).

## Open questions for the user

- Did `git push` show a confirmation prompt (ask rule)? If not, the ask rule has no effect
  in auto mode.

## Settled

- Repo is public: scan for the forbidden names and for `.env` files and keys before every
  push. `main` is protected: PR plus the seven CI jobs (D-007).
- One PR per issue; its last plan task marks plan, index and roadmap `done` and points
  this file to the next issue. PR body: `Closes #n`. The user merges.
- Web first: Android is issue #25, later. Story sizes and spec rules: root `CLAUDE.md`.
