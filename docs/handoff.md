# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-15

## Now

- Issue: #35 1.1b Login: done on `feature/login`, PR next (the user says when to push)
- Spec: [specs/009-first-owner-login.md](specs/009-first-owner-login.md), part 1.1b
- Plan: [plans/009b-login.md](plans/009b-login.md), done

## Done

- Plan 009b Tasks 1 to 6: codes `INVALID_CREDENTIALS` 401 and `ACCOUNT_BLOCKED` 403;
  failure limits in Redis (5 per email, 20 per client IP, 15 minutes, sha256 email keys);
  login service with a dummy hash made at startup; `POST /api/auth/login`; burst limit
  (`express-rate-limit`, 5 per second per IP, optional `createApp` entry that `server.ts`
  always adds) and `helmet` headers.
- Tasks 1 to 4 were run locally (auth 127/127, contracts 31/31). Tasks 5 and 6 follow the new
  Work mode (root `CLAUDE.md`): not run locally; CI proves them on the PR.
- Issue #43 opened: Prettier config and a format check for auth-service (estimate 1).

## Next step: open the 1.1b PR, then 1.2

1. When the user says so: scan, push `feature/login`, open the PR with `Closes #35`, read
   `gh pr checks` once; fix all red checks in one commit and push again.
2. The user runs the Caddy check: after a 1.1a accept, login via `localhost:8080` with the
   chosen password (200) and a wrong one (401). The user merges.
3. Then 1.2 Sessions, access token, rotating refresh token, logout: no GitHub issue yet.
   Open it, branch from an up-to-date `main`, `/write-spec` (security change). Read
   `docs/auth-design.md` first.

## Known gaps

- Burst limit uses a memory store: per process, resets on restart (fine for one instance).
- The burst test relies on 6 fast requests within 1 second; a CI stall over 1 s would make
  it flaky (user chose to keep it as is).
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
- Work mode (root `CLAUDE.md`): no local runs per task, one core test, commit, report, stop.
