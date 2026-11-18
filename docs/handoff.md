# Handoff

Job: where the last session stopped and what to do next. Read this first in every new session.

Last updated: 2026-11-19

## Now

- Issue: #48 1.2b Refresh rotation, reuse detection, logout: done on
  `feature/refresh-and-logout`, PR next (the user says when to push)
- Spec: [specs/012-sessions-and-tokens.md](specs/012-sessions-and-tokens.md), part 1.2b
- Plan: [plans/012b-refresh-and-logout.md](plans/012b-refresh-and-logout.md), done

## Done

- Plan 012b Tasks 1 to 10: refresh error codes and the two event channels in contracts;
  Lua revoke scripts; session revoker with publish (`auth:sessions-revoked`,
  `auth:claims-changed`); `readUserId` and the rotate script; refresh service (rotation,
  reuse, per-session limit); `POST /api/auth/refresh` with its own 100/s burst;
  `POST /api/auth/logout` (signature only); log capture test; OpenAPI, architecture, auth
  `CLAUDE.md`, changelog; the route path test lists both routes.
- Work mode: no task was run locally; CI proves them on the PR.

## Next step: open the 1.2b PR, then 1.3

1. When the user says so: scan, push `feature/refresh-and-logout`, open the PR with
   `Closes #48` and 'Android: later, issue #25'. Read `gh pr checks` once; fix all red
   checks in one commit and push again.
2. The user runs the Caddy check: web login via `localhost:8080`, `POST /api/auth/refresh`
   sets both cookies again, logout clears them and `/session` then answers 401. The user merges.
3. Then 1.3 Capabilities, roles, workspace settings (no issue number yet): branch from an
   up-to-date `main`, `/write-spec` (contract and security change).

## Known gaps

- No grace window on refresh: two tabs refreshing at once log out (fixed in 1.6).
- Events are published, but no service listens yet (1.4).
- Burst limits use a memory store: per process, reset on restart (fine for one instance).
- The login burst test relies on 6 fast requests within 1 second; a CI stall over 1 s would
  make it flaky (user chose to keep it as is).
- The route path test sees routers mounted with `app.use`; a router nested inside another
  router would not be listed (none exists).
- Revoke scripts name session keys outside `KEYS`: fine on one Redis node, not Redis Cluster.
- Actuator runs health indicators one after another: with MongoDB and RabbitMQ both
  hanging, chat and ai health take about 4 s. Its failed-check log line can name store hosts
  (logs only, never the response).
- `.env` is read by Docker compose and by Spring differently: quotes, trailing spaces and
  `# comments` stay in the value for Spring. Keep values bare. RabbitMQ takes
  `RABBITMQ_USER` and `RABBITMQ_PASSWORD` only when its volume is new.
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
