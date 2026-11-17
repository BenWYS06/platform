# Plan 012b: 1.2b Refresh rotation, reuse detection, logout

Spec: docs/specs/012-sessions-and-tokens.md, part 1.2b (Decisions B1 to B14, Done when 1 to 16)
Issue: #48
Branch: feature/refresh-and-logout
Status: not started
Rule: one task, one commit. No local runs; Check lines are what CI proves at the end. After
each task, report and stop as in root `CLAUDE.md` "Work mode".

## Global Constraints

- Branch: `feature/refresh-and-logout` from an up-to-date `main`; never commit to `main`. This
  plan and the 1.2b code go in one PR from this branch (`Closes #48`).
- Stage files one by one: `git add <path>`. Never `git add -A` or `git add .`.
- Format only the files this task changed; never reformat other files.
- When a task is done, tick it (`- [x]`) here and put that change in the task's commit.
- Every commit ends with the trailer `Task N of plan 012b.` and the attribution line.
- One task at a time. After each task: commit, report, and STOP until the owner says go.
  Never run two tasks in one go.
- CI proves `npm run build && npm run lint && npm test` (auth-service), `cd contracts &&
  npm test` and the web checks green at the end of the plan.
- No new packages. Pub/sub uses the existing `redis` client (`PUBLISH` needs no second
  connection; only subscribers do, and none exist until 1.4).
- Tests that need a real Redis or MongoDB use Testcontainers (`test/helpers/redis.ts`,
  `test/helpers/mongo.ts`). Route tests keep fakes where they can.
- Never log an access token, a refresh token or a refresh hash.
- Every write on a session hash goes through a Lua script that first checks the key exists,
  so no write recreates a session without a TTL (spec "Must not happen").
- Do not touch 1.3 or later work (capabilities, chat/ai session check, listeners, web pages).
- A task diff over about 200 lines (not tests): stop and ask.

## Spec decisions (1.2b)

Short form; the spec has the full text.

- B1. Refresh decision: one atomic Redis script, the five steps of auth-design 1.2 in order;
  step 3 also does `SADD` of the sid to `user:{userId}:sessions` and resets the set's TTL.
  Owner / Claude
- B2. A revoked session answers its reason (`ACCOUNT_BLOCKED` 403 for `blocked`, else
  `SESSION_REVOKED` 401) only when the token matches the current or previous hash. Owner
- B3. Previous token reused: revoke with reason `refresh_reuse`, publish; a token matching
  neither hash revokes nothing. Owner
- B4. Refresh order: `HGET userId`; per-session counter; user and claims from MongoDB (down:
  503, nothing rotated; no user: 401 `REFRESH_TOKEN_INVALID`); script; blocked check
  (revoke `blocked`, 403); sign with the script's `claimsVersion`. Claude
- B5. No grace window; two tabs refreshing at once log out (fixed in 1.6). Owner
- B6. Logout: Bearer token, HS256 signature verified, expiry ignored, `sid` from the token,
  reason `logout`, clears both cookies, 204; wrong signature 401 `UNAUTHENTICATED`. Claude
- B7. Refresh limits: burst 100 per second per IP; 10 per minute per session. Owner
- B8. Revoke helpers: one session, all of a user, mark claims stale; publish after the Redis
  change; a failed publish is logged and never fails the action. Owner
- B9. `REFRESH_TOKEN_INVALID` and `REFRESH_TOKEN_REUSE` are 401. Owner
- B10. Refresh token from the `refreshToken` cookie or the body; web gets new cookies, others
  the new refresh token in the body. Owner
- B11. A malformed refresh token is refused before any Redis call. Claude
- B12. Check order: IP burst, malformed token, `HGET userId` (no session: 401, no counter key),
  per-session counter `auth:refresh:sid:<sid>` (60 s window), then B4. The burst is its own
  `express-rate-limit` instance, separate from the login burst. Claude
- B13. Logout runs only the signature check; revokes when the session exists and belongs to
  `sub`; 204 also for an already revoked or missing session. Claude
- B14. Event names in `contracts/messaging.json` with a contract test (schema change, O8).
  Claude

## Plan decisions

- D1. Messaging schema: `kind` gains `redisChannel`. Its value pattern (schema `if`/`then`,
  as C2 in plan 012a): lower-case words joined by `:`, at least one `:`; the only thing new
  against `redisKey` words is a `-` inside a word (not first, not last, never two in a row):
  `^[a-z][a-z0-9]*(-[a-z0-9]+)*(:[a-z][a-z0-9]*(-[a-z0-9]+)*)+$`. So `auth:sessions-revoked`
  and `auth:claims-changed` pass. Names: `SESSIONS_REVOKED_CHANNEL`, `CLAIMS_CHANGED_CHANNEL`.
  The schema `description` adds "Redis pub/sub channels". Owner (approved).
- D2. Files: Lua sources in `src/repositories/sessionScripts.ts` (strings only, loaded with
  `defineScript` or `EVAL`); `src/repositories/sessions.ts` gains `readUserId`, `rotate`,
  `revoke`, `revokeAllOfUser`, `markClaimsStale`; `src/services/sessionRevoker.ts` holds the
  channel constants, builds every event payload and publishes (D11), next to the three revoke
  helpers (Redis change, then publish); `src/services/refresh.ts` and `src/services/logout.ts` hold
  the two flows; routes stay in `src/routes/auth.ts`. Claude
- D3. Script results are small tagged values the store maps to a TypeScript union, for example
  `rotate` returns `{ kind: 'rotated', claimsVersion }`, `{ kind: 'reuse' }`,
  `{ kind: 'revoked', reason }` or `{ kind: 'invalid' }`. Errors (`ApiError`) are thrown by the
  service, never by the store. Claude
- D4. `revoke(sid, reason, expectedUserId?)`: when `expectedUserId` is given and differs from
  the hash's `userId`, nothing changes. Returns whether this call changed the session
  (`revoked` 0 to 1). The revoker publishes `auth:sessions-revoked` only when it changed
  something, so a second logout answers 204 without a second event. `revokeAllOfUser` and
  `markClaimsStale` publish once per user. Claude
- D5. `revokeAllOfUser` and `markClaimsStale` read `user:{userId}:sessions` inside the script
  and touch each `sess:{sid}` that still exists (missing sids are skipped and removed from the
  set; revoked ones are skipped by `markClaimsStale`). The script names session keys that are
  not in `KEYS`: fine on one Redis node; Redis Cluster is not planned (auth-design 0.2). Claude
- D6. Malformed refresh token (B11): anything but `^[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}$`
  answers 401 `REFRESH_TOKEN_INVALID` with no Redis call. A missing token (no cookie, no body
  field) answers the same code. The body is strict: `{ refreshToken?: string }` only, else 400.
  Claude
- D7. Per-session limit reuses `createFailureCounter` with prefix `auth:refresh:sid:` and a
  60 s window: `get`, then 429 `RATE_LIMITED` with `retryAfterSeconds` when the count is 10 or
  more, else `add`. Every refresh that passes `HGET userId` counts, success or not. Claude
- D8. Refresh burst: a second `express-rate-limit` instance, 100 per second per client IP,
  mounted on `/api/auth/refresh` only, through `createAppWithLimits`. `createBurstLimit` takes
  the limit as a parameter (login and accept keep 5). Claude
- D9. Logout verify: `SessionTokens` gains `verifyAccessSignature(token)`, the same HS256
  pinned check with `ignoreExpiration: true` and the same claims shape check. Used by logout
  only. Claude
- D10. A failed publish writes one `warn` line with the channel and the reason, never the
  payload's token or hash (the payload holds none). Claude
- D11. The revoker gains `announceRevoked({ userId, sid, reason })`: publish only, no Redis
  change, for the reuse path where the rotate script has already revoked. Channel names and
  payloads are built only inside the revoker; refresh, logout and any later caller pass plain
  values and never publish themselves. A failed publish is logged (D10) and never changes the
  refresh or logout response. Owner (approved).

## Spec questions

| Task | Question | Answer |
|---|---|---|
| 1 | D1: new `kind` `redisChannel` and its value pattern in `messaging.schema.json` (spec O8, B14). | Owner: approved; a hyphen inside a word is the only new thing. |
| 3 | D11: on reuse the rotate script has already revoked the session; how does refresh publish without revoking? | Owner: approved `announceRevoked({ userId, sid, reason })`, publish only; channel and payload built only in the revoker. |

No task waits on an open question.

## Tasks

- [x] Task 1. Contracts: refresh error codes and event channels
  `contracts/error-codes.json`: `REFRESH_TOKEN_INVALID` 401 and `REFRESH_TOKEN_REUSE` 401; en
  and vi messages in `apps/web/src/i18n/en.json` and `vi.json`. `messaging.schema.json` as D1;
  `contracts/messaging.json` gets `SESSIONS_REVOKED_CHANNEL` and `CLAIMS_CHANGED_CHANNEL`.
  Contracts test: a `redisChannel` entry with a hyphen (`auth:sessions-revoked`) passes; one
  without a colon (`auth-sessions-revoked`) fails.
  Check: `cd contracts && npm test` passes with both codes at 401, the two channels and the
  new schema cases; the web i18n test passes with both codes in en and vi. (Done when 1)
  STOP: report to the owner before Task 2.

- [x] Task 2. Session store: revoke scripts
  `src/repositories/sessionScripts.ts` and `sessions.ts` as D2, D4, D5: `revoke`,
  `revokeAllOfUser`, `markClaimsStale`; each one script, each checks the hash exists first.
  Redis down: `StoreUnavailableError`. Integration test against a real Redis.
  Check: tests pass: `revoke` sets `revoked` 1 and the reason and returns true, a second call
  returns false; with another `expectedUserId` nothing changes; `revokeAllOfUser` revokes
  every live sid in the set; `markClaimsStale` adds 1 to `claimsVersion` on live sessions and
  skips revoked and missing ones; both remove (`SREM`) a sid whose hash is gone from the set
  and keep the live ones; each script on an expired sid leaves no `sess:{sid}` key
  (`EXISTS` 0). (part of Done when 13)
  STOP: report to the owner before Task 3.

- [x] Task 3. Events and revoke helpers
  `src/services/sessionRevoker.ts` (D2, D4, D10, D11): the channel constants from Task 1 and
  the payloads `{ userId, sid?, reason }` and `{ userId }`, built only here;
  `revokeSession`, `revokeAllSessions`, `markClaimsStale` (Redis change first, then publish);
  `announceRevoked({ userId, sid, reason })`, publish only. A failed publish logs one line
  and the call still succeeds. Channel constants join the auth contract test. Test with a
  real Redis and a subscriber client.
  Check: tests pass: each helper changes Redis, then the subscriber receives the event with
  the right payload; `announceRevoked` sends one event and changes no Redis key; with publish
  throwing, the change still lands, the call resolves and one
  warn line names the channel; the contract test fails when a channel constant differs from
  `messaging.json`. (Done when 12, part of 1)
  STOP: report to the owner before Task 4.

- [ ] Task 4. Session store: read userId and rotate script
  `sessions.ts`: `readUserId(sid)` (one `HGET`); `rotate(sid, presentedHash, newHash)` runs the
  five steps of B1 in one script and returns the D3 union; step 3 does `SADD` of the sid to
  `user:{userId}:sessions` and resets the TTL of the hash and of that set; step 4 revokes with reason `refresh_reuse` inside the
  script. Integration test against a real Redis.
  Check: tests pass: the current hash rotates (new hash stored, old in `prevRefreshHash`,
  `rotatedAt` set, both TTLs back to `REFRESH_TTL_SECONDS` within 2 s after the set's TTL was
  cut to 5 s); the previous hash gives `reuse` and `revoked` 1 with `refresh_reuse`; a third
  hash gives `invalid` and no revoke; a revoked session with a matching hash gives its reason,
  with a non-matching hash `invalid`; a missing sid gives `invalid` and leaves no key; after a
  rotation with the set already expired (`DEL user:{userId}:sessions` before rotating), the
  set holds the sid again with the refresh TTL and `revokeAllOfUser` finds the session; when
  rotation fails (revoked session, reused hash, hash mismatch): before the call the real sid is
  removed from the set, a dummy sid is added so the set key still exists (Redis deletes an
  empty set, and its TTL would read -2), and the set's TTL is cut to 5 s; after the call the
  dummy sid is still in the set, the real sid is not, and the set's TTL is at most 5 s. (part of Done when 2, 4, 5, 6, 13, 15)
  STOP: report to the owner before Task 5.

- [ ] Task 5. Refresh service
  `src/services/refresh.ts`: order B12 then B4: format (D6), `readUserId`, per-session counter
  (D7), `users.findById` (`StoreUnavailableError` passes through as 503; no user 401
  `REFRESH_TOKEN_INVALID`), `rotate`; `reuse` publishes through the revoker's publish-only path
  (D11; the script already revoked) and throws `REFRESH_TOKEN_REUSE`; `revoked` throws its reason (B2);
  blocked user: `revokeSession(sid, 'blocked')`, 403; else sign with the script's
  `claimsVersion` and return `{ accessToken, refreshToken, user }`. Test with real Redis and
  MongoDB.
  Check: tests pass: a refresh answers a new access token whose `cv` equals `claimsVersion`,
  also after `markClaimsStale`; reuse answers `REFRESH_TOKEN_REUSE`, the event arrives and the
  next refresh fails; a forged secret answers `REFRESH_TOKEN_INVALID` and the session stays
  live; a malformed token makes no Redis call (spy); a blocked user gets 403 and the session
  has reason `blocked` and the subscriber receives `auth:sessions-revoked` once, and the next
  refresh with the same token (the one sent, now the previous hash) answers 403
  `ACCOUNT_BLOCKED`, not `REFRESH_TOKEN_REUSE`, and sends no second event; with publish
  throwing, reuse still answers 401 `REFRESH_TOKEN_REUSE` and a blocked user still 403; with MongoDB
  stopped: 503 and the three hash fields unchanged, then after restart the same token rotates;
  a deleted user: 401 `REFRESH_TOKEN_INVALID`, nothing rotated; a well-formed sid with no
  session: 401, no `auth:refresh:sid:` key, no MongoDB call; the 11th refresh in a minute for
  one session answers 429 with `retryAfterSeconds`. (Done when 2, 4 to 9, 11 per session, 16)
  STOP: report to the owner before Task 6.

- [ ] Task 6. POST /api/auth/refresh and its burst limit
  `src/routes/auth.ts`: token from the `refreshToken` cookie, else from the strict body (D6);
  with `X-Client: web` set both cookies (same attributes as login) and answer
  `{ accessToken, user }`, else answer `{ accessToken, refreshToken, user }`. Burst as D8.
  Wire in `server.ts` and `app.ts`. Route test with real Redis and MongoDB.
  Check: tests pass: a web refresh with the cookie answers 200 with both `Set-Cookie` headers
  and no `refreshToken` in the body; a body refresh answers the new `refreshToken` and sets no
  cookie; an unknown body field answers 400; no token answers 401 `REFRESH_TOKEN_INVALID`; the
  101st request within a second from one IP answers 429 with `Retry-After: 1`, while login's
  burst stays at 5. (Done when 3, 11 burst)
  STOP: report to the owner before Task 7.

- [ ] Task 7. POST /api/auth/logout
  `sessionTokens.ts`: `verifyAccessSignature` (D9). `src/services/logout.ts`: verify, then
  `revokeSession(claims.sid, 'logout', claims.sub)` (D4). Route: Bearer only; clears both
  cookies with the login attributes (`res.clearCookie`); 204. Route test with real Redis and
  MongoDB.
  Check: tests pass: logout answers 204, both cookies cleared with Path=/api/auth, HttpOnly,
  Secure, SameSite=Lax; the session has reason `logout` and the event arrives once; another
  user's session stays live; then `/me` and `/session` with the same token answer 401
  `SESSION_REVOKED`; a second logout answers 204 with no second event; an expired but
  correctly signed token answers 204 and revokes; a wrong signature or no header answers 401
  `UNAUTHENTICATED` and revokes nothing; a body `{ sid }` naming another session is never
  read: only the token's session is revoked. (Done when 10)
  STOP: report to the owner before Task 8.

- [ ] Task 8. Log capture across refresh, reuse and logout
  Extend `test/log-masking.test.ts`: capture every pino and stdout line during a web refresh,
  a body refresh, a reuse, a failed publish and a logout. Code changes only if the test finds
  a leak.
  Check: the test passes: no captured line contains an access token, a refresh token (old or
  new), a refresh hash or the `Cookie`/`Set-Cookie`/`Authorization` values. (Done when 14)
  STOP: report to the owner before Task 9.

- [ ] Task 9. Docs
  `openapi.yaml`: `/api/auth/refresh` (cookie or body, 200 by client, 400, 401 codes, 403,
  429, 503) and `/api/auth/logout` (Bearer, 204, 401). `docs/architecture.md`: rotation,
  reuse detection, revoke helpers and the two events. auth `CLAUDE.md`: new files in the
  layout. `CHANGELOG.md` line under `Unreleased`. The route path test picks up both routes
  with no change.
  Check: the path test passes with `/api/auth/refresh` and `/api/auth/logout` listed; the
  OpenAPI file lists both routes with every code they answer.
  STOP: report to the owner before Task 10.

- [ ] Task 10. Close the issue
  Tick this plan and set `Status: done`; set its line in docs/plans/README.md to `done`;
  tick #48 and the 1.2 parent line in docs/roadmap.md; point docs/handoff.md to 1.3
  Capabilities, roles, workspace settings (/session-summary). Scan; when the owner says so,
  push and open the PR with `Closes #48` and 'Android: later, issue #25'. CI runs the full
  checks: read `gh pr checks` once; for a red check open only its log, fix all red checks in
  one commit, push again. The Caddy run is the owner's: a web login via `localhost:8080`,
  `POST /api/auth/refresh` sets both cookies again, logout clears them and `/session` then
  answers 401.
  Check: CI is green on the PR; `git diff main --stat` lists the plan, plans/README.md,
  roadmap.md and handoff.md; none says "merged" or a PR number; handoff "Next step" names
  1.3.

## Done when coverage (spec part 1.2b)

| Done when | Task |
|---|---|
| 1 | 1 (codes, channels), 3 (auth contract test) |
| 2 | 4 (store), 5 (service) |
| 3 | 6 |
| 4, 5, 6 | 4 (script), 5 (service, event, no Redis call) |
| 7, 8, 9 | 5 |
| 10 | 7 |
| 11 | 5 (per session), 6 (burst) |
| 12 | 3 |
| 13 | 2 (revoke scripts), 4 (rotate) |
| 14 | 8 |
| 15 | 4 |
| 16 | 5 |
