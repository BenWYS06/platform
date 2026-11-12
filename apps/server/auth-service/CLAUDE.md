# auth-service

Job: what Claude needs when working in `apps/server/auth-service`. Rules: `.claude/rules/express.md`.

Express 5 + TypeScript (strict, ES modules), Node 24. Port 3001 (`AUTH_SERVICE_PORT`); Caddy
forwards `/api/auth/*` here with the prefix kept.

## Commands

| Task | Command |
|---|---|
| Install, build, lint, test | `npm ci && npm run build && npm run lint && npm test` |
| Run locally (infra up first) | `npm run dev` (watch) or `npm run build && npm start` |

## Layout

- `src/config.ts`: the only `process.env` reader (lint enforces it); production guard.
- `src/app.ts`: builds the app without listening (tests use it with supertest).
- `src/server.ts`: config, store clients, listen, shutdown.
- `src/routes/` (HTTP only) -> `src/services/` (logic) -> `src/repositories/` (MongoDB, Redis).
- `src/middleware/`: contract error handler, internal key check.
- `src/logger.ts`: pino; `Authorization`, `Cookie`, `X-Internal-Key` are redacted.
- Routes: `GET /api/auth/health` (pings MongoDB and Redis, 2.5 s timeout), `GET /internal/ping`
  (behind `X-Internal-Key`). API: `openapi.yaml`; update it with every route change.

## Config

- Env first; `npm start` and `npm run dev` also load the repo `.env`
  (`--env-file-if-exists`). Names in `.env.example`. MongoDB database `platform`.
- `APP_ENV=prod` refuses a missing, short or default `INTERNAL_API_KEY`, and a missing
  `MONGODB_URI` or `REDIS_URL`. Bad config or a port in use exits with code 1.

## Gotchas

- Tests never touch real stores: `createApp` takes a `health` object, tests pass a fake.
- Tests check every error answer with `expectError` (`test/helpers/error-body.ts`): status,
  code and the contract error-body schema. `throw new ApiError(code, params?)` in code.
- TypeScript stays on 6.0.x until typescript-eslint supports 7.
- Express 5 calls the `app.listen` callback on errors too; `server.ts` uses `node:http`.
