# Plan 009a: 1.1a First owner

Spec: docs/specs/009-first-owner-login.md, part 1.1a (Decisions A1 to A30, Done when 1 to 22)
Issue: #34
Branch: feature/first-owner-login
Status: not started
Rule: one task, one commit, one check. Stop after each task and show the check output.

## Global Constraints

- Branch: `feature/first-owner-login` from an up-to-date `main`; never commit to `main`.
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task's Check passes, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 009a.` (for example `Task 6a of plan
  009a.` for the masking, `Task 6b of plan 009a.` for the accept route) and the
  attribution line.
- Every task leaves `npm run build && npm run lint && npm test` (auth-service) and
  `cd contracts && npm test` green.
- New packages: exact versions, each at least two weeks old. If one does not install or
  load on Windows or Linux, stop and tell the owner.
- Tests that need a real MongoDB or Redis use Testcontainers (Docker running). All other
  tests keep fakes.
- auth-service is the only writer of `users` and `invitations` in database `platform`.
- Never log a password, a hash or an invitation token. The one exception is the boot link
  on stdout (Task 5).
- A task diff over about 200 lines (not tests): stop and ask.
- 1.1b (#35) gets its own plan after this one is merged.

## Tasks

- [x] Task 1. argon2 install check, Windows and Linux CI
  Add the argon2 package with prebuilt binaries for Windows and Linux (exact version) to
  auth-service, and `src/services/password.ts`: `hashPassword`, `verifyPassword` with
  argon2id m=19456, t=2, p=1, with a unit test. Push the branch and open the 1.1a PR as a
  draft so the Linux CI job runs; it is marked ready in Task 8.
  Check: on Windows `npm ci && npm run build && npm run lint && npm test` passes and the
  test shows a hash starting `$argon2id$v=19$m=19456,t=2,p=1` that verifies; the draft PR's
  `auth-service` job passes on Linux. If either fails: stop and tell the owner. (Done when
  5, 21)

- [x] Task 2. Error body with params, and the 1.1a codes
  `contracts/error-codes.json`: the 5 codes. `contracts/schemas/error-body.schema.json`:
  `{ code, message?, params? }`, params values string, number or list of strings; contracts
  tests for it; README body shape and a real example name. auth: `ApiError` takes optional
  params, the error handler sends them; a test helper checks every error answer against the
  schema. `{ code, message?, params? }` in `CLAUDE.md`, `.claude/rules/security.md`,
  `docs/architecture.md`.
  Check: `cd contracts && npm test` passes, with tests that accept string, number and list
  params and reject a nested object; auth contract test passes with the 5 codes;
  `grep -n "message?, params?" CLAUDE.md .claude/rules/security.md` prints both. (Done when
  1, 2, 19 part 1)

- [x] Task 3. Config for the first owner and the client IP
  `BOOTSTRAP_OWNER_EMAIL` (trimmed, lower case), `WEB_ORIGIN`, `TRUST_PROXY`,
  `CLIENT_IP_HEADER` in `config.ts`; prod refuses a missing `BOOTSTRAP_OWNER_EMAIL` or
  `WEB_ORIGIN`, naming the variable; local defaults `TRUST_PROXY=1`,
  `WEB_ORIGIN=http://localhost:5173`. `.env.example` and `docs/environments.md` list the 4.
  `docs/environments.md`: `TRUST_PROXY` and `CLIENT_IP_HEADER` rows with three columns:
  local dev, production behind Cloudflare (`CLIENT_IP_HEADER=cf-connecting-ip`,
  `TRUST_PROXY` unset), self-host without Cloudflare (`TRUST_PROXY=1`, `CLIENT_IP_HEADER`
  unset). Warning: never set `CLIENT_IP_HEADER` on a host that clients can reach directly;
  they could choose their own counter.
  Check: config tests pass, including prod without each variable, and prod with the
  example value of `BOOTSTRAP_OWNER_EMAIL` or `WEB_ORIGIN`, exits with code 1 and names
  it; `git grep -n "SETUP_" -- apps .env.example` prints nothing;
  `node scripts/ci/check-env.mjs` passes. (Done when 18, 20 part 1)

- [ ] Task 4. Users and invitations repositories, indexes at startup
  Testcontainers (MongoDB) for auth tests. `users` repository (lower-cases the email,
  unique `email` index) and `invitations` repository (unique `tokenHash`, unique partial
  `email` where `status` is `pending`). A30: the service starts and `/health` answers even
  with MongoDB down; every data route answers 503 `SERVICE_UNAVAILABLE` until the indexes
  exist; one retry loop every 30 s creates the indexes (the boot step of Task 5 runs in the
  same loop, after them). Auth `CLAUDE.md`: layout and the real-store test gotcha.
  Check: integration tests pass: same email in other letter case through the repository
  fails as a duplicate; after startup both invitation indexes exist; a startup test shows
  no request to a data route is answered before index creation finishes; with MongoDB
  down at start, health answers 200 and a data route 503, and after MongoDB is back the
  data route works with no restart. (Done when 3 part 1, 4)

- [ ] Task 5. Boot link
  Boot step: while no user exists and the email is set, revoke pending owner invitations,
  insert a new one (32 random bytes, base64url, sha256 stored, 7 days, role `Owner`,
  `invitedBy: system`), retry revoke-and-insert at most 3 times on a duplicate, then write
  `<WEB_ORIGIN>/invite/<token>` once to stdout (plain write, not pino). Skip when a user
  exists; skip with one warning when the email is unset. The boot step waits for the
  indexes: it runs in the Task 4 retry loop, after they exist. The written exception goes
  into `CLAUDE.md` and `.claude/rules/security.md`.
  Check: integration tests pass for Done when 6, 7 and 8 (one link line, hash matches,
  JSON logs without the token; second boot revokes the old one; nothing when a user exists;
  one warning when unset); `grep -n "boot link" CLAUDE.md .claude/rules/security.md`
  prints both. (Done when 6, 7, 8, 19 part 2)

- [ ] Task 6a. Token masking in logs
  Logger: the token segment of `/api/auth/invitations/<token>` shows as `[redacted]` in
  request, error and 404 logs, before the accept route exists.
  Check: tests on a fake path (a test-only route under `/api/auth/invitations/<token>/...`
  that succeeds or throws, and the same path with no route, which answers 404) capture the
  logs; each shows `/api/auth/invitations/[redacted]/...` and none contains the token text.
  (Done when 17)

- [ ] Task 6b. Accept route
  `POST /api/auth/invitations/:token/accept-password`: check order of A23 (a malformed
  token counts as an accept failure from Task 7 on), atomic claim, create the user with
  role `Owner` and an argon2id hash, invitation back to pending if creation fails, 201
  `{ user }`. `openapi.yaml`, `docs/architecture.md`.
  Check: tests pass for Done when 3 part 2, 9, 10 (10 parallel accepts, one 201, one user,
  real MongoDB), 11, 12 and 16; the logs of a real accept that succeeds, one that answers
  404 and one that hits a forced error show `/api/auth/invitations/[redacted]/...` and none
  contains the token text; `npm run lint` passes. (Done when 3, 9, 10, 11, 12, 16, 17,
  20 part 2)

- [ ] Task 7. Accept failure limit, client IP and the 429 answer
  Express `trust proxy` from `TRUST_PROXY`, `CLIENT_IP_HEADER` when set. Redis failure
  counter per client IP: 20 failures (token-check answers 404, 410, 409, malformed tokens
  included) in a 15-minute fixed window, then 429 with `Retry-After` and
  `params.retryAfterSeconds`; successes do not count; Redis down answers 503. Testcontainers
  (Redis). `openapi.yaml` gets the 429 and 503.
  Check: tests pass: the 21st failure answers 429 with matching header and param, a success
  leaves the counter as it was; Redis stopped gives 503; two `X-Forwarded-For` values get
  separate counters; `CLIENT_IP_HEADER=cf-connecting-ip` decides when set; with
  `CLIENT_IP_HEADER` set but the header missing or not a valid IP, the client IP falls back
  to `req.ip`; with `TRUST_PROXY=1`, a fake first `X-Forwarded-For` value does not get a new
  counter (the last value, added by the trusted hop, decides). (Done when 13, 14, 15)

- [ ] Task 8. Close the issue
  Run the full checks (contracts, auth-service, web, `./mvnw verify`, repo checks,
  gitleaks). Through Caddy: start auth with `BOOTSTRAP_OWNER_EMAIL` set, accept the printed
  link via `localhost:8080` (201, then 409), restart (no link). Tick this plan and set
  `Status: done`; set its line in docs/plans/README.md to `done`; tick 1.1a in
  docs/roadmap.md; point docs/handoff.md to 1.1b (#35, `/write-plan` first). Scan, push,
  mark the PR ready with `Closes #34`.
  Check: all checks pass and CI is green on the PR; the Caddy run gives 201, 409 and no
  link after restart; `git diff main --stat` lists the plan, plans/README.md, roadmap.md
  and handoff.md; none says "merged" or a PR number; handoff "Next step" names 1.1b.
  (Done when 21, 22)

## Done when coverage (spec part 1.1a)

| Done when | Task |
|---|---|
| 1, 2 | 2 |
| 3 | 4 (repository duplicate), 6b (fields after accept) |
| 4 | 4 |
| 5 | 1, again in 6b |
| 6, 7, 8 | 5 |
| 9, 10, 11, 12, 16 | 6b |
| 17 | 6a (masking with a fake path), 6b (real accept requests) |
| 13, 14, 15 | 7 |
| 18 | 3 |
| 19 | 2 (error body), 5 (written exception) |
| 20 | 3 (env), 6b (OpenAPI, architecture), 7 (OpenAPI 429 and 503) |
| 21 | 1 (install on both), 8 (full run) |
| 22 | 8 |
