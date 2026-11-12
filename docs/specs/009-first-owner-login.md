# Spec 009: 1.1 Users, first owner, password login

Issue: #34 1.1a First owner (Sprint 2, estimate 5) and #35 1.1b Login (Sprint 2, estimate 3).
Total estimate 8. One spec, two parts; each part has its own plan and PR. 1.1b needs 1.1a.

Design: `docs/auth-design.md` sections 0 and 1.1. The decisions below copy it; where the
spec adds its own, they are tagged Claude.

## Why

Every Phase 1 issue needs a user who can prove who they are. A fresh install has no users,
so the first owner must be able to claim the workspace without a password in config and
without a stranger who reaches a new server first taking it over. Sessions (1.2), roles
(1.3) and invitations (1.5) all build on the users collection, the invitation claim and the
password check made here.

## What we build

### 1.1a First owner (#34)

1. Contract
   - Error body `{ code, message?, params? }`; `params` values are a string, a number or a
     list of strings. Schema `contracts/schemas/error-body.schema.json`.
   - New codes in `contracts/error-codes.json`: `INVITATION_INVALID` 404,
     `INVITATION_EXPIRED` 410, `INVITATION_REVOKED` 410, `INVITATION_ALREADY_ACCEPTED` 409,
     `MEMBER_ALREADY_EXISTS` 409. The README example uses a real code name.
2. Data, in database `platform` (D-008; auth-service is the only writer)
   - `users`: `id`, `email` (trimmed, lower case, unique), `displayName`, `role` (`Owner`),
     `status` (`active` or `blocked`), `passwordHash` (argon2id), `createdAt`, `updatedAt`.
   - `invitations`: `email`, `role` (a name), `invitedBy` (`system`), `tokenHash`,
     `expiresAt`, `status` (`pending`, `accepted`, `revoked`), `acceptedAt`,
     `acceptedUserId`, `createdAt`. Unique index on `tokenHash`; unique index on `email`
     among pending invitations.
   - Indexes are created at startup, before the service answers.
3. Boot link
   - While no user exists and `BOOTSTRAP_OWNER_EMAIL` is set: revoke any pending owner
     invitation, store a new one (256-bit token, only its sha256, 7 days) and print
     `<WEB_ORIGIN>/invite/<token>` once to stdout as a plain line. Once a user exists, boot
     does nothing.
4. Accept: `POST /api/auth/invitations/:token/accept-password`
   - Body `{ password, displayName }`; the email comes from the invitation.
   - Atomic claim, then create the user with role `Owner`; on failure the invitation goes
     back to pending. Answer 201 `{ user }`.
   - Limit 20 failures per client IP per 15 minutes; failures are the token-check answers
     404, 410 and 409; successful accepts do not count. 429 with `Retry-After` and
     `params.retryAfterSeconds`. Fails closed (503) when Redis is down.
5. Client IP from `TRUST_PROXY` (Express `trust proxy`), or `CLIENT_IP_HEADER` when set.
6. The invitation token is masked as `[redacted]` in every log line that carries the path.
7. Config: `BOOTSTRAP_OWNER_EMAIL` and `WEB_ORIGIN` required in prod; `TRUST_PROXY` and
   `CLIENT_IP_HEADER` added. Rule texts in `CLAUDE.md` and `.claude/rules/security.md`
   updated (error body, the written exception for the boot link).

### 1.1b Login (#35)

1. `POST /api/auth/login` with `{ email, password }`: 200 `{ user }`, 401
   `INVALID_CREDENTIALS`, 403 `ACCOUNT_BLOCKED`, in the fixed order of decision B1.
2. Failure limits per email and per client IP, and a burst limit on every auth route
   except refresh (accept included, on top of its 1.1a failure limit); all fail closed.
3. New codes `INVALID_CREDENTIALS` 401 and `ACCOUNT_BLOCKED` 403.

## Out of scope

- Access and refresh tokens, sessions, logout: 1.2.
- Roles other than the stored name `Owner`, capabilities, workspace: 1.3.
- Admin invitations (create, resend, revoke, list, preview) and members, block: 1.5.
- Screens in web and Android: 1.6 (Android: later, issue #25).
- Web invite page: no access log for that path and `Referrer-Policy: no-referrer` when the
  web is served through Caddy (deploy issue).
- Redis pub/sub channel names: 1.2.
- Password reset, email codes, MFA: not in Phase 1 (design 0.9).

## Edge cases

- `BOOTSTRAP_OWNER_EMAIL` with capitals or spaces: stored trimmed and lower case; login with
  any letter case finds the user.
- auth-service runs as a single instance. If two boot at once with no user, the later
  invitation wins and its link is the one that works; both may print, and the earlier link
  answers 410 `INVITATION_REVOKED`.
- MongoDB down at boot: the service starts; health answers 200 and data routes answer 503
  until the indexes exist; one retry loop every 30 s creates the indexes, then runs the
  boot step once.
- An old link after a reboot replaced it: 410 `INVITATION_REVOKED`.
- A token of the wrong shape (not 43 base64url characters): 404 `INVITATION_INVALID`, no
  database call.
- Accept body with an `email` field: 400 `VALIDATION_FAILED` (unknown field).
- Password with spaces at the ends or non-ASCII characters: accepted and compared exactly.
- Body over the JSON size limit: 400 `VALIDATION_FAILED`.
- Redis down: accept and login answer 503 `SERVICE_UNAVAILABLE`, never 401 or 200.
- Many people behind one office IP: only failures count toward the IP limits of login and
  accept; successful logins and accepts never do.
- argon2 native package on Windows (local) and Linux (CI): both install without a compiler.

## Must not happen

From the design, 1.1a:
- Two owners.
- A token in a response, an error or the JSON logs (the one boot link on stdout is the
  written exception).
- A link printed once an owner exists.
- An accept that works after expiry or replacement.

From the design, 1.1b:
- A response that differs between unknown email and wrong password.
- A failure counted for a blocked account that typed the right password.
- A limit that counts successful logins.

Both parts:
- A password or `passwordHash` in a response, a log or an error.
- A password or first-owner secret in env; any setup route.
- A limit that lets requests through when Redis is down.

## Open items

- The Java `ErrorBody` has no `params`. Add it when a Java route first needs it, no later
  than 1.4.

---

## 1.1a Decisions

- A1. User document: `id`, `email` (stored trimmed and lower case, unique index),
  `displayName`, `role`, `status` (`active` or `blocked`, default `active`, there from day
  one), `passwordHash`, `createdAt`, `updatedAt`. Owner
- A2. Role names are `Owner`, `Admin`, `Member`; the first owner gets `Owner`; 1.3 replaces
  `role` with `roleId`. Owner
- A3. `BOOTSTRAP_OWNER_EMAIL` is the only first-owner setting: no password in env, no setup
  route, no setup token. Owner
- A4. At every boot, while no user exists and the email is set: replace any pending owner
  invitation (token 256 bits, only its sha256 stored, 7 days) and print
  `<WEB_ORIGIN>/invite/<token>` once to stdout as a plain line. Once a user exists, boot
  does nothing. Owner
- A5. The rule "no tokens in logs" gets one written exception: that boot link. Owner
- A6. Accept: `POST /api/auth/invitations/:token/accept-password` with
  `{ password, displayName }`; email from the invitation; one atomic conditional update
  claims it; if creating the user fails the invitation goes back to pending; role `Owner`;
  limit 20 failures per client IP per 15 minutes, where failures are the token-check
  answers (404, 410, 409) and successful accepts do not count; answers
  `INVITATION_INVALID` 404, `INVITATION_EXPIRED` 410, `INVITATION_REVOKED` 410,
  `INVITATION_ALREADY_ACCEPTED` 409. Owner
- A7. 1.1a stores the invitation `role` as a name; 1.3 maps it to `roleId`. Owner
- A8. The client IP comes from Express `trust proxy` set to `TRUST_PROXY`;
  `CLIENT_IP_HEADER` only when set. Owner
- A9. Error body `{ code, message?, params? }`; `params` values are a string, a number or a
  list of strings. Owner
- A10. New codes: `INVITATION_INVALID` 404, `INVITATION_EXPIRED` 410, `INVITATION_REVOKED`
  410, `INVITATION_ALREADY_ACCEPTED` 409, `MEMBER_ALREADY_EXISTS` 409. Owner
- A11. Collections `users` and `invitations` in database `platform`; auth-service is the
  only writer of both (D-008). Owner
- A12. Env: `BOOTSTRAP_OWNER_EMAIL` and `WEB_ORIGIN` required in prod; `TRUST_PROXY`,
  `CLIENT_IP_HEADER`; names in `.env.example` and `docs/environments.md`; prod refuses a
  missing or example value. Owner
- A13. Limits fail closed: Redis down answers 503, never 401. Owner
- A14. A 429 carries a `Retry-After` header and `params.retryAfterSeconds`; built in 1.1a
  for the accept limit, reused by 1.1b. Owner
- A15. The `contracts/README.md` example name is fixed in 1.1a. Owner
- A16. Estimate 5, Sprint 2, issue #34. Owner
- A17. Accept answers 201 `{ user }` with `user` = `{ id, email, displayName, role }`; 1.2
  adds tokens next to `user`. Claude
- A18. Password 12 to 128 characters, used exactly as typed; `displayName` trimmed, 1 to 64
  characters; unknown fields refused; all 400 `VALIDATION_FAILED`. Claude
- A19. argon2id at the OWASP minimum (m=19456, t=2, p=1), with a package that has prebuilt
  binaries for Windows and Linux. Claude
- A20. Invitation document in the 1.5 shape: `email`, `role`, `invitedBy: "system"`,
  `tokenHash`, `expiresAt`, `status`, `acceptedAt`, `acceptedUserId`, `createdAt`; unique
  index on `tokenHash`; unique partial index on `email` where `status` is `pending`. Claude
- A21. Indexes are created at startup and awaited before any data route answers. Claude
  Indexes are built with Mongoose `syncIndexes`, awaited at startup; `autoIndex` is off
  (A31). Owner
- A22. Replacing an invitation sets the old one to `revoked`, so its link answers 410
  `INVITATION_REVOKED`. Claude
- A23. Accept check order: token shape (43 base64url characters, else 404 with no database
  call), limit, body, invitation lookup and status, email already a user (409
  `MEMBER_ALREADY_EXISTS`), claim, create. The plan decides whether a malformed token (404
  with no database call) counts as an accept failure; counting it is fine. Claude
- A24. Boot step: runs after the indexes, in the same retry loop (every 30 s while MongoDB
  is down, until it has run once); the service serves meanwhile. auth-service runs as a
  single instance. If two boot at once,
  the later invitation wins and its link is the one that works; both may print (a
  duplicate on the pending-email index makes the boot step revoke and insert again, at
  most 3 times). Claude
- A25. The link is printed with a plain stdout write, not through pino. Claude
- A26. Local defaults: `TRUST_PROXY=1`, `WEB_ORIGIN=http://localhost:5173`; an empty
  `BOOTSTRAP_OWNER_EMAIL` locally skips the boot step with one warning. Claude
- A27. The token segment of `/api/auth/invitations/<token>...` (accept, and preview later)
  is masked as `[redacted]` in request logs, error logs and 404 logs. Claude
- A28. New `contracts/schemas/error-body.schema.json`; the auth tests check every error
  answer against it. Claude
- A29. Atomic-claim and limit tests run against a real MongoDB and Redis (Testcontainers);
  other tests keep fakes; the auth `CLAUDE.md` gotcha is updated. Claude
- A30. If MongoDB is down at boot the service still starts and /health answers. Every
  data route (accept, later login) answers 503 SERVICE_UNAVAILABLE until the indexes exist.
  One retry loop every 30 s creates the indexes, then runs the boot step, so the boot step
  never runs before the indexes exist. Owner
  The Mongoose connection sets `bufferCommands: false` and `serverSelectionTimeoutMS: 2000`,
  so data routes answer 503 quickly when MongoDB is down, not after a 10 s buffer. Owner
- A31. Data access: Mongoose models behind the repository interfaces; routes never import
  Mongoose (D-009). Owner

## 1.1a Done when

1. `cd contracts && npm test` passes: the 5 new codes have their statuses; the README
   example uses a real code name; `error-body.schema.json` accepts `params` values of
   string, number or list of strings and rejects nested objects. [A9, A10, A15, A28]
2. The auth contract test passes: `ERROR_STATUS` matches the contracts, and every error
   answer in the auth tests fits the error-body schema. [A10, A28]
3. After accept, the user in `platform.users` has every field, email lower case,
   `status: active`, `role: Owner`. Creating a user with the same email in other letter
   case through the repository (which lower-cases the email first) fails as a duplicate on
   the plain unique `email` index. [A1, A2, A11]
4. A startup test shows no data route answers before index creation finishes (health
   answers);
   after boot, `platform.invitations` has the unique `tokenHash` index and the unique
   pending-email index. With MongoDB down at start, health answers 200 and accept answers
   503; after MongoDB is back, accept works with no restart. [A20, A21, A24, A30]
5. A stored `passwordHash` starts with `$argon2id$v=19$m=19456,t=2,p=1` or stronger
   settings. [A19]
6. Boot with no user and the email set: one pending invitation (role `Owner`, expiry now
   + 7 days, `tokenHash` = sha256 of the printed token); stdout has exactly one link line;
   the JSON logs do not contain the token. [A4, A5, A7, A20, A25]
7. A second boot with still no user revokes the old invitation and prints a new link; the
   old link answers 410 `INVITATION_REVOKED`. [A4, A22]
8. Boot once a user exists: nothing written, nothing printed. Boot with the email unset:
   nothing written, one warning. [A4, A26]
9. The printed link works once: accept answers 201 `{ user }` with role `Owner`, the
   invitation's email, and a stored hash that verifies the chosen password; the same link
   again answers 409 `INVITATION_ALREADY_ACCEPTED`. [A6, A17]
10. 10 parallel accepts with one token give exactly one 201, nine 409 and one user, against
    a real MongoDB. [A6, A29]
11. An expired link answers 410 `INVITATION_EXPIRED`; an unknown token answers 404
    `INVITATION_INVALID`; a malformed token answers 404 with no database call. [A6, A23]
12. User creation failing after the claim puts the invitation back to pending, and the link
    works afterwards; an email that is already a user answers 409 `MEMBER_ALREADY_EXISTS`.
    [A6, A23]
13. 20 failed accepts (unknown, expired, revoked or used token) from one IP within 15
    minutes make the 21st attempt answer 429 with `Retry-After` equal to
    `params.retryAfterSeconds`; a successful accept does not raise the counter. [A6, A14]
14. With Redis stopped, accept answers 503 `SERVICE_UNAVAILABLE`. [A13]
15. With `TRUST_PROXY=1`, two different `X-Forwarded-For` values get separate accept
    counters; with `CLIENT_IP_HEADER=cf-connecting-ip`, that header decides. [A8]
16. Password of 11 or 129 characters, `displayName` empty or 65 characters, missing fields
    and unknown fields answer 400 `VALIDATION_FAILED`. [A18]
17. Accept requests that succeed, answer 404, or hit a forced error log the path as
    `/api/auth/invitations/[redacted]/...`; the token text is in none of those log lines.
    [A27]
18. `APP_ENV=prod` without `BOOTSTRAP_OWNER_EMAIL` or `WEB_ORIGIN` exits with code 1 and
    names the variable (config test); `git grep -n "SETUP_" -- apps .env.example` prints
    nothing. [A3, A12]
19. `grep` shows `{ code, message?, params? }` and the written exception for the boot link
    in `CLAUDE.md` and `.claude/rules/security.md`. [A5, A9]
20. `openapi.yaml` lists accept with every answer; `.env.example` and
    `docs/environments.md` list the 4 variables; `docs/architecture.md` describes users and
    the first owner; `node scripts/ci/check-env.mjs` passes. [A12]
21. `cd apps/server/auth-service && npm ci && npm run build && npm run lint && npm test`
    passes on Windows, and the `auth-service` CI job passes on Linux, with the argon2
    package installed on both. [A19, A29]
22. Through Caddy: boot prints the link; accept via `localhost:8080` answers 201, a second
    time 409; a restart prints nothing. [A4, A6]

---

## 1.1b Decisions

- B1. Login order, always the same: 1. normalize the email; 2. if the email is locked, 429
  `RATE_LIMITED`; 3. if the client IP has 20 failures in the window, 429 `RATE_LIMITED`;
  4. find the user; 5. compare the password, against a dummy hash for an unknown email;
  6. on failure count it and answer 401 `INVALID_CREDENTIALS`; 7. on success, if `status`
  is `blocked`, clear the counter (it was not a guess) and answer 403 `ACCOUNT_BLOCKED`;
  8. clear the counter and answer 200. Owner
- B2. Unknown emails count as failures; the dummy hash uses the same argon2 settings as
  real hashes. Owner
- B3. Limits, all failing closed (Redis down: 503): per email 5 failures in 15 minutes,
  then 429 until the window ends; per client IP 20 failures in 15 minutes, failures only;
  burst 5 requests per second per client on every auth route except refresh (accept
  included). Owner
- B4. A counter gets its expiry on the first failure (fixed window) and is cleared by a
  success. Owner
- B5. A 429 carries `Retry-After` and `params.retryAfterSeconds`, reusing the 1.1a answer.
  Owner
- B6. New codes: `INVALID_CREDENTIALS` 401, `ACCOUNT_BLOCKED` 403. Owner
- B7. Estimate 3, Sprint 2, issue #35. Owner
- B8. Login answers 200 `{ user }`, the same shape as accept; 1.2 adds tokens. Claude
- B9. Email: valid format, at most 254 characters, trimmed and lower-cased before lookup;
  bad input 400 `VALIDATION_FAILED`. Claude
- B10. The dummy hash is computed once at startup. Claude
- B11. The burst limit does not cover health or `/internal`; its 429 has `Retry-After: 1`.
  Claude
- B12. Rate-limit keys hold the sha256 of the email, never the email itself. Claude

## 1.1b Done when

1. `cd contracts && npm test` passes with `INVALID_CREDENTIALS` 401 and `ACCOUNT_BLOCKED`
   403; the auth contract test matches them. [B6]
2. The right password answers 200 `{ user }`; a wrong password and an unknown email give
   identical 401 bodies; a spy shows the unknown email was checked against the dummy hash,
   which has the real hash settings. [B1, B2, B8, B10]
3. Unknown emails count toward the per-email limit: 5 failures for an email that does not
   exist make the 6th attempt 429; for a real user, after 5 failures even the right
   password gets 429 until the window ends. [B2, B3]
4. 20 failures from one IP across different emails make the 21st attempt 429; 30
   successful logins from one IP all answer 200. [B3]
5. The first failure sets a 900 s expiry on the counter and a success deletes it (checked in
   Redis). [B4]
6. A blocked user with the right password gets 403 `ACCOUNT_BLOCKED` and the counter is
   cleared; with a wrong password the answer is 401 and the failure is counted. [B1]
7. Every login 429 has `Retry-After` equal to `params.retryAfterSeconds`. [B5]
8. The 6th request within one second from one IP, to login or accept, answers 429 with
   `Retry-After: 1`; health is never limited. [B3, B11]
9. With Redis stopped, login answers 503 `SERVICE_UNAVAILABLE`. [B3]
10. A scan of the Redis keys after a failed login finds no plain email. [B12]
11. A bad or too-long email, missing fields and unknown fields answer 400
    `VALIDATION_FAILED`. [B9]
12. `openapi.yaml` lists login with every answer; `docs/architecture.md` describes login.
    [B1]
13. `cd apps/server/auth-service && npm ci && npm run build && npm run lint && npm test`
    passes on Windows, and the `auth-service` CI job passes on Linux. [B7]
14. Through Caddy: after the 1.1a accept, login via `localhost:8080` with the chosen
    password answers 200 and a wrong one 401. [B1]
