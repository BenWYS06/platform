# Security rules

Job: the security rules every service and client follows. Loaded every session.

## Identity comes from the token

- The user id, roles and tenant come only from the verified JWT (`sub` and claims).
- Never read the acting user from the request body, query string or a custom header.
- An id in the path (`/users/{id}`) is a target, not proof of who is calling: check that the
  caller from the token may act on it.

## Internal key

- Service-to-service calls go to `/internal/...` routes only.
- Each internal route checks the `X-Internal-Key` header against the env value with a
  constant-time compare. Missing or wrong key: 401, no detail.
- Caddy blocks `/internal` from outside. That is the second layer, not the only one.

## Secrets

- Secrets live only in env variables. Names go in `.env.example`, values never go in git.
- Never log tokens, passwords, keys, full request bodies or `Authorization` headers.
  One written exception: the first-owner boot link. While no user exists, auth-service
  writes `<WEB_ORIGIN>/invite/<token>` once per boot to stdout with a plain write, never
  through pino (spec 009 A5, A25). No other token is ever written.
- Each service refuses to start in production with a missing or default secret
  (production guard).
- Claude never reads or edits `.env` files or keys: settings deny it and
  `.claude/hooks/protect-files.sh` blocks it. Do not try to work around either.

## Errors

- Error responses are `{ code, message?, params? }` with a code from `contracts/error-codes.json`.
  `params` values are a string, a number or a list of strings
  (`contracts/schemas/error-body.schema.json`); never a secret or a token.
- No stack traces, SQL/Mongo queries or internal hostnames in responses.
- Same answer for "user not found" and "wrong password".

## Checklist for a new endpoint

- [ ] Auth required? If public, say why in the PR.
- [ ] Caller identity taken from the token, not from input.
- [ ] Caller allowed to touch this resource (ownership or role check).
- [ ] Input validated (types, length, allowed values) before use.
- [ ] Errors use a contract error code.
- [ ] Rate limit considered for login, sign-up and anything costly (AI calls).
- [ ] No secret or personal data in logs.
- [ ] Listed in the service OpenAPI file.
- [ ] Tests: allowed caller succeeds, other user gets 403, no token gets 401.
