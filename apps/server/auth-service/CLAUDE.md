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
- `src/server.ts`: config, store clients, listen, startup loop, shutdown.
- `src/routes/` (HTTP only) -> `src/services/` (logic) -> `src/repositories/` (MongoDB, Redis).
- MongoDB through Mongoose, not the raw driver (D-009). `src/models/`: schemas, models and
  indexes; only repositories import them, routes never import Mongoose (lint enforces it).
- `src/repositories/`: `stores.ts` (Mongoose connection, Redis client), `users.ts`,
  `invitations.ts` (only writer of both in `platform`). Emails are stored trimmed and lower
  case. `mapStoreErrors`: duplicate key (11000) -> `DuplicateError`, MongoDB unreachable ->
  `StoreUnavailableError` (the error handler answers 503).
- `src/services/startup.ts`: one retry loop (every 30 s) connects and runs `syncIndexes`,
  then the after-index step. Until the indexes exist, data routes answer 503 (`middleware/ready.ts`);
  health answers from the start. Data routes mount behind `requireReady` in `app.ts`.
- `src/middleware/`: contract error handler, internal key check, readiness gate.
- `src/logger.ts`: pino; `Authorization`, `Cookie`, `X-Internal-Key` are redacted.
- Routes: `GET /api/auth/health` (pings MongoDB and Redis, 2.5 s timeout), `GET /internal/ping`
  (behind `X-Internal-Key`). API: `openapi.yaml`; update it with every route change.

## Config

- Env first; `npm start` and `npm run dev` also load the repo `.env`
  (`--env-file-if-exists`). Names in `.env.example`. MongoDB database `platform`.
- `APP_ENV=prod` refuses a missing, short or default `INTERNAL_API_KEY`, and a missing
  `MONGODB_URI` or `REDIS_URL`, and a missing or example `BOOTSTRAP_OWNER_EMAIL` or
  `WEB_ORIGIN`. Bad config or a port in use exits with code 1 (`test/startup.test.ts`).
- `TRUST_PROXY` and `CLIENT_IP_HEADER` decide the client IP: `docs/environments.md`.

## Libraries

Use these; never hand-write them (`docs/auth-design.md` 0.12).

- `helmet`: security headers (1.1b).
- `express-rate-limit`: burst limit, memory store.
- `jsonwebtoken`: access tokens (1.2).
- `cookie-parser` and `cors`: refresh cookie, cross-origin rules (1.2).
- `nodemailer`: optional invitation email (1.5).
- Java: `jjwt` and `spring-boot-starter-data-redis` (1.4).
- Hand-written on purpose: failure counters in Redis (per email, per IP, accept).
- Web, when needed: `@stomp/stompjs`, `@tanstack/vue-query`, `vee-validate` + `zod`, `shadcn-vue`, `openapi-typescript`.

## Gotchas

- Route tests use fakes: `createApp` takes `health` and `readiness` objects. Repository and
  startup tests use a real MongoDB (`test/helpers/mongo.ts`, Testcontainers): Docker must be
  running, the first run pulls `mongo:8.0.17`. Each test uses its own database name.
- Mongoose connection: `bufferCommands: false`, `serverSelectionTimeoutMS: 2000`,
  `autoIndex: false`. A query fails in about 2 s when MongoDB is down, at once before the
  first connect (with buffering it would wait 10 s). A failed first connect is retried by
  the next `connectMongo()`; index changes go in the schema, built by `syncIndexes`, which
  also drops indexes the schema does not list.
- Tests check every error answer with `expectError` (`test/helpers/error-body.ts`): status,
  code and the contract error-body schema. `throw new ApiError(code, params?)` in code.
- TypeScript stays on 6.0.x until typescript-eslint supports 7.
- Express 5 calls the `app.listen` callback on errors too; `server.ts` uses `node:http`.
