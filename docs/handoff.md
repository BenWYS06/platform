# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-16

## Now

- Issue: #47 1.2a Sessions, access token, /session and /me: done on `feature/sessions`, PR next
  (the user says when to push)
- Spec: [specs/012-sessions-and-tokens.md](specs/012-sessions-and-tokens.md), part 1.2a
- Plan: [plans/012a-sessions-and-login.md](plans/012a-sessions-and-login.md), done

## Done

- Plan 012a Tasks 1 to 10: session error codes and Redis names in contracts; access secret
  and TTL config; token helpers (`jsonwebtoken`, HS256 pinned); Redis session store; login
  creates a session and answers tokens (web: cookies); access-token middleware with the four
  checks; `GET /api/auth/session` and `GET /api/auth/me`; a log capture test; a route path
  test; OpenAPI, architecture, auth `CLAUDE.md` and changelog.
- Work mode: no task was run locally; CI proves them on the PR.

## Next step: open the 1.2a PR, then 1.2b (#48)

1. When the user says so: scan, push `feature/sessions`, open the PR with `Closes #47` and
   'Android: later, issue #25'. Read `gh pr checks` once; fix all red checks in one commit
   and push again.
2. The user runs the Caddy check: web login via `localhost:8080` sets both cookies, a reload
   calls `/session` (200), `/me` with the Bearer token answers 200. The user merges.
3. Then #48 1.2b Refresh rotation, reuse detection, logout: branch from an up-to-date `main`,
   `/write-plan` from spec 012 part 1.2b (plan 012b).

## Known gaps

- Burst limit uses a memory store: per process, resets on restart (fine for one instance).
- The burst test relies on 6 fast requests within 1 second; a CI stall over 1 s would make
  it flaky (user chose to keep it as is).
- The route path test sees routers mounted with `app.use`; a router nested inside another
  router would not be listed (none exists).
- Actuator runs health indicators one after another: with MongoDB and RabbitMQ both
  hanging, chat and ai health take about 4 s (one hanging store: about 2 s).
- Actuator logs a failed health check with the driver exception, which can name store
  hosts. Logs only, never the response.
- `.env` is read by Docker compose and by Spring (`.properties`) differently: quotes,
  trailing spaces and `# comments` stay in the value for Spring. Keep values bare.
  RabbitMQ takes `RABBITMQ_USER` and `RABBITMQ_PASSWORD` only when its volume is new.
- No web page for `/invite/<token>` yet (roadmap 1.6); accept the boot link with curl.
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
