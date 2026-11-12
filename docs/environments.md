# Environments

Job: each environment, how to reach it, and where its config lives. No secret values here.

| Environment | Where | Config | Status |
|---|---|---|---|
| local | developer machine: stores and Caddy in Docker (`infra/docker-compose/compose.yml`), services on the host | `.env` copied from `.env.example` | ready (issue 0.3) |
| dev | TBD | TBD | not set up |
| prod | TBD | TBD | not set up |

## Local

Start: `docker compose --env-file .env -f infra/docker-compose/compose.yml up -d --wait`. Check: `node infra/docker-compose/smoke.mjs`.
Reset (deletes all local data): `docker compose --env-file .env -f infra/docker-compose/compose.yml down -v`.
Details and Windows problems: `infra/docker-compose/README.md`.

| What | Address (host, `127.0.0.1` only) |
|---|---|
| Gateway (clients use this) | `http://localhost:8080/api/...` |
| MongoDB (replica set `rs0`) | `mongodb://localhost:27017/?replicaSet=rs0` |
| Redis | `redis://localhost:6379` |
| RabbitMQ | `amqp://localhost:5672` (login from `.env`) |
| RabbitMQ UI | `http://localhost:15672` |
| Qdrant | `http://localhost:6333` |
| auth / chat / ai service | listen on the host at 3001 / 8081 / 8082 (`*_SERVICE_PORT` in `.env`) |
| Service health | `http://localhost:8080/api/{auth,chat,ai}/health` |
| Web client (dev) | `http://localhost:5173` (`npm run dev` in `apps/web`); `/api` forwarded to the gateway |

### Service variables (issue 0.4)

| Variable | Used by | Local | prod |
|---|---|---|---|
| `APP_ENV` | all | `local` (default) | `prod` |
| `INTERNAL_API_KEY` | all | empty: a fixed local default | required, at least 32 characters |
| `MONGODB_URI` | all (database `platform`, set in code) | default `mongodb://localhost:27017/?replicaSet=rs0` | required |
| `REDIS_URL` | auth | default `redis://localhost:6379` | required |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | chat, ai | from `.env` (also used by compose) | password required |
| `RABBITMQ_HOST`, `RABBITMQ_PORT` | chat, ai | default `localhost`, `5672` | set to the prod broker |

### First owner and client IP (issue 1.1a, auth)

| Variable | Local | prod |
|---|---|---|
| `BOOTSTRAP_OWNER_EMAIL` | empty: no boot link, one warning | required, not `owner@example.com`; stored trimmed and lower case |
| `WEB_ORIGIN` | default `http://localhost:5173` | required, not the local value; origin only, no path |

How auth finds the client IP (used by the accept failure limit):

| Variable | Local dev | Production behind Cloudflare | Self-host without Cloudflare |
|---|---|---|---|
| `TRUST_PROXY` | default `1` (Caddy) | unset | `1` (your reverse proxy) |
| `CLIENT_IP_HEADER` | unset | `cf-connecting-ip` | unset |

`TRUST_PROXY` is Express `trust proxy`: a hop count, `true`, `false` or a list of
addresses; unset means none outside local. When `CLIENT_IP_HEADER` is set, that header decides.

> **Warning:** never set `CLIENT_IP_HEADER` on a host that clients can reach directly. They
> could send the header themselves and choose their own counter.

Services read the repo `.env` at startup; real env variables win. Leave `MONGODB_URI` and
`REDIS_URL` out of `.env` locally: an empty value is not the same as a missing one for Spring.

## Notes

- Android (planned, issue #25, 0.7b): `dev` and `prod` flavors, with the server URL behind
  `ServerConfig`.
- Services refuse to start in production with unsafe config (production guard, see above).
- Variable names are listed in `.env.example`; real values never go into git.
