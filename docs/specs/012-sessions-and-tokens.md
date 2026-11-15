# Spec 012: 1.2 Sessions and tokens

Issue: #47 1.2a Sessions, access token, /session and /me (Sprint 2, estimate 5) and #48 1.2b
Refresh rotation, reuse detection, logout (Sprint 2, estimate 5). Total estimate 10. One spec,
two parts; each part has its own plan and PR. 1.2b needs 1.2a.

Design: `docs/auth-design.md` sections 0 and 1.2, and decision D-011 (web token cookies). The
decisions below copy them and are tagged Owner; where this spec adds its own, they are tagged
Claude and listed under "Open items".

## Why

Login (1.1b) proves who a user is once, and nothing remembers it. Every later Phase 1 issue
needs a session that every service can check on each call and end at once (logout, block,
role change), a short-lived access token, and a refresh token that renews it and catches a
replayed token. The web must get its token back after a page reload without rotating the
refresh token (D-011).

## What we build

### 1.2a Sessions, access token, /session and /me (#47)

1. Session in Redis (auth-design 0.2)
   - `sid`: 16 random bytes, base64url. `sess:{sid}` hash: `userId`, `method` (`password`),
     `deviceId`, `platform`, `refreshHash`, `prevRefreshHash`, `rotatedAt`, `claimsVersion`
     (starts at 1), `revoked` (`0`), `revokedReason`, `createdAt`. TTL `REFRESH_TTL_SECONDS`.
   - `user:{userId}:sessions`: set of the user's sids.
   - Both written in one Redis transaction.
2. Tokens (auth-design 0.1)
   - Access token: JWT, HS256, `JWT_ACCESS_TTL_SECONDS` (900), secret `JWT_ACCESS_SECRET`.
     Claims `sub`, `sid`, `role`, `perms`, `depts`, `cv`, `iat`, `exp`. Signed and verified
     with `jsonwebtoken`, algorithm pinned to HS256.
   - Refresh token: `<sid>.<secret>`, secret 32 random bytes, base64url. Only its sha256 is
     stored (`refreshHash`).
3. Login answers tokens
   - `POST /api/auth/login`: after the 1.1b checks pass, create the session and answer 200
     `{ accessToken, user }`. A failed, limited or blocked login creates no session.
   - With header `X-Client: web`: set the `accessToken` cookie (max age = access TTL) and
     the `refreshToken` cookie (max age = refresh TTL), both httpOnly, Secure,
     SameSite=Lax, Path=/api/auth. Without it: no cookies, `refreshToken` in the body.
4. Access-token check in auth-service (auth-design 0.3)
   - Middleware for protected auth routes: token only from `Authorization: Bearer`, never a
     cookie. Four checks: signature and expiry, else 401 `UNAUTHENTICATED`; `sess:{sid}`
     exists and its `userId` equals `sub`, else 401 `UNAUTHENTICATED`; not revoked, else 401
     `SESSION_REVOKED`; `cv` at least the session's `claimsVersion`, else 401
     `TOKEN_CLAIMS_STALE`. One `HMGET`. Redis unreachable: 503 `SERVICE_UNAVAILABLE`.
5. `GET /api/auth/session` (web, D-011)
   - Reads the `accessToken` cookie, runs the same four checks, answers 200
     `{ accessToken, user }`. Never rotates the refresh token. A failed check answers its
     code from step 4; a missing cookie answers 401 `UNAUTHENTICATED`.
6. `GET /api/auth/me`
   - Behind the middleware. Answers 200 `{ user }` with `id`, `email`, `displayName`,
     `role` and `perms`.
7. Path test (D-011): a test fails when an auth route is mounted outside `/api/auth`.
8. Codes `SESSION_REVOKED` 401 and `TOKEN_CLAIMS_STALE` 401 in `contracts/error-codes.json`,
   with en and vi messages in the web i18n files.
9. Config: `JWT_ACCESS_SECRET` (prod guard: missing, under 32 characters or the example value
   refuses to start), `JWT_ACCESS_TTL_SECONDS` (default 900), `REFRESH_TTL_SECONDS` (default
   2592000). Names in `.env.example` and `docs/environments.md`.
10. Libraries: `jsonwebtoken`, `cookie-parser` (auth-design 0.12).
11. Docs: `openapi.yaml` (login, session, me), `docs/architecture.md`, auth `CLAUDE.md`.

### 1.2b Refresh rotation, reuse detection, logout (#48)

1. `POST /api/auth/refresh`
   - Refresh token from the `refreshToken` cookie, or from the body `{ refreshToken }`.
   - Order (B4, B12): IP burst limit; malformed token refused; per-session counter; read
     `userId` from `sess:{sid}` (one `HGET`, no decision, no write; no session: 401
     `REFRESH_TOKEN_INVALID` with no MongoDB call); read the user and claims from MongoDB
     (MongoDB down: 503, nothing rotated; no user: 401 `REFRESH_TOKEN_INVALID`, nothing
     rotated); then the atomic script below; then the blocked check; then sign.
   - One atomic Redis script decides (auth-design 1.2, steps unchanged):
     1. no session hash: 401 `REFRESH_TOKEN_INVALID`;
     2. `revoked=1` and the token matches the current or previous hash: 403
        `ACCOUNT_BLOCKED` if the reason is `blocked`, else 401 `SESSION_REVOKED`;
     3. token hash equals the current hash: store the new hash, move the old one to
        `prevRefreshHash`, set `rotatedAt`, reset the TTL: success;
     4. token hash equals the previous hash: revoke the session (reason `refresh_reuse`),
        then publish the event, 401 `REFRESH_TOKEN_REUSE`;
     5. anything else: 401 `REFRESH_TOKEN_INVALID`, no revoke.
   - After a rotation: if the user read before the script is blocked, revoke the session
     (reason `blocked`), 403 `ACCOUNT_BLOCKED`. Otherwise sign a new access token with the
     claims read before the script and the `claimsVersion` the script returned as `cv`.
     Answer 200 `{ accessToken, user }`; web gets
     both cookies again, others get the new `refreshToken` in the body.
2. `POST /api/auth/logout`
   - Needs a valid access token. Revokes the session of that token (`sid` from the token,
     never from the body), reason `logout`, then publishes the event. Clears both cookies
     with the same Path and attributes. Answers 204.
3. Refresh limits
   - Its own burst limit: 100 requests per second per client IP.
   - 10 refreshes per minute per session, keyed on the sid in the refresh token.
4. Revoke helpers (for 1.3 and 1.5)
   - Revoke one session (reason given); revoke all sessions of a user (reason given); mark
     claims stale for a list of users (`claimsVersion += 1` on each live session, skipping
     missing and revoked ones). Each is one atomic Redis script and publishes after the
     Redis change.
5. Events (auth-design 0.5)
   - `auth:sessions-revoked` `{ userId, sid?, reason }` and `auth:claims-changed`
     `{ userId }` on Redis pub/sub; names in `contracts/messaging.json`. A failed publish is
     logged and never fails the action.
6. Codes `REFRESH_TOKEN_INVALID` 401 and `REFRESH_TOKEN_REUSE` 401 in
   `contracts/error-codes.json`, with en and vi web messages.
7. Docs: `openapi.yaml` (refresh, logout), `docs/architecture.md`, auth `CLAUDE.md`.

## Out of scope

- A grace window for two tabs refreshing at once: 1.6 (1.2 logs both out on purpose).
- The session check in chat and ai, and their Bearer-only test: 1.4.
- Roles, capabilities and the content of `perms`: 1.3.
- Listeners that close sockets or push `CLAIMS_CHANGED`: 2.2.
- Web pages, the reload order in the client, the router guard: 1.6.
- Android token storage: issue #25.
- Blocking a user, invitations admin, audit log: 1.5.
- A "my sessions" screen, a cache for the session check: not planned (auth-design 0.9).

## Edge cases

- Login without `X-Client: web` (missing or another value): no cookies, refresh token in the
  body.
- Login while Redis is down: 503, no token, no cookie.
- Access token signed with another algorithm (`none`, RS256) or another secret: 401
  `UNAUTHENTICATED`.
- Valid access token but the session hash has expired: 401 `UNAUTHENTICATED`.
- Session `userId` differs from `sub`: 401 `UNAUTHENTICATED`.
- `/me` with only the `accessToken` cookie and no Bearer header: 401 `UNAUTHENTICATED`.
- `/me` with both a Bearer header and a cookie: the Bearer token decides.
- `/session` with no cookie: 401 `UNAUTHENTICATED`; with an expired cookie: 401
  `UNAUTHENTICATED`.
- A refresh token without a dot, with a wrong length or bad characters: 401
  `REFRESH_TOKEN_INVALID`, no Redis write.
- A revoked session and a token that matches neither hash: 401 `REFRESH_TOKEN_INVALID` (a
  stranger learns nothing).
- Two refreshes at once with the same token: one rotates, the other matches the previous hash
  and revokes the session (reuse). Accepted until 1.6.
- A blocked user refreshes: the session is revoked with reason `blocked`, 403. The next
  refresh with the same token answers 403 `ACCOUNT_BLOCKED`.
- Logout twice with the same token: the second call also answers 204 (B13).
- MongoDB down at refresh: 503, nothing rotated; the same refresh token still works once
  MongoDB is back, and it does not count as reuse (B4).
- A publish fails (Redis pub/sub error): the action still succeeds; one log line without the
  token.

## Must not happen

- A refresh token, a refresh hash or an access token in a log line, an error body or a URL.
- A cookie accepted as login on any route other than `/session` and `/refresh`.
- An auth route mounted outside `/api/auth`.
- `/session` returning a token for a revoked or stale session.
- Logout revoking a session of another user, or taking the `sid` from the body.
- A refresh that succeeds on a revoked session.
- A 503 on refresh that rotates the token.
- A forged refresh token revoking a session.
- A session hash recreated without a TTL by a late write (every write on a session uses a
  script or checks existence first).
- An access token accepted after logout.
- Redis down turned into a 401 (it is always 503).
- A token verified without pinning HS256, or a secret read from anywhere but config.

## Open items

Questions `docs/auth-design.md` does not settle. Each has a Claude decision below that the
owner can overrule.

- O1. What `perms` holds before 1.3 (`contracts/capabilities.json` is empty).
- O2. Where `deviceId` and `platform` come from.
- O3. Whether logout runs all four checks, or answers 204 for an already revoked or stale
  session.
- O4. Whether `user:{userId}:sessions` gets a TTL.
- O5. Whether CORS (`CORS_ORIGINS`, `cors`) lands in 1.2 or later.
- O6. Whether `/session` ever answers `ACCOUNT_BLOCKED` (0.3 gives a blocked session
  `SESSION_REVOKED`).
- O7. The refresh order in B4 differs from auth-design 1.2, which rotates first and reads the
  user after: here the user and claims are read before the script, so a MongoDB outage never
  rotates a token the client then cannot use.
- O8. `contracts/messaging.json` holds RabbitMQ names only today: its schema allows the kinds
  `exchange`, `queue` and `routingKey` and values of lower-case words and dots. The Redis
  key patterns, hash fields and pub/sub channels (A18, B14) need new kinds and a wider value
  pattern in `contracts/schemas/messaging.schema.json`, or a separate contract file.

## 1.2a Decisions

- A1. Session hash fields, sid size, one transaction, `claimsVersion` starts at 1
  (auth-design 0.2, 1.2). Owner
- A2. Access token: JWT HS256, 15 minutes, claims as in 0.1, `jsonwebtoken` with
  `algorithms: ['HS256']`, secret from config only. Owner
- A3. Refresh token `<sid>.<secret>`, 32 random bytes, only its sha256 stored. Owner
- A4. Web cookies `accessToken` (15 minutes) and `refreshToken` (30 days): httpOnly, Secure,
  SameSite=Lax, Path=/api/auth; set only with `X-Client: web`; login also returns the access
  token in the body (D-011). Owner
- A5. `GET /api/auth/session` reads the access cookie, runs the four checks of 0.3, never
  rotates the refresh token (D-011). Owner
- A6. Every protected route takes the token only from `Authorization: Bearer` (D-011). Owner
- A7. All auth routes under `/api/auth`, proved by a path test (D-011). Owner
- A8. Redis unreachable answers 503, never 401 (0.3). Owner
- A9. `SESSION_REVOKED` and `TOKEN_CLAIMS_STALE` are 401 (0.7). Owner
- A10. Env `JWT_ACCESS_SECRET` (prod: at least 32 characters), `JWT_ACCESS_TTL_SECONDS`,
  `REFRESH_TTL_SECONDS` (0.8). Owner
- A11. Every new contract error code gets en and vi web messages in the same PR (the web
  i18n test requires it). Claude
- A12. `perms` is the empty list and `depts` the empty list until 1.3 and 4.1 fill them; `role`
  is the user's stored role (O1). Claude
- A13. `platform` is `web` with `X-Client: web`, else `other`; `deviceId` is empty until the
  Android client sends one (#25) (O2). Claude
- A14. `user:{userId}:sessions` gets the refresh TTL, reset when a sid is added; a stale sid in
  the set is harmless because every read checks the hash (O4). Claude
- A15. CORS stays out of 1.2: the web calls the relative `/api` through Caddy, same origin
  (O5). Claude
- A16. `/session` answers the 0.3 codes only (`UNAUTHENTICATED`, `SESSION_REVOKED`,
  `TOKEN_CLAIMS_STALE`); `ACCOUNT_BLOCKED` comes only from login and refresh (O6). Claude
- A17. The `user` object in login, session and refresh answers is the 1.1b shape
  `{ id, email, displayName, role }`; `/me` adds `perms`. Claude
- A18. The session key patterns (`sess:{sid}`, `user:{userId}:sessions`) and the session
  hash field names live in `contracts/messaging.json`, with a contract test in auth-service;
  1.4 reuses them in Java. Needs a schema change (O8). Claude

## 1.2a Done when

1. `cd contracts && npm test` passes with `SESSION_REVOKED` and `TOKEN_CLAIMS_STALE` (401),
   and the web i18n test passes with both in en and vi. [A9, A11]
2. A login creates one `sess:{sid}` hash with every 0.2 field, `claimsVersion` 1 and a TTL
   of `REFRESH_TTL_SECONDS`, and adds the sid to `user:{userId}:sessions`. [A1, A14]
3. A web login (`X-Client: web`) answers 200 `{ accessToken, user }` and sets both cookies
   with the D-011 attributes; a login without the header sets no cookie and returns
   `refreshToken` in the body. [A4]
4. A failed, limited or blocked login creates no session and sets no cookie. [A1]
5. The access token verifies with HS256 and the configured secret and carries `sub`, `sid`,
   `role`, `perms`, `depts`, `cv`; a token with `alg: none`, RS256 or another secret answers
   401 `UNAUTHENTICATED`. [A2]
6. `/me` with a valid Bearer token answers 200 with `perms`; with no token, an expired token,
   a missing session or a mismatched `userId`: 401 `UNAUTHENTICATED`; revoked session: 401
   `SESSION_REVOKED`; `claimsVersion` above `cv`: 401 `TOKEN_CLAIMS_STALE`. [A6, A9]
7. `/me` with only the `accessToken` cookie answers 401 `UNAUTHENTICATED`. [A6]
8. `/session` with a valid cookie answers 200 `{ accessToken, user }` whose `accessToken` is
   the same token as in the cookie (not a new one), and leaves the session's
   `refreshHash` unchanged; with no cookie, an expired one, a revoked or a stale session it
   answers the matching 401 code. [A5, A16]
9. With Redis stopped, `/me` and `/session` answer 503 `SERVICE_UNAVAILABLE`. [A8]
10. The path test lists every auth route and fails when one is mounted outside `/api/auth`.
    [A7]
11. `APP_ENV=prod` refuses to start with `JWT_ACCESS_SECRET` missing, shorter than 32
    characters or the example value. [A10]
12. A log capture across login, `/session` and `/me` finds no access token, refresh token or
    refresh hash. [Must not happen]
13. `contracts/messaging.json` lists the two session key patterns and every session hash field
    name, and an auth-service contract test fails when the code uses a different name. [A18]

## 1.2b Decisions

- B1. The refresh decision is one atomic Redis script with the five steps of auth-design 1.2,
  in that order. Owner
- B2. A revoked session answers its reason (`ACCOUNT_BLOCKED` 403 for `blocked`, else
  `SESSION_REVOKED`) only when the token matches the current or previous hash. Owner
- B3. A reused (previous) token revokes the session with reason `refresh_reuse` and publishes
  the event; a token matching neither hash revokes nothing. Owner
- B4. Refresh order: read `userId` from `sess:{sid}` (`HGET`, no decision, no write; no
  session: 401 `REFRESH_TOKEN_INVALID`, no MongoDB call); read the user and claims from
  MongoDB (down: 503, nothing rotated; no user: 401 `REFRESH_TOKEN_INVALID`, nothing
  rotated); run the atomic script (B1); if the user is blocked, revoke with reason `blocked`
  and answer 403; sign the token with the `claimsVersion` the script returned. This differs
  from auth-design 1.2, which rotates first (O7). Claude
- B5. No grace window in 1.2; two tabs refreshing at once log out, fixed in 1.6. Owner
- B6. Logout needs a valid access token, takes the `sid` from it, reason `logout`, clears both
  cookies with the same attributes, answers 204. Owner
- B7. Refresh limits: a burst of 100 per second, plus 10 per minute per session keyed on the
  sid. Owner
- B8. Revoke helpers: one session, all sessions of a user, mark claims stale; each publishes
  after the Redis change; a failed publish is logged and never fails the action (0.5,
  0.6). Owner
- B9. `REFRESH_TOKEN_INVALID` and `REFRESH_TOKEN_REUSE` are 401 (0.7). Owner
- B10. The refresh token comes from the `refreshToken` cookie or the body; web gets new cookies,
  others get the new refresh token in the body (0.1, D-011). Owner
- B11. A malformed refresh token is refused before any Redis call. Claude
- B12. Order of checks on refresh: IP burst, malformed token, per-session counter, then the
  steps of B4. The per-session refresh limit uses the existing `FailureCounter` style in Redis with a
  60-second window, keyed `auth:refresh:sid:<sid>`; the burst uses its own
  `express-rate-limit` instance (memory store), separate from the login burst. Claude
- B13. Logout runs only the signature check and takes `sub` and `sid` from the token; it
  revokes the session when it exists and belongs to `sub`, and answers 204 also for an
  already revoked or stale session, so a second logout is not an error (O3). Claude
- B14. Event names go in `contracts/messaging.json` with a contract test (a contract
  change; needs the schema change in O8). Claude

## 1.2b Done when

1. `cd contracts && npm test` passes with `REFRESH_TOKEN_INVALID` and `REFRESH_TOKEN_REUSE`
   (401) and both event names; the web i18n test passes with both codes in en and vi.
   [B9, B14, A11]
2. A refresh with the current token answers 200 with a new access token, stores the new hash,
   moves the old one to `prevRefreshHash`, sets `rotatedAt` and resets the TTL. [B1]
3. A web refresh reads the cookie and sets both cookies again; a body refresh returns the new
   refresh token in the body. [B10]
4. Using the previous token again answers 401 `REFRESH_TOKEN_REUSE`, revokes the session with
   reason `refresh_reuse`, publishes `auth:sessions-revoked`, and every later refresh on that
   session fails. [B3]
5. A forged token for an existing session answers 401 `REFRESH_TOKEN_INVALID` and leaves the
   session unrevoked; a malformed token makes no Redis call. [B3, B11]
6. On a revoked session, a matching token answers its reason (403 `ACCOUNT_BLOCKED` or 401
   `SESSION_REVOKED`); a non-matching one answers 401 `REFRESH_TOKEN_INVALID`. [B2]
7. A blocked user's refresh revokes the session with reason `blocked` and answers 403
   `ACCOUNT_BLOCKED`. [B4]
8. With MongoDB stopped, a refresh answers 503 and leaves `refreshHash`, `prevRefreshHash`
    and `rotatedAt` unchanged; after MongoDB is back the same refresh token answers 200, not
    `REFRESH_TOKEN_REUSE`. A refresh for a session whose user no longer exists answers 401
    `REFRESH_TOKEN_INVALID` and rotates nothing. A refresh with no session hash makes no
    MongoDB call. [B4]
9. After a claims-stale mark, a refresh answers a token whose `cv` equals the new
   `claimsVersion`, and `/me` accepts it. [B4, B8]
10. Logout answers 204, revokes only the token's session (another user's session stays live),
   clears both cookies with the same Path and attributes, and publishes the event; after it
   the same access token gets 401 `SESSION_REVOKED` at `/me` and `/session`. A second logout
   also answers 204. [B6, B13]
11. The 11th refresh within a minute for one session answers 429 with `Retry-After`; the
    101st within a second from one IP answers 429 `Retry-After: 1`. [B7, B12]
12. Each revoke helper changes Redis then publishes; with publish failing the change still
    lands and one log line is written. [B8]
13. No write recreates a session hash without a TTL: a rotation or revoke on an expired
    session leaves no key behind. [Must not happen]
14. A log capture across refresh, reuse and logout finds no refresh token, refresh hash or
    access token. [Must not happen]
