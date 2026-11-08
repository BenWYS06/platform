---
paths:
  - "services/auth-service/**"
---

# Express rules

Job: conventions for auth-service (Express + TypeScript).

- Node LTS, TypeScript in `strict` mode, ES modules. Scripts: `npm run build`, `npm test`,
  `npm run lint`.
- Layout: `routes/` (HTTP only) -> `services/` (logic) -> `repositories/` (MongoDB).
- Validate every request body, query and params with a schema (zod) before use.
- Async handlers pass errors to the single error middleware; it returns `{ code, message? }`
  with a code from `contracts/error-codes.json`. No `res.status(500).send(err)`.
- Config read and validated once at startup from env; the production guard refuses unsafe
  values. No `process.env` reads outside the config module.
- Passwords: argon2 or bcrypt, never a fast hash. Tokens: short-lived access JWT plus
  refresh token; signing key from env.
- Rate limit login, sign-up and password reset.
- Logs: pino JSON with request id; never log passwords, tokens or full bodies.
- No `any` without a comment saying why.
- Tests: Vitest + supertest against the app, see `testing.md`.
