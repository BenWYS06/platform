# Auth design (issues 1.1 to 1.6)

Job: the full design of identity in OpenBox, so every Phase 1 spec starts from the same decisions. When a spec for 1.1 to 1.6 starts, copy the decisions of its section into the spec's Decisions list, tagged Owner. A spec may differ only if it says so and the owner agrees.

## 0. The picture

```
 Browser / Android
   |  login: email + password          every call: Authorization: Bearer <access token>
   v
 Caddy ---------> auth-service (Node)        chat-service, ai-service (Java)
                      |                              |
               MongoDB: users, roles, ...            |
               Redis:   sess:{sid}  <----------------+   every service checks the session
```

Logout, block or role change = change the session in Redis. The next call in every service sees it. No waiting for the access token to expire.

### 0.1 Tokens

- Access token: JWT, HS256, 15 minutes, secret `JWT_ACCESS_SECRET` (same value in every service). Claims: `sub` (user id), `sid` (session id), `role` (role name), `perms` (capability list), `depts` (department ids, empty until phase 4), `cv` (claims version, see 0.6), `iat`, `exp`. Every verifier pins the algorithm to HS256.
- Refresh token: opaque string `<sid>.<secret>`, secret = 32 random bytes, base64url. Not a JWT. Valid 30 days, sliding (each rotation starts 30 days again). Rotates on every use. Only its sha256 is stored. A random 256-bit secret needs no slow hash.
- Web: the access token lives in memory only. The refresh token is an httpOnly cookie: `Secure` in prod, `SameSite=Strict`, `Path=/api/auth`, 30 days. Android: the refresh token comes in the response body and goes to encrypted storage (later, issue #25).
- The server sends the refresh token in a cookie when the request has header `X-Client: web`, and in the body otherwise.

### 0.2 Session in Redis

- `sess:{sid}` is a hash: `userId`, `method` (`password`; later `google`, `oidc`), `deviceId`, `platform`, `refreshHash`, `prevRefreshHash`, `rotatedAt`, `claimsVersion`, `revoked` (`0` or `1`), `revokedReason`, `createdAt`. TTL 30 days, reset on each rotation.
- `user:{userId}:sessions` is a set of the user's sids, so "all sessions of a user" is one lookup.
- Revoke = set `revoked=1` and `revokedReason`, and remove the sid from the user's set. The hash stays until its TTL, so validators answer SESSION_REVOKED, not "not found".
- `sid` is 16 random bytes, base64url.

### 0.3 What every service checks on every request

1. Signature valid and not expired, else 401 `UNAUTHENTICATED`.
2. `sess:{sid}` exists and its `userId` equals `sub`, else 401 `UNAUTHENTICATED`.
3. `revoked` is not `1`, else 401 `SESSION_REVOKED`.
4. Token `cv` is at least the session's `claimsVersion`, else 401 `TOKEN_CLAIMS_STALE`.

- One Redis call: `HMGET sess:{sid} userId revoked claimsVersion`. No local cache in phase 1.
- Redis unreachable: 503 `SERVICE_UNAVAILABLE`, never 401. A Redis blip must not log people out. Redis client: connect and command timeout 5 seconds, one retry, bounded reconnect backoff.
- After the session check, a route declares one capability. Allowed if `perms` contains it, else 403 `FORBIDDEN`. Data checks ("member of this chat") are separate and live inside the query.
- Identity comes only from the token. Never from a body, query or header field.

### 0.4 What clients do with an answer

| Answer | Client does |
|---|---|
| 401 on any call while signed in | one refresh, then retry the call once |
| refresh answers 401 or 403 | log out; show the reason if the code is on the allow-list |
| refresh answers 503 or the network fails | stay signed in; the call fails this time, the user can retry |
| login or refresh answers 403 `ACCOUNT_BLOCKED` (a blocked user's other calls answer 401 `SESSION_REVOKED`) | log out, show "account blocked" on the login screen |
| 401 on login, setup, invitation or refresh calls | never start a refresh (it is a real answer, a refresh would loop) |
| 429 | show "try again later" with the wait time from `params` |

Only codes on a fixed allow-list ever reach the login screen (`/login?reason=CODE`). Server text is never shown.

### 0.5 Events (Redis pub/sub, names in `contracts/messaging.json`)

- `auth:sessions-revoked` with `{userId, sid?, reason}`. With `sid`: only that session. Without: every session of the user. Reasons: `logout`, `blocked`, `refresh_reuse`, `password_changed`, `other`.
- `auth:claims-changed` with `{userId}`.
- Published after the Redis change. A failed publish is logged and never fails the action.
- Listeners (close sockets, push `CLAIMS_CHANGED`) come with chat realtime in 2.2. Until then the events are published and tested only.

### 0.6 Claims change without logout

- Each session has `claimsVersion` (integer, starts at 1). The token carries the value it was minted with as `cv`.
- When a user's role or departments change, or a role's capabilities change: for each live session of the affected users, `claimsVersion += 1` (one atomic Redis script; skips missing and revoked sessions), then publish `auth:claims-changed`.
- A token with `cv` below the session value gets 401 `TOKEN_CLAIMS_STALE`. The client refreshes like for an expired token. The new token carries fresh claims and the current version. Nobody is logged out.
- Claims are read fresh from MongoDB at login and at every refresh: role name, enabled capabilities, departments. Not cached. A user with no role, or a deleted role, gets the Member capabilities.

### 0.7 Error codes of phase 1

Each issue adds its codes to `contracts/error-codes.json` with the status below. Success bodies carry no code.

| Code | Status | Issue |
|---|---|---|
| `INVALID_CREDENTIALS` | 401 | 1.1 |
| `ACCOUNT_BLOCKED` | 403 | 1.1 (checked at login), used in 1.2 and 1.5 |
| `INVITATION_INVALID` | 404 | 1.1 |
| `INVITATION_EXPIRED` | 410 | 1.1 |
| `INVITATION_REVOKED` | 410 | 1.1 |
| `INVITATION_ALREADY_ACCEPTED` | 409 | 1.1 |
| `MEMBER_ALREADY_EXISTS` | 409 | 1.1 |
| `SESSION_REVOKED` | 401 | 1.2 |
| `TOKEN_CLAIMS_STALE` | 401 | 1.2 |
| `REFRESH_TOKEN_INVALID` | 401 | 1.2 |
| `REFRESH_TOKEN_REUSE` | 401 | 1.2 |
| `ROLE_NOT_FOUND` | 400 | 1.3 |
| `ROLE_NAME_TAKEN` | 409 | 1.3 |
| `OWNER_ROLE_IMMUTABLE` | 400 | 1.3 |
| `PRESET_ROLE_RENAME_FORBIDDEN` | 409 | 1.3 |
| `ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS` | 403 (params: `capabilities`) | 1.3 |
| `OWNER_ROLE_ASSIGN_FORBIDDEN` | 403 | 1.3 |
| `CANNOT_EDIT_OWN_ROLE` | 403 | 1.3 |
| `LAST_OWNER_CANNOT_BE_DEMOTED` | 409 | 1.3 |
| `MEMBER_NOT_FOUND` | 404 | 1.5 |
| `CANNOT_BLOCK_SELF` | 409 | 1.5 |
| `OWNER_BLOCK_FORBIDDEN` | 403 | 1.5 |
| `LAST_OWNER_CANNOT_BE_BLOCKED` | 409 | 1.5 |
| `INVITATION_NOT_PENDING` | 409 | 1.5 |
| `INVITATION_RESEND_COOLDOWN` | 429 (params: `ttl`) | 1.5 |

Existing codes used: `VALIDATION_FAILED`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `SERVICE_UNAVAILABLE`.

### 0.8 Environment variables

All names go in `.env.example` and `docs/environments.md`. In `prod` the service refuses to start when a required one is missing or still has an example value.

| Variable | Used by | Rule |
|---|---|---|
| `JWT_ACCESS_SECRET` | all services | required in prod, at least 32 characters |
| `JWT_ACCESS_TTL_SECONDS` | auth | default 900 |
| `REFRESH_TTL_SECONDS` | auth | default 2592000 |
| `TRUST_PROXY` | auth | hops of trusted `X-Forwarded-For`; `1` behind Caddy |
| `CLIENT_IP_HEADER` | auth | only when a CDN or tunnel in front sets it (for example `cf-connecting-ip`) and nothing reaches the service without it |
| `BOOTSTRAP_OWNER_EMAIL` | auth | required in prod; the only first-owner setting |
| `WORKSPACE_NAME` | auth | name of the workspace seeded at first boot |
| `CORS_ORIGINS` | auth | required in prod; comma list; no open default |
| `WEB_ORIGIN` | auth | required in prod; base of invitation links, including the first owner's link |

### 0.9 Not in phase 1

Google login, SSO and MFA (phase 6). Password reset, email codes, phone numbers (not planned). Friends (dropped; a member directory comes in 2.1). A "my sessions" screen. A cache for the session check.

### 0.10 Error body

- Every error answers `{ code }` plus an optional flat `params` object. Its values are strings or numbers.
- `params` is used where 0.7 lists params, and for 429 `retryAfterSeconds`.
- The contract change lands in 1.1.

### 0.11 Data

- One MongoDB database, `platform`, for every service.
- Each collection has one writer service. Other services only read it.

### 0.12 Libraries

Use these libraries; never hand-write what they do.

- `helmet`: security headers on every auth-service answer (1.1b).
- `express-rate-limit`: the burst limit, memory store.
- `jsonwebtoken`: sign and verify access tokens (1.2).
- `cookie-parser` and `cors`: the refresh cookie and cross-origin rules (1.2).
- `nodemailer`: optional invitation email (1.5).
- Java: `jjwt` and `spring-boot-starter-data-redis`: token and session check (1.4).
- Hand-written on purpose: the failure counters in Redis (per email, per IP, accept).
- Web, when needed: `@stomp/stompjs`, `@tanstack/vue-query`, `vee-validate` with `zod`,
  `shadcn-vue`, `openapi-typescript`.

---

## 1.1 Users, first owner, password login

These decisions define 1.1; the spec is written from them.

- User document: `id`, `email` (stored trimmed and lower case, unique index), `displayName`, `role` (`Owner` in 1.1; 1.3 replaces it with `roleId`, and the boot seeding step does the one-time mapping), `status` (`active` or `blocked`, default `active`), `passwordHash`, `createdAt`, `updatedAt`. `status` exists from day one so 1.5 needs no data change.
- Role names are `Owner`, `Admin`, `Member` (not upper case). Use `Owner` everywhere, including spec 009.
- First owner:
  - Env: `BOOTSTRAP_OWNER_EMAIL` only. No password in env, no setup route, no setup token.
  - At every boot, while no user exists and the email is set: replace any pending owner invitation with a new one (token 256 bits, only its sha256 stored, 7 days) and print the link `<WEB_ORIGIN>/invite/<token>` once to stdout as a plain line. This is the only place a token may be printed; the rule "no tokens in logs" gets this one written exception. Once a user exists, boot does nothing.
  - Accept: `POST /api/auth/invitations/:token/accept-password` with `{ password, displayName }`. The email comes from the invitation. The claim is one atomic conditional update; if creating the user fails the invitation goes back to pending. The user gets role `Owner`. Limit: 5 attempts per IP per 15 minutes. Answers: `INVITATION_INVALID` (404), `INVITATION_EXPIRED` (410), `INVITATION_REVOKED` (410), `INVITATION_ALREADY_ACCEPTED` (409).
  - 1.1 stores the invitation `role` as a name; 1.3 maps it to `roleId`.
  - Must not happen: two owners; a token in a response, an error or the JSON logs; a link printed once an owner exists; an accept that works after expiry or replacement.
- Login order, always the same:
  1. normalize the email,
  2. if the email is locked, 429 `RATE_LIMITED`,
  3. if the client IP has 20 failures in the window, 429 `RATE_LIMITED`,
  4. find the user,
  5. compare the password; for an unknown email compare against a dummy hash,
  6. on failure count it and answer 401 `INVALID_CREDENTIALS`,
  7. on success, if `status` is `blocked`, clear the counter (it was not a guess) and answer 403 `ACCOUNT_BLOCKED`,
  8. clear the counter and answer 200.

  Unknown emails count as failures; the dummy hash uses the same argon2 settings as real hashes.
- Limits (all fail closed when Redis is down, 503):
  - per email: 5 failures in 15 minutes, then 429 until the window ends;
  - per client IP: 20 failures in 15 minutes. Count failures only, not all attempts, so an office behind one address can log in all morning;
  - setup: 5 attempts per IP in 15 minutes;
  - burst: 5 requests per second per client on every auth route except refresh.
- A counter gets its expiry on the first failure (fixed window) and is cleared by a success.
- 429 carries a `Retry-After` header and `params.retryAfterSeconds`.
- The client IP comes from Express `trust proxy` set to `TRUST_PROXY`. Without it every user would share one bucket behind Caddy.
- Must not happen (add to the spec): a response that differs between unknown email and wrong password; a failure counted for a blocked account that typed the right password; a limit that counts successful logins.

## 1.2 Sessions, access token, rotating refresh token, logout

- Login now answers 200 with `{ accessToken, user }` and the refresh token as in 0.1. `GET /api/auth/me` returns the profile, role and `perms`; the web calls it after a refresh on page load.
- Create session: `sid`, refresh token, `sess:{sid}` hash (0.2), add to the user's set, in one Redis transaction. `claimsVersion` starts at 1.
- `POST /api/auth/refresh` takes the refresh token (cookie or body). One atomic Redis script does the whole decision:
  1. no session hash: `REFRESH_TOKEN_INVALID`;
  2. `revoked=1`: `ACCOUNT_BLOCKED` (403) if the reason is `blocked`, else `SESSION_REVOKED`; only when the token matches current or previous hash, so a stranger learns nothing;
  3. token hash equals the current hash: store the new hash, move the old one to `prevRefreshHash`, set `rotatedAt`, reset the 30-day TTL: success;
  4. token hash equals the previous hash: someone replayed a rotated token. Revoke this session (reason `refresh_reuse`), publish the event, answer `REFRESH_TOKEN_REUSE`;
  5. anything else: `REFRESH_TOKEN_INVALID`, no revoke (a forged token proves nothing).
- After a successful rotation: read the user, 403 `ACCOUNT_BLOCKED` if blocked (revoke the session first), read claims fresh, sign a new access token with the session's current `claimsVersion` as `cv`.
- No grace window for a just-rotated token in 1.2. Two tabs that refresh at the same moment will hit reuse detection and log out. We meet this in 1.6 on purpose and fix it there.
- Logout: `POST /api/auth/logout`, needs a valid access token, revokes the session of that token (`sid` from the token, never from the body). Reason `logout`. The cookie is cleared. Always 204.
- Refresh limit: its own burst of 100 per second, plus 10 per minute per session (keyed on the sid in the token).
- Revoke helpers (used later by 1.3, 1.5): revoke one session, revoke all sessions of a user (reason given), mark claims stale for users (0.6). Each publishes the event after the Redis change.
- Verifier: `jsonwebtoken` or the framework strategy with `algorithms: ['HS256']`, the secret from config only.
- Must not happen: a refresh token or `refreshHash` in a log or error; logout revoking a session of another user; a refresh that succeeds on a revoked session; a session hash recreated without a TTL by a late write (every write on a session uses a script or checks existence first); an access token accepted after logout.

## 1.3 Capabilities, roles, workspace settings

- `contracts/capabilities.json` is the list. Phase 1 starts with `MANAGE_WORKSPACE`, `MANAGE_MEMBERS`, `MANAGE_ROLES`, `VIEW_AUDIT_LOG`. Later phases add theirs (`MANAGE_DEPARTMENTS` in 4.1, AI and connector ones in phases 3 to 5). Adding one never changes existing roles by hand.
- Role document: `name` (unique), `isPreset`, `permissions` = map capability to true or false. Absent means disabled. A map, not a list, so the boot merge can tell "an admin switched it off" (false) from "new capability this release" (absent).
- Preset roles `Owner`, `Admin`, `Member`, seeded at every boot, idempotent:
  - Owner: matrix forced to every capability, every boot;
  - Admin and Member: stored values win; only capabilities missing from the stored map are added at the preset default;
  - preset names are reserved (any letter case) for other roles.
- Workspace: one document, created at first boot with `WORKSPACE_NAME`. Fields are added by later issues; `null` means "use the env default".
- Capability check on a route: `RequireCapability(cap)` after the auth middleware; reads `perms` from the token; 403 `FORBIDDEN` with `params.required`.
- Role rules (each is a test):
  - the Owner role cannot be edited or deleted;
  - a non-Owner can only create, edit or assign a role whose capabilities they all hold themselves (`ROLE_GRANT_EXCEEDS_OWN_PERMISSIONS`, lists the missing ones);
  - only an Owner can assign the Owner role or change an Owner;
  - nobody changes their own role;
  - the last active Owner cannot be demoted;
  - role name unique, trimmed, case-insensitive.
- When a role's capabilities change, mark claims stale for every holder, including users with no role when the role is `Member`. When a user's role changes, mark that user stale. Neither revokes sessions.
- Admin routes live under `/api/auth/admin/...` and each declares its capability: members and invitations `MANAGE_MEMBERS`, roles `MANAGE_ROLES`, workspace `MANAGE_WORKSPACE`, audit `VIEW_AUDIT_LOG`.

## 1.4 Session check in every service; events

- `packages/platform-common-java`: the JWT filter replaces the stub. Verify the signature (HS256), then the four checks in 0.3, then put the user (`userId`, `role`, `perms`, `depts`) into the Spring security context. Failures answer `{ code }` with the status in 0.3. No cache.
- auth-service uses the same four checks in its own middleware. It is the only Node service, so no shared TypeScript package is needed.
- The session field names and the event payloads live in `contracts/` and a contract test in Node and in Java fails when a name differs.
- Event publishing exists since 1.2. 1.4 adds the proof: block a user, the next call to chat-service answers 401 `SESSION_REVOKED`; change a role, the next call answers 401 `TOKEN_CLAIMS_STALE`.
- Listeners that close sockets arrive with 2.2. A periodic sweep that re-checks every open socket every 30 seconds comes with them, as a safety net for missed events.
- Must not happen: a service that starts accepting tokens when Redis is down; a route that skips the session check because it only needs a signature.

## 1.5 Invitations, members, block, audit

Invitations
- The accept endpoint already exists from 1.1; 1.5 adds create, resend, revoke, list, preview and the members features.
- Document: `email` (lower case), `roleId` (default Member), `departmentIds` (empty until 4.1), `invitedBy`, `tokenHash`, `expiresAt`, `status` (`pending`, `accepted`, `revoked`; expired is derived: pending and past `expiresAt`), `acceptedAt`, `acceptedUserId`, `lastSentAt`, `sendCount`. Unique index on `tokenHash`; unique partial index on `email` where `status` is `pending` (one live invitation per email).
- Token: 256 random bits, base64url, only its sha256 is stored, 7 days. Resend makes a new token and expiry, with a 60 second cooldown per invitation (Redis `SET NX`).
- Delivery in 1.5: no email server. The create and resend responses return `inviteUrl` (`<WEB_ORIGIN>/invite/<token>`) once, and the admin copies it. The token is never logged, never in the audit meta, never returned by list or get. Sending by email is a later add-on behind a setting.
- Create: email not already a member; role exists; a non-Owner cannot invite into a role with capabilities they lack, and only an Owner invites an Owner; no live pending invitation for the email.
- Preview `GET /api/auth/invitations/:token` (public, rate limited): `email`, `workspaceName`, `inviterName`, `roleName`, `expiresAt`. Shape-check the token first so garbage never reaches the database.
- Accept `POST /api/auth/invitations/:token/accept-password` with `{ password, displayName }`:
  1. email not already a user;
  2. claim: one conditional update `status pending and not expired` to `accepted`; exactly one concurrent accept wins;
  3. create the user with the invitation's role; if creation fails, put the invitation back to `pending`; a duplicate email answers `MEMBER_ALREADY_EXISTS`;
  4. save `acceptedUserId`, write an audit row;
  5. answer like a login (session, tokens).

Members
- List with cursor pagination (hard limit). Update a member: role, departments (the rules of 1.3 apply), then mark claims stale, then audit.
- Block and unblock: `PATCH /api/auth/admin/members/:id/status`. Blocking sets `status`, revokes all sessions (reason `blocked`), audits. Refused: self (`CANNOT_BLOCK_SELF`), an Owner by a non-Owner (`OWNER_BLOCK_FORBIDDEN`), the last active Owner (`LAST_OWNER_CANNOT_BE_BLOCKED`).
- System accounts (the AI user in phase 3) are hidden from the list and cannot be managed.

Audit log
- Append-only collection `audit_log`: `actorId`, `action` (machine key such as `member.update`, `role.create`, `invitation.revoke`), `targetType`, `targetId`, `meta`, `createdAt`. Index on `createdAt` descending.
- Writing an audit row never fails the action: errors are logged and swallowed. Boot-time actions use `actorId` `system`; readers must not treat it as an id.
- Reading: cursor pagination, newest first, limit at most 100. The server resolves actor and target names in batch (one query per collection) so clients never show raw ids. For a deleted target, the name saved in `meta` at write time is used.

## 1.6 Clients: login, refresh, accept invite, members screen

Web (Vue). Android later (issue #25), same rules.
- Pages: login, accept invitation (`/invite/:token`, also used by the first owner), members and invitations admin, sign out. Route guard: no session means `/login`; a signed-in user does not see login.
- Session restore on page load: call refresh (the cookie goes automatically), then `GET /api/auth/me`. Failure with 401 or 403 means signed out; 503 or network means show an "unavailable, retry" state, not the login page.
- One refresh function for the whole app: parallel 401s wait behind one refresh and then retry. Rules in 0.4.
- Two tabs: expect the reuse logout from 1.2 to show up here. Fixing it is part of 1.6 and gets its own regression test.
- Error handling: every server code maps to an i18n key (en and vi). Unknown code shows a generic message. Raw server text, ids and stack traces are never shown.
- Login screen notices come only from the allow-list in 0.4.
- Tokens: access token in a Pinia store (memory only), nothing in localStorage or sessionStorage.
- Must not happen: a token in storage or in the URL; a refresh loop on a login or refresh call; a logout caused by a 503 or a dropped network.
