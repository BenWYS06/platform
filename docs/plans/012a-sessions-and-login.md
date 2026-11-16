# Plan 012a: 1.2a Sessions, access token, /session and /me

Spec: docs/specs/012-sessions-and-tokens.md, part 1.2a (Decisions A1 to A18, Done when 1 to 13)
Issue: #47
Branch: feature/sessions
Status: not started
Rule: one task, one commit. No local runs; Check lines are what CI proves at the end. After
each task, report and stop as in root `CLAUDE.md` "Work mode".

## Global Constraints

- Branch: `feature/sessions` from an up-to-date `main`; never commit to `main`. Spec 012, this
  plan and the 1.2a code go in one PR from this branch (`Closes #47`).
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task is done, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 012a.` and the attribution line.
- One task at a time. After each task: commit, report, and STOP until the owner says go.
  Never run two tasks in one go.
- CI proves `npm run build && npm run lint && npm test` (auth-service), `cd contracts &&
  npm test` and the web checks green at the end of the plan.
- New packages: exact versions, each at least two weeks old. Only the two the spec names:
  `jsonwebtoken` (Task 3) and `cookie-parser` (Task 7), with their `@types` packages.
- Tests that need a real Redis or MongoDB use Testcontainers (`test/helpers/redis.ts`,
  `test/helpers/mongo.ts`). Route tests keep fakes where they can.
- Never log an access token, a refresh token or a refresh hash.
- Do not touch plan 012b or any 1.2b code (refresh, logout, revoke helpers, events).
- A task diff over about 200 lines (not tests): stop and ask.

## Spec decisions (1.2a)

Short form; the spec has the full text.

- A1. Session hash fields as auth-design 0.2, sid 16 random bytes base64url, hash and set in
  one Redis transaction, `claimsVersion` starts at 1. Owner
- A2. Access token JWT HS256, 15 minutes, claims `sub sid role perms depts cv iat exp`,
  `jsonwebtoken` with `algorithms: ['HS256']`, secret from config only. Owner
- A3. Refresh token `<sid>.<secret>`, 32 random bytes, only its sha256 stored. Owner
- A4. Web cookies `accessToken` and `refreshToken`: httpOnly, Secure, SameSite=Lax,
  Path=/api/auth; only with `X-Client: web`; login also returns the access token in the
  body. Owner
- A5. `GET /api/auth/session` reads the access cookie, runs the four checks, never rotates.
  Owner
- A6. Protected routes take the token only from `Authorization: Bearer`. Owner
- A7. All auth routes under `/api/auth`, proved by a path test. Owner
- A8. Redis unreachable answers 503, never 401. Owner
- A9. `SESSION_REVOKED` and `TOKEN_CLAIMS_STALE` are 401. Owner
- A10. Env `JWT_ACCESS_SECRET` (prod: at least 32 characters), `JWT_ACCESS_TTL_SECONDS`,
  `REFRESH_TTL_SECONDS`. Owner
- A11. Every new contract error code gets en and vi web messages in the same PR. Claude
- A12. `perms` and `depts` are empty lists until 1.3 and 4.1; `role` is the stored role.
  Claude
- A13. `platform` is `web` with `X-Client: web`, else `other`; `deviceId` empty for now.
  Claude
- A14. `user:{userId}:sessions` gets the refresh TTL, reset when a sid is added. Claude
- A15. No CORS in 1.2 (same origin through Caddy). Claude
- A16. `/session` answers only `UNAUTHENTICATED`, `SESSION_REVOKED`, `TOKEN_CLAIMS_STALE`.
  Claude
- A17. `user` in login and session answers is `{ id, email, displayName, role }`; `/me` adds
  `perms`. Claude
- A18. Session key patterns and hash field names in `contracts/messaging.json`, with a
  contract test in auth-service; needs a schema change (O8). Claude

## Plan decisions

- C1. Order change from the suggested list: the token helpers (Task 3) come before the
  session store (Task 4). They are pure code with no I/O, and the store's `create` stores
  the refresh hash, so it needs `newRefreshToken` and the hash first. Claude
- C2. Messaging schema (O8): `kind` gains `redisKey` and `redisField`. The value pattern
  depends on the kind (schema `if`/`then`): RabbitMQ kinds keep today's pattern;
  `redisKey` is lower-case words joined by `:` with `{camelCase}` placeholders
  (`sess:{sid}`, `user:{userId}:sessions`); `redisField` is camelCase (`userId`). Names:
  `SESSION_KEY`, `USER_SESSIONS_KEY`, `SESSION_FIELD_<FIELD>` (for example
  `SESSION_FIELD_USER_ID`). The schema `description` says it now holds RabbitMQ and Redis
  names. 1.2b adds `redisChannel` the same way. Owner (approved as written).
- C3. `JWT_ACCESS_SECRET` unset outside prod: warn and use a local default, as
  `INTERNAL_API_KEY` does; prod refuses missing, under 32 characters, the local default or
  the `.env.example` value. Both TTLs are positive integers; the access TTL must be smaller
  than the refresh TTL, else config refuses to start. Claude
- C4. Files: `src/services/sessionTokens.ts` (sign, verify, `newRefreshToken`; the hash
  reuses `hashToken` from `src/services/tokens.ts`), `src/repositories/sessions.ts`
  (`create`, `readForCheck` with one `HMGET`), `src/services/sessionCheck.ts` (the four
  checks, shared by the middleware and `/session`), `src/middleware/requireAccess.ts`,
  routes in `src/routes/auth.ts`. Claude
- C5. `/me` and `/session` read the user from MongoDB by `sub`: email and displayName are not
  in the token. `perms` comes from the token (empty until 1.3). A user missing from MongoDB
  answers 401 `UNAUTHENTICATED`; MongoDB down answers 503. Owner (approved as written).
- C6. Login order: the 1.1b checks, then create the session, then sign. Redis down at session
  creation throws `StoreUnavailableError` (503): no token, no cookie. The route sets cookies;
  the service never sees the response. Claude
- C7. `Secure` cookies also locally: browsers treat `http://localhost` as a secure context, so
  the Caddy run at `localhost:8080` keeps them. Claude

## Spec questions

| Task | Question | Answer |
|---|---|---|
| 1 | C2: new `kind` values and the per-kind value pattern in `messaging.schema.json` (spec O8). | Owner: approved as written. |
| 7 | C5: `/me` and `/session` read the user from MongoDB by `sub`; a missing user answers 401 `UNAUTHENTICATED`. | Owner: approved as written. |

No task waits on an open question.

## Tasks

- [x] Task 1. Contracts: session error codes and Redis names
  `contracts/error-codes.json`: `SESSION_REVOKED` 401 and `TOKEN_CLAIMS_STALE` 401; en and vi
  messages in `apps/web/src/i18n/en.json` and `vi.json`. `contracts/schemas/messaging.schema.json`
  as C2; `contracts/messaging.json` gets `SESSION_KEY`, `USER_SESSIONS_KEY` and one
  `SESSION_FIELD_*` entry per 0.2 field. Contracts test: a `redisKey` and a `redisField`
  entry pass, a `redisKey` with upper case or a `redisField` with a dot fails.
  Check: `cd contracts && npm test` passes with both codes at 401, the 13 Redis entries and
  the new schema cases; the web i18n test passes with both codes in en and vi.
  (Done when 1, part of 13)
  STOP: report to the owner before Task 2.

- [x] Task 2. Config: access secret and TTLs
  `src/config.ts`: `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS` (default 900),
  `REFRESH_TTL_SECONDS` (default 2592000), prod guard and TTL rule as C3. Names in
  `.env.example` and `docs/environments.md` (new "Sessions and tokens (issue 1.2a, auth)"
  section). Tests in `test/config.test.ts`.
  Check: config tests pass: defaults 900 and 2592000; `APP_ENV=prod` throws for the secret
  missing, 31 characters, the local default and the example value, and the message names
  `JWT_ACCESS_SECRET` but never the value; an access TTL not below the refresh TTL throws.
  (Done when 11)
  STOP: report to the owner before Task 3.

- [x] Task 3. Token helpers
  Add `jsonwebtoken` and `@types/jsonwebtoken` (exact versions). `src/services/sessionTokens.ts`:
  `signAccess(claims)` and `verifyAccess(token)` with HS256 pinned and the secret and TTL from
  config; `newSid()` (16 bytes base64url); `newRefreshToken(sid)` (`<sid>.<32 bytes
  base64url>`); refresh hash through `hashToken`. Unit tests, no I/O.
  Check: unit tests pass: a signed token verifies and carries `sub sid role perms depts cv
  iat exp` with `exp - iat` equal to the TTL; tokens with `alg: none`, RS256, another secret
  or past `exp` are refused; `newSid()` is 22 base64url characters; a refresh token is
  `<sid>.<43 characters>` and its hash is 64 hex characters, not the token. (part of Done
  when 5)
  STOP: report to the owner before Task 4.

- [x] Task 4. Session store
  `src/repositories/sessions.ts`: `create({ userId, method, platform, deviceId, refreshHash })`
  returns `sid`; one `MULTI`: `HSET sess:{sid}` with every 0.2 field (`claimsVersion` 1,
  `revoked` 0, empty `prevRefreshHash`, `rotatedAt`, `revokedReason`), `EXPIRE`, `SADD
  user:{userId}:sessions`, `EXPIRE` both to `REFRESH_TTL_SECONDS`. `readForCheck(sid)`: one
  `HMGET` of `userId`, `revoked`, `claimsVersion`. Key patterns and field names are
  constants in the file. Redis down throws `StoreUnavailableError`. Integration test against
  a real Redis; a second test in `test/contract.test.ts` checks the constants against
  `contracts/messaging.json`.
  Check: tests pass: after `create`, the hash holds all 11 fields with `claimsVersion` 1 and
  a TTL of `REFRESH_TTL_SECONDS` (within 2 s), the set holds the sid with the same TTL;
  `readForCheck` on a missing sid returns nothing; Redis stopped makes both throw
  `StoreUnavailableError`; the contract test fails when a key or field constant differs from
  `messaging.json`. (Done when 2 for the store, 13)
  STOP: report to the owner before Task 5.

- [x] Task 5. Login answers tokens
  `src/services/login.ts`: after the 1.1b checks pass, create the session (C6), sign the
  access token (`cv` 1, `perms` and `depts` empty, A12), return `{ accessToken,
  refreshToken, user }`. `src/routes/auth.ts`: `platform` from `X-Client` (A13); with
  `X-Client: web` set both cookies (A4, max ages from config) and answer `{ accessToken,
  user }`; otherwise no cookie and `refreshToken` in the body. Wire in `server.ts`. Test in
  `test/login-flow.test.ts` with real Redis and MongoDB.
  Check: tests pass: a web login answers 200 `{ accessToken, user }` with both `Set-Cookie`
  headers carrying HttpOnly, Secure, SameSite=Lax, Path=/api/auth and the two max ages; a
  login without the header (or `X-Client: android`) sets no cookie and returns
  `refreshToken`; one `sess:{sid}` hash exists with `platform` set and its sid in the user's
  set; a wrong password, a locked email and a blocked user create no session key and no
  cookie; Redis stopped after the user check answers 503 with no cookie.
  (Done when 2, 3, 4)
  STOP: report to the owner before Task 6.

- [ ] Task 6. Access-token middleware
  `src/services/sessionCheck.ts`: the four checks in order (verify, session exists and
  `userId` equals `sub`, not revoked, `cv` at least `claimsVersion`) with one
  `readForCheck`; returns the claims or throws the matching `ApiError`; Redis down rethrows
  `StoreUnavailableError` (503). `src/middleware/requireAccess.ts`: token only from
  `Authorization: Bearer`, then the check; claims on `res.locals`. Test with a small app that
  mounts the middleware on a test route, real Redis.
  Check: tests pass: valid token 200; no header, a cookie only, a malformed header, an expired
  token, `alg: none`, another secret, a missing session and a mismatched `userId` each 401
  `UNAUTHENTICATED`; `revoked` 1 gives 401 `SESSION_REVOKED`; `claimsVersion` 2 with `cv` 1
  gives 401 `TOKEN_CLAIMS_STALE`; Bearer plus cookie: the Bearer token decides; a Redis
  `MONITOR` or spy shows one `HMGET` per request; Redis stopped gives 503
  `SERVICE_UNAVAILABLE`. (Done when 5, part of 6, part of 9)
  STOP: report to the owner before Task 7.

- [ ] Task 7. GET /session and GET /me
  User read as C5. Add `cookie-parser` and `@types/cookie-parser` (exact versions),
  mounted for `/api/auth` only. `GET /api/auth/me` behind `requireAccess`: 200 `{ user }`
  with `id email displayName role perms`. `GET /api/auth/session`: reads the `accessToken`
  cookie, runs `sessionCheck`, answers 200 `{ accessToken, user }` with the same token; no
  cookie 401 `UNAUTHENTICATED`. Neither route writes to Redis. Route test with real Redis and
  MongoDB.
  Check: tests pass: `/me` with a Bearer token 200 with `perms: []`; `/me` with only the cookie
  401 `UNAUTHENTICATED`; `/session` with a valid cookie 200 and `accessToken` equals the
  cookie value, `refreshHash` unchanged; `/session` with no cookie, an expired cookie, a
  revoked session and a stale session gives 401 `UNAUTHENTICATED`, `UNAUTHENTICATED`,
  `SESSION_REVOKED`, `TOKEN_CLAIMS_STALE`; Redis stopped gives 503 on both routes.
  (Done when 6, 7, 8, 9)
  STOP: report to the owner before Task 8.

- [ ] Task 8. Log capture across login, /session and /me
  Extend `test/log-masking.test.ts`: capture every pino and stdout line during a web login,
  a body login, `/session` and `/me`. Code changes only if the test finds a leak.
  Check: the test passes: no captured line contains the access token, the refresh token, the
  refresh hash or the `Cookie`/`Set-Cookie`/`Authorization` values. (Done when 12)
  STOP: report to the owner before Task 9.

- [ ] Task 9. Path test and docs
  New test: list every route on the built app (walk the Express router stack) and fail when
  one is outside `/api/auth` or `/internal` (`/internal` holds `GET /internal/ping`,
  service-to-service, behind the internal key; it is not an auth route); it names the route. `openapi.yaml`: login (200
  body by client, cookies, 503), `/session` and `/me` (200, 401 codes, 503), bearer and
  cookie security schemes. `docs/architecture.md`: sessions, tokens and the four checks.
  auth `CLAUDE.md`: new files in the layout. `CHANGELOG.md` line under `Unreleased`.
  Check: the path test passes and fails when a test router is mounted at `/api/other`
  (asserted in the same test); the OpenAPI file lists `/api/auth/login`, `/api/auth/session`
  and `/api/auth/me` with every code the routes answer. (Done when 10)
  STOP: report to the owner before Task 10.

- [ ] Task 10. Close the issue
  Tick this plan and set `Status: done`; set its line in docs/plans/README.md to `done`;
  tick #47 in docs/roadmap.md; point docs/handoff.md to plan 012b (#48) (/session-summary).
  Scan; when the owner says so, push and open the PR with `Closes #47` and
  'Android: later, issue #25'. CI runs the full checks: read `gh pr checks` once; for a red
  check open only its log, fix all red checks in one commit, push again. The Caddy run is
  the owner's: web login via `localhost:8080` sets both cookies, a reload calls `/session`
  (200), `/me` with the Bearer token answers 200.
  Check: CI is green on the PR; `git diff main --stat` lists the plan, plans/README.md,
  roadmap.md and handoff.md; none says "merged" or a PR number; handoff "Next step" names
  #48.

## Done when coverage (spec part 1.2a)

| Done when | Task |
|---|---|
| 1 | 1 |
| 2 | 4 (store), 5 (login creates it) |
| 3, 4 | 5 |
| 5 | 3 (verify refuses), 6 (401 over HTTP) |
| 6 | 6 (codes), 7 (`/me` 200 with `perms`) |
| 7, 8 | 7 |
| 9 | 6 (middleware), 7 (both routes) |
| 10 | 9 |
| 11 | 2 |
| 12 | 8 |
| 13 | 1 (entries), 4 (auth contract test) |
