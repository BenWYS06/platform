---
paths:
  - "apps/server/auth-service/**"
---

# Express rules

Job: conventions for auth-service (Express + TypeScript).

- Node LTS, TypeScript in `strict` mode, ES modules. Scripts: `npm run build`, `npm test`,
  `npm run lint`.
- Layout by feature (D-012). `src/` holds `app.ts`, `server.ts`, `config.ts`, `logger.ts`;
  `common/` (no feature knowledge), `infra/` (store connections), `middleware/`
  (cross-cutting, plain names) and `modules/<feature>/`.
  1. A new feature is a new folder `src/modules/<feature>/`. Files inside are
     `<name>.<role>.ts`, role one of routes, service, repository, model, middleware,
     scripts, util; plus `index.ts`. `common/`, `infra/`, `middleware/` use plain names.
  2. Inside a module: routes -> service -> repository -> model. Routes never import a model
     or Mongoose. Mongoose only in `*.model.ts`, `*.repository.ts`, `infra/stores.ts` and
     `common/storeErrors.ts`; a model is imported only by a repository, a model or the
     module `index.ts`.
  3. A module imports another module only through its `index.ts`, which exports only what
     others need. Besides that, a module file may import `config.ts`, `common/`, `infra/`
     and `middleware/clientIp.ts`; a test next to source may also import `app.ts`,
     `logger.ts` and `test/helpers/`. `common/` and `infra/` import no module (one
     exception: `common/failureCounter.ts` imports the `RedisClient` type from `infra/`).
     `app.ts`, `server.ts` and `middleware/` may import module `index.ts` files.
  4. About 12 source files per folder at most (tests not counted); past that, a sub-folder
     (`modules/auth/session/`).
  5. Tests live next to the file they test (`<name>.<role>.test.ts`); tests of the whole
     app, or that need a file rule 3 does not allow, stay in `test/`.
  ESLint `no-restricted-imports` enforces 2 and 3; `scripts/ci/check-structure.mjs` the
  names and the old layer folders.
- Validate every request body, query and params with a schema (zod) before use.
- Async handlers pass errors to the single error middleware; it returns
  `{ code, message?, params? }` with a code from `contracts/error-codes.json`. No `res.status(500).send(err)`.
  Exception: health answers 503 `{"status":"DOWN"}` itself (D-010b).
- Config read and validated once at startup from env; the production guard refuses unsafe
  values. No `process.env` reads outside the config module.
- Passwords: argon2 only. Tokens: short-lived access JWT plus refresh token; signing key
  from env.
- Rate limit login, sign-up and password reset.
- Logs: pino + pino-http, JSON with request id; `Authorization`, `Cookie` and
  `X-Internal-Key` redacted. Never log passwords, tokens or full bodies.
- No `any` without a comment saying why.
- Tests: Vitest + supertest against the app, see `testing.md`.
