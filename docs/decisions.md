# Decisions

Job: a log of decisions that are hard to reverse, with the reason. Newest at the bottom. Never edit an old entry; add a new one that replaces it.

Format:

```
## D-NNN Title (YYYY-MM-DD)
Decision: what we chose.
Why: the reason.
Instead of: what we did not choose.
```

## D-001 Hooks parse JSON with node, not jq (2026-11-08)
Decision: Claude Code hook scripts read their stdin JSON with `node`.
Why: hooks must run on Windows Git Bash, where `jq` is often missing; node is needed for the project anyway.
Instead of: `jq`.

## D-002 One base URL through Caddy (2026-11-08)
Decision: every client calls one address; Caddy routes `/api/<service>` and `/ws`, and blocks `/internal`.
Why: clients never need to know service ports, and internal endpoints are never reachable from outside.
Instead of: one URL per service.

## D-003 Contract names are UPPER_SNAKE; error codes carry their HTTP status (2026-11-08)
Decision: every name in `contracts/` (error codes, capabilities, messaging and event names) is UPPER_SNAKE; RabbitMQ names keep the real broker name in a separate lower-dotted `value`. Each error code fixes its HTTP status in `error-codes.json`.
Why: UPPER_SNAKE maps straight to Java enums and TS constants; a fixed status means every service answers the same code with the same status, and clients can rely on it.
Instead of: dotted lower names (`auth.invalid_credentials`), and letting each service pick the status.

## D-004 Local dev: services on the host behind Caddy; /internal blocked by segment (2026-11-08)
Decision: locally, only the data stores and Caddy run in Docker (`infra/compose.yml`); services run on the host and Caddy forwards to `host.docker.internal`, keeping the `/api/<service>` prefix. Caddy blocks any path segment that starts with `internal` followed by a non-word character or the end, in any case, before routing. Every published port is bound to `127.0.0.1`.
Why: services restart fast from the IDE with a debugger; one gateway config is tested from day one; blocking by segment means a stripped prefix, `;params` or encoding tricks cannot open an internal route; nothing is reachable from the LAN while MongoDB, Redis and Qdrant have no auth locally.
Instead of: services in compose for local dev (later, issue 3.6), blocking only `/internal` at the root, ports on `0.0.0.0`.

## D-005 Service skeletons: pino, standalone Maven projects, health pings stores (2026-11-08)
Decision: auth-service logs with pino + pino-http. chat-service and ai-service are standalone Maven projects, each with its own wrapper. Every service's health route pings the stores it uses with a 2.5 s limit and answers 503 `SERVICE_UNAVAILABLE` when one is down; Spring Actuator is not used. `APP_ENV` names the environment in all services.
Why: pino is JSON by default, fast, and redacts headers by path. Standalone projects keep each service buildable alone and match the commands already in CLAUDE.md. A health that checks stores proves config and connections end to end, and a plain controller keeps the body in contract shape. One variable for the environment means one guard rule in all three languages.
Instead of: winston; a root parent pom with modules (issue 0.5 decides how the services consume the shared library); a liveness-only health or Actuator; `NODE_ENV` and Spring profiles.
