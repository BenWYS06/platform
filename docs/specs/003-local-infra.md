# Spec 003: Local infra with Caddy

Issue: 0.3 Local infra with Caddy. Sprint 1. Estimate 3.

## Why

Issue 0.4 builds three services that need MongoDB, Redis, RabbitMQ and Qdrant to start, and
clients must reach them through one address (D-002). Without one compose file, each developer
installs the stores by hand, with different versions and ports, and nothing checks that
`/internal` is blocked from outside.

## What we build

1. `infra/compose.yml`
   - MongoDB 8 as a one-node replica set `rs0`, started by its healthcheck (`rs.initiate`
     only if not yet initiated). The member host is `localhost:27017`, so services on the
     host connect with `mongodb://localhost:27017/?replicaSet=rs0`.
   - Redis, RabbitMQ with the management UI, Qdrant, Caddy.
   - Image tags pinned to an exact version; no `latest`.
   - Every port bound to `127.0.0.1` only: MongoDB 27017, Redis 6379, RabbitMQ 5672 and
     15672, Qdrant 6333, Caddy 8080.
   - A healthcheck for every container, so `up --wait` returns only when all are healthy.
   - Named volumes, so data survives `down`; `down -v` resets it.
2. Local auth
   - RabbitMQ user and password from env (`RABBITMQ_USER`, `RABBITMQ_PASSWORD`). Missing:
     compose stops with a message naming the variable.
   - MongoDB, Redis and Qdrant without auth locally; they are only on `127.0.0.1`.
3. `infra/Caddyfile`
   - Prefix kept (no strip): `/api/auth/*` to `host.docker.internal:3001`, `/api/chat/*` to
     `:8081`, `/api/ai/*` to `:8082`. Ports from env with these defaults.
   - Any path with an `/internal` segment (for example `/internal/x` or
     `/api/auth/internal/x`): 404 `{"code":"NOT_FOUND"}`, never forwarded.
   - Service not running: 503 `{"code":"SERVICE_UNAVAILABLE"}`.
   - Any other path: 404 `{"code":"NOT_FOUND"}`.
   - Every Caddy error body is JSON with `Content-Type: application/json`.
4. Contract
   - Add `SERVICE_UNAVAILABLE` (503) to `contracts/error-codes.json`.
5. Smoke check `infra/smoke.mjs` (node, no dependencies)
   - Checks each store port answers, and Caddy's answers for `/internal/x`,
     `/api/auth/internal/x`, an unknown path and `/api/auth/health` with no service running.
   - Prints one line per check and exits non-zero if any fails.
6. Docs and env
   - `.env.example`: the RabbitMQ variables and the three service ports, no real values.
   - `docs/environments.md`: the local row is real; ports, URLs and the reset command.
   - `docs/architecture.md`: routing shows the ports and the error answers.
   - CLAUDE.md commands: infra up, smoke check, reset.
   - `infra/README.md`: start, stop, reset, the connection strings, common Windows problems.

## Out of scope

- Services running in compose, images and production config: issue 3.6 (first deploy).
- `/ws` route: issue 2.2 (realtime over STOMP).
- `/api/connector` route: issue 5.2.
- Auth on MongoDB, Redis and Qdrant, and TLS: issue 3.6.
- RabbitMQ exchanges, queues and the dead-letter queue: issue 3.1.
- Running the smoke check in CI: issue 0.6.

## Edge cases

- `.env` missing or without the RabbitMQ variables: compose fails before starting anything
  and names what is missing.
- A port already in use (for example 8080 or 27017): compose fails for that container; the
  README says how to find the process and how to change the port.
- Second `up` on an already initiated replica set: no error, data kept.
- A client on the host connects with `replicaSet=rs0`: works, because the member host is
  `localhost:27017`, not a container name.
- Path tricks around `/internal`: `/INTERNAL/x`, `/api/auth/./internal/x`,
  `/api/auth/%69nternal/x`, `/api/auth//internal/x`: all 404, never forwarded.
- Windows Docker Desktop and Linux Docker: `host.docker.internal` works on both (Linux via
  `extra_hosts: host-gateway`). Files use LF; the smoke check runs with node on both.
- LAN access: nothing is reachable from another machine, because ports bind to `127.0.0.1`.

## Must not happen

- A request to any path with an `/internal` segment reaches a service.
- A store or Caddy port is reachable from another machine (bound to `0.0.0.0`).
- A real password in git: `compose.yml`, `Caddyfile` and `.env.example` hold names or
  local-only defaults, never a real value.
- A Caddy error body that is not `{ code }` JSON, or that shows an internal host or port.
- `down` without `-v` loses data, or a second `up` breaks the replica set.
- An image tagged `latest` or with no tag.

## Decisions

- Where services run in local dev: on the host; Caddy forwards to `host.docker.internal`. Owner
- Host ports: bound to `127.0.0.1` only; Caddy on 8080. Owner
- Local auth: RabbitMQ only, from `.env`; MongoDB, Redis and Qdrant without auth. Owner
- Caddy errors: contract JSON; add `SERVICE_UNAVAILABLE` (503). Owner
- Caddy keeps the `/api/<service>` prefix and blocks any `/internal` segment, so a stripped
  prefix cannot open an internal route. Claude
- Service ports 3001 (auth), 8081 (chat), 8082 (ai): 8080 is Caddy's. Claude
- Replica set member host `localhost:27017`, so host clients can use `replicaSet=rs0`. Claude
- Smoke check in node with no dependencies, so it runs the same on Windows and Linux. Claude

## Done when

1. `docker compose --env-file .env -f infra/compose.yml up -d --wait` exits 0, and
   `docker compose -f infra/compose.yml ps` shows every container healthy.
2. `node infra/smoke.mjs` passes: every store answers on its port.
3. With no service running, `curl -i localhost:8080/api/auth/health` returns 503 and
   `{"code":"SERVICE_UNAVAILABLE"}`.
4. `curl -i localhost:8080/internal/x`, `/api/auth/internal/x` and each path trick above
   return 404 `{"code":"NOT_FOUND"}` (covered by the smoke check).
5. A second `up --wait` after `down` (without `-v`) is healthy, and data written before is
   still there (`rs.status().ok` is 1, a test document is still found).
6. Starting without `RABBITMQ_PASSWORD` fails with a message naming it.
7. `cd contracts && npm test` passes with `SERVICE_UNAVAILABLE` added.
8. `.env.example`, `docs/environments.md`, `docs/architecture.md`, CLAUDE.md and
   `infra/README.md` are updated in the same PR.
