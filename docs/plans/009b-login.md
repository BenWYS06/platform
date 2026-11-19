# Plan 009b: 1.1b Login

Spec: docs/specs/009-first-owner-login.md, part 1.1b (Decisions B1 to B13, Done when 1 to 15)
Issue: #35
Branch: feature/login
Status: done
Rule: one task, one commit. No local runs; Check lines are what CI proves at the end. After
each task, report and stop as in root `CLAUDE.md` "Work mode".

## Global Constraints

- Branch: `feature/login` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task is done, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 009b.` and the attribution line.
- A task is ticked when it is done. CI proves `npm run build && npm run lint && npm test`
  (auth-service) and `cd contracts && npm test` green at the end of the plan.
- New packages: exact versions, each at least two weeks old.
- Tests that need a real MongoDB or Redis use Testcontainers (Docker running). Route tests
  keep fakes.
- Never log a password, a hash or an email in a Redis key (B12).
- A task diff over about 200 lines (not tests): stop and ask.

## Plan decisions

- C1. A success clears the per-email counter only. The per-IP counter is never cleared by a
  success, so an attacker cannot reset it by logging in to their own account between
  guesses; it only counts failures and ends with its window (B3, B4). Claude
- C2. Redis keys: `auth:login-fail:email:<sha256 hex of normalized email>` and
  `auth:login-fail:ip:<ip>`, 900 s fixed window, through the existing `FailureCounter`
  (it gains `clear(key)`). Claude
- C3. The burst limit keys on the same client IP as the failure limits
  (`middleware/clientIp.ts`), memory store, one shared limiter for login and accept; its 429
  is the contract body `RATE_LIMITED` with `params.retryAfterSeconds: 1` and
  `Retry-After: 1`, sent through the existing error handler. The memory store is per
  process and resets on restart; fine for a single instance (A24). The limiter is an
  `AppDeps` entry, so tests can pass one that never limits. Claude
- C4. Tests set a user to `blocked` through the Mongoose model in a test helper; no
  repository method for it until 1.5. Claude
- C5. The burst limiter is an optional `createApp` entry; `server.ts` builds the app with
  `createAppWithLimits`, which always adds it. The Task 5 core test builds the app through
  that same function; the older tests build with `createApp` and stay unchanged. Owner

## Tasks

- [x] Task 1. Login error codes
  `contracts/error-codes.json`: `INVALID_CREDENTIALS` 401, `ACCOUNT_BLOCKED` 403, with
  contracts tests. auth `ERROR_STATUS` gets both.
  Check: `cd contracts && npm test` passes with both codes and statuses; the auth contract
  test passes. (Done when 1)

- [x] Task 2. Login failure limits
  `FailureCounter.clear(key)`. `src/modules/auth/loginLimit.service.ts`: `check(email, ip)` (email
  locked at 5, then IP at 20; 429 `RATE_LIMITED` with `retryAfterSeconds`), `fail(email, ip)`
  counts both, `succeed(email)` clears the email counter (C1). Email keys hold the sha256
  (C2). Integration tests against a real Redis.
  Check: tests pass: the first failure sets a TTL of 900 s on both keys; `succeed` deletes
  the email key and leaves the IP key; 5 email failures make `check` throw 429, 20 IP
  failures across emails do too; `retryAfterSeconds` equals the key TTL within 1 second; a
  `SCAN` of the
  keys after a failure finds no plain email; Redis stopped makes `check` and `fail` throw
  `StoreUnavailableError`. (Done when 5, 10)

- [x] Task 3. Login service
  `src/modules/auth/login.service.ts`: the B1 order over the users repository, `verifyPassword` and the
  login limit; dummy hash made once at startup with `ARGON2_OPTIONS` (B10), wired in
  `server.ts`. Answers `{ user }` = `{ id, email, displayName, role }` (B8). Unit tests with
  fakes and a spy on the password check.
  Check: unit tests pass: right password returns the user and calls `succeed`; wrong
  password and unknown email both throw `INVALID_CREDENTIALS` and call `fail`; the spy shows
  the unknown email was checked against the dummy hash, whose prefix is
  `$argon2id$v=19$m=19456,t=2,p=1`; blocked user with the right password throws
  `ACCOUNT_BLOCKED` and calls `succeed`, never `fail`; blocked user with a wrong password
  throws `INVALID_CREDENTIALS` and calls `fail`; a locked email throws 429 before any user
  lookup. (Done when 2, 6, part of 3)
  Note: the dummy hash at startup and the wiring in server.ts move to Task 4, where the route
  uses them.

- [x] Task 4. Login route
  `POST /api/auth/login` in `src/modules/auth/auth.routes.ts` behind `requireReady`: strict body
  `{ email, password }`, email trimmed, lower case, valid, at most 254 characters (B9),
  password as in A18; one service call; 200 `{ user }`. `openapi.yaml` (200, 400, 401, 403,
  429, 503), `docs/architecture.md` (login), auth `CLAUDE.md` layout line. Route tests with
  fakes; flow tests against a real MongoDB and Redis. The 30-successful-logins and
  20-failures tests must not trip the burst limit (Task 5): they build the app with a burst
  limiter that never limits (C3), not with delays (no sleeps, testing rules). Task 5 adds
  that option and sets it in these tests. `server.ts` makes `createDummyHash` and the login
  service before the server starts listening (moved from Task 3). The route takes the client
  IP from `middleware/clientIp.ts`, not `req.ip`.
  Check: tests pass: an unknown-email login right after startup is checked against the dummy
  hash; right password 200 `{ user }` with no `passwordHash`; wrong password and
  unknown email give byte-identical 401 bodies; 5 failures for an unknown email make the 6th
  429; for a real user after 5 failures the right password gets 429; 20 failures from one IP
  across emails make the 21st 429, and 30 successful logins from one IP all answer 200;
  blocked user 403 with the counter gone, wrong password 401 with it counted; every 429 has
  `Retry-After` equal to `params.retryAfterSeconds`; Redis stopped answers 503
  `SERVICE_UNAVAILABLE`; bad email, 255-character email, missing and unknown fields answer
  400 `VALIDATION_FAILED`; every error answer passes `expectError`. (Done when 2, 3, 4, 6,
  7, 9, 11, 12)

- [x] Task 5. Burst limit and security headers
  `express-rate-limit` (exact version), memory store, 5 requests per second per client IP
  (C3) on login and accept, not on health or `/internal`; 429 `RATE_LIMITED` with
  `Retry-After: 1`. `helmet` (exact version) first in the app, defaults with
  `X-Frame-Options: DENY` (B13). `openapi.yaml` notes the burst 429 on both routes; auth
  `CLAUDE.md`. One core test file.
  Check (CI): the core test passes: the 6th login within one second from one IP answers 429
  with `Retry-After: 1` and `params.retryAfterSeconds: 1`; health is not limited; a login
  answer carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and a
  `Content-Security-Policy` header; the Task 4 tests still pass. (Done when 8, 15)

- [x] Task 6. Close the issue
  CHANGELOG line under `Unreleased`. Tick this plan and set `Status: done`; set its line in
  docs/plans/README.md to `done`; tick 1.1b and 1.1 in docs/roadmap.md; point
  docs/handoff.md to the next issue (/session-summary). Scan; when the user says so, push
  and open the PR with `Closes #35`. CI runs the full checks (contracts, auth-service,
  web, `./mvnw verify`, repo checks, gitleaks): read `gh pr checks` once; for a red check
  open only its log, fix all red checks in one commit, push again. The Caddy run is the
  user's: after a 1.1a accept, login via `localhost:8080` with the chosen password (200)
  and a wrong one (401).
  Check: CI is green on the PR; the user's Caddy run gives 200 and 401;
  `git diff main --stat` lists the plan, plans/README.md, roadmap.md and handoff.md; none
  says "merged" or a PR number; handoff "Next step" names the next issue. (Done when 13, 14)

## Done when coverage (spec part 1.1b)

| Done when | Task |
|---|---|
| 1 | 1 |
| 2 | 3 (dummy hash spy), 4 (identical 401 bodies over HTTP) |
| 3, 4 | 4 (3 also in part in 3) |
| 5, 10 | 2 |
| 6 | 3, 4 |
| 7, 9, 11, 12 | 4 |
| 8, 15 | 5 |
| 13, 14 | 6 |
