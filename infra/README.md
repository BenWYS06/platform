# Local infra

Job: run the data stores and the Caddy gateway on a developer machine. Services run on the
host (from the IDE); only the stores and Caddy run in Docker.

## First time

1. Install Docker Desktop (Windows, macOS) or Docker Engine with the compose plugin (Linux),
   and Node 20 or newer.
2. From the repo root, copy `.env.example` to `.env` and set `RABBITMQ_USER` and
   `RABBITMQ_PASSWORD` to values of your choice. They are local only; never commit `.env`.

## Commands

Run from the repo root. Every compose command needs `--env-file .env`, because compose reads
the RabbitMQ variables for any command (`ps`, `logs`, `down` too).

| Task | Command |
|---|---|
| Start and wait until all healthy | `docker compose --env-file .env -f infra/compose.yml up -d --wait` |
| Status | `docker compose --env-file .env -f infra/compose.yml ps` |
| Check everything answers | `node infra/smoke.mjs` |
| Logs of one container | `docker compose --env-file .env -f infra/compose.yml logs caddy` |
| Stop (data kept) | `docker compose --env-file .env -f infra/compose.yml down` |
| Reset (deletes all local data) | `docker compose --env-file .env -f infra/compose.yml down -v` |

`node infra/smoke.mjs` prints one line per check and exits 1 if any fails. It expects no
service running: `/api/auth/health` must answer 503 `SERVICE_UNAVAILABLE`.

## Addresses

Every port is bound to `127.0.0.1`; nothing is reachable from another machine.

| What | Address |
|---|---|
| Gateway (clients use this) | `http://localhost:8080/api/...` |
| MongoDB | `mongodb://localhost:27017/?replicaSet=rs0` |
| Redis | `redis://localhost:6379` |
| RabbitMQ | `amqp://<RABBITMQ_USER>:<RABBITMQ_PASSWORD>@localhost:5672` |
| RabbitMQ UI | `http://localhost:15672` |
| Qdrant | `http://localhost:6333` |

MongoDB, Redis and Qdrant have no auth locally. MongoDB is a one-node replica set `rs0`
(needed for transactions and change streams); its member host is `localhost:27017`, so host
clients can pass `replicaSet=rs0`.

## Gateway routes (`Caddyfile`)

| Path | Goes to |
|---|---|
| `/api/auth/*` | `host.docker.internal:${AUTH_SERVICE_PORT}` (default 3001) |
| `/api/chat/*` | `host.docker.internal:${CHAT_SERVICE_PORT}` (default 8081) |
| `/api/ai/*` | `host.docker.internal:${AI_SERVICE_PORT}` (default 8082) |
| any `/internal` segment | 404 `{"code":"NOT_FOUND"}`, never forwarded |
| anything else | 404 `{"code":"NOT_FOUND"}` |

The prefix is kept: a request to `/api/auth/login` reaches the service as `/api/auth/login`.
When the service is not running, Caddy answers 503 `{"code":"SERVICE_UNAVAILABLE"}`.
After editing the `Caddyfile`: `docker compose --env-file .env -f infra/compose.yml restart caddy`.

## Common problems

- **"required variable RABBITMQ_PASSWORD is missing a value"**: `.env` is missing, the
  variable is empty, or `--env-file .env` was left out.
- **RabbitMQ login fails after changing the password in `.env`**: RabbitMQ creates the user
  only on first start. Reset its data:
  `docker compose --env-file .env -f infra/compose.yml down` then
  `docker volume rm openbox_rabbitmq-data`, then start again.
- **Port already in use** (for example 8080 or 27017): find the process.
  Windows: `netstat -ano | findstr :8080`, then `tasklist /fi "PID eq <pid>"`.
  Linux and macOS: `lsof -i :8080`. Stop that process, or change the host side of the port in
  `compose.yml` (`"127.0.0.1:8090:8080"`) and do not commit that change.
- **"failed to connect to the docker API"**: Docker Desktop is not running; start it and wait
  until it says it is running.
- **Caddy gives 503 although the service runs**: the service must listen on all interfaces
  or on the host port named in `.env`; check `*_SERVICE_PORT` matches the service's port.
  On Linux, a host firewall can block traffic from the Docker bridge.
- **Scripts or the Caddyfile break on Windows**: keep files LF (`.gitattributes` forces it).
